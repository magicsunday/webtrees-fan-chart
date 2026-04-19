# =============================================================================
# Release pipeline
#
# Requires:
#   git      — version control, tagging, archive
#   composer — PHP dependency manager (bundles webtrees-module-base into vendor/)
#   node — JavaScript runtime for Rollup bundling
#   npm  — package manager for JS dependencies
#   jq   — JSON manipulation for package.json version updates
#   zip  — creating distribution archives
#   gh   — GitHub CLI for creating releases and pushing tags
#   sed  — text substitution for PHP version strings
# =============================================================================

#### Release

MODULE_NAME := webtrees-fan-chart

# Extract version from arguments: "make release 3.1.0"
VERSION := $(filter-out release release-% dist,$(MAKECMDGOALS))

REQUIRED_TOOLS := git node npm composer jq zip gh sed

.PHONY: release release-check release-prepare release-publish release-bump dist clean-js release-clean

## Verify all required tools are available
release-check:
	@missing=""; \
	for tool in $(REQUIRED_TOOLS); do \
		if ! command -v $$tool >/dev/null 2>&1; then \
			missing="$$missing $$tool"; \
		fi; \
	done; \
	if [ -n "$$missing" ]; then \
		echo "Error: Missing required tools:$$missing"; \
		echo ""; \
		echo "This command requires: $(REQUIRED_TOOLS)"; \
		echo "Make sure all tools are available in your environment."; \
		exit 1; \
	fi
	@if [ -z "$(VERSION)" ]; then \
		echo "Usage: make release 3.1.0"; \
		exit 1; \
	fi
	@if ! echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "Error: VERSION must be semver (e.g. 3.1.0)"; \
		exit 1; \
	fi
	@if [ -n "$$(git status --porcelain --untracked-files=no)" ]; then \
		echo "Error: Working directory not clean. Commit or stash changes first."; \
		exit 1; \
	fi
	@if ! gh auth status >/dev/null 2>&1; then \
		echo "Error: Not authenticated with GitHub. Run 'gh auth login' first."; \
		exit 1; \
	fi
	@echo -e "${FGREEN} ✔${FRESET} Release checks passed for $(VERSION)"

## Remove old versioned JS bundles before building new ones (filesystem + git)
clean-js:
	@git rm -f --ignore-unmatch resources/js/fan-chart-*.js resources/js/fan-chart-*.min.js >/dev/null 2>&1 || true
	@rm -f resources/js/fan-chart-*.js resources/js/fan-chart-*.min.js
	@echo -e "${FGREEN} ✔${FRESET} Old JS bundles removed"

## Build distribution zip from git archive (respects .gitattributes export-ignore)
## and bundle magicsunday/webtrees-module-base into the zip's vendor/ so ZIP
## installs work without requiring the user to run composer themselves.
dist:
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip
	@composer install --no-dev --no-progress --quiet
	@git archive --prefix=$(MODULE_NAME)/ HEAD --format=tar | tar -x
	@if [ -d .build/vendor/magicsunday/webtrees-module-base ]; then \
		mkdir -p $(MODULE_NAME)/vendor/magicsunday; \
		cp -r .build/vendor/magicsunday/webtrees-module-base $(MODULE_NAME)/vendor/magicsunday/webtrees-module-base; \
		echo "  Bundled webtrees-module-base into vendor/"; \
	fi
	@cd $(MODULE_NAME) && zip --quiet --recurse-paths --move -9 ../$(MODULE_NAME).zip .
	@rm -rf $(MODULE_NAME)/
	@echo -e "${FGREEN} ✔${FRESET} $(MODULE_NAME).zip created"

## Prepare: update versions, pin webtrees, build JS, commit, tag, build zip
release-prepare: release-check
	@echo -e "${FYELLOW}[1/5]${FRESET} Updating versions to $(VERSION)..."
	@sed -i "s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(VERSION)'/" src/Module.php
	@jq --arg v "$(VERSION)" '.version = $$v' package.json > package.json.tmp && mv package.json.tmp package.json
	@sed -i 's/"fisharebest\/webtrees": "~2.2.0 || dev-main"/"fisharebest\/webtrees": "~2.2.0"/' composer.json
	@echo -e "${FYELLOW}[2/5]${FRESET} Removing old JS bundles..."
	@$(MAKE) clean-js
	@echo -e "${FYELLOW}[3/5]${FRESET} Building JavaScript bundles..."
	@rm -rf node_modules
	@npm ci
	@npm run prepare
	@echo -e "${FYELLOW}[4/5]${FRESET} Committing release and building archive..."
	@git add -A
	@git commit -m "Release $(VERSION)"
	@git tag $(VERSION)
	@$(MAKE) dist
	@echo -e "${FGREEN} ✔${FRESET} Release $(VERSION) prepared"

## Publish: push, create GitHub release with zip.
## Pass NOTES_FILE=path for release notes from a file (recommended for multi-line notes).
## Pass NOTES="..." for a short inline note, or omit both for auto-generated notes.
## Example: make release 3.1.1 NOTES_FILE=/tmp/release-notes.md
## Example: make release 3.1.1 NOTES="Bug fix release"
release-publish:
	@echo -e "${FYELLOW}[5/5]${FRESET} Publishing to GitHub..."
	@git push origin main --tags
	@if [ -n "$(NOTES_FILE)" ]; then \
		gh release create $(VERSION) \
			--title "$(VERSION)" \
			--notes-file "$(NOTES_FILE)" \
			--target main \
			$(MODULE_NAME).zip; \
	elif [ -n "$(NOTES)" ]; then \
		gh release create $(VERSION) \
			--title "$(VERSION)" \
			--notes "$(NOTES)" \
			--target main \
			$(MODULE_NAME).zip; \
	else \
		gh release create $(VERSION) \
			--title "$(VERSION)" \
			--generate-notes \
			--target main \
			$(MODULE_NAME).zip; \
	fi
	@rm -f $(MODULE_NAME).zip
	@echo -e "${FGREEN} ✔${FRESET} Release $(VERSION) published"

## Bump to next dev version
release-bump:
	$(eval NEXT := $(shell echo "$(VERSION)" | awk -F. '{print $$1"."$$2"."$$3+1}'))
	@echo -e "${FYELLOW}[+]${FRESET} Bumping to $(NEXT)-dev..."
	@sed -i "s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(NEXT)-dev'/" src/Module.php
	@jq --arg v "$(NEXT)-dev" '.version = $$v' package.json > package.json.tmp && mv package.json.tmp package.json
	@sed -i 's/"fisharebest\/webtrees": "~2.2.0"/"fisharebest\/webtrees": "~2.2.0 || dev-main"/' composer.json
	@$(MAKE) clean-js
	@rm -rf node_modules
	@npm ci
	@npm run prepare
	@git add -A
	@git commit -m "Bump version to $(NEXT)-dev"
	@git push origin main
	@echo -e "${FGREEN} ✔${FRESET} Version bumped to $(NEXT)-dev"

## Remove leftover release artifacts
release-clean:
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip

## Full release pipeline
release: release-prepare release-publish release-bump release-clean ## Create and publish a release (usage: make release 3.1.0)
	@echo ""
	@echo -e "${FGREEN} ✔ Release $(VERSION) complete!${FRESET}"
