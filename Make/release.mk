# =============================================================================
# Release pipeline
#
# Requires:
#   git      — version control, tagging, archive
#   composer — PHP dependency manager (bundles webtrees-module-base into vendor/)
#   node     — JavaScript runtime for Rollup bundling
#   npm      — package manager for JS dependencies
#   jq       — JSON manipulation for composer.json / package.json
#   zip      — distribution archive creation + integrity check
#   gh       — GitHub CLI for creating releases and pushing tags
#   sed      — text substitution for PHP version string (Module.php)
#
# Non-interactive use:
#   export GH_TOKEN=<token>   # instead of 'gh auth login'
#   make release 3.1.0 NOTES_FILE=/tmp/notes.md
#   make release VERSION=3.1.0 NOTES_FILE=/tmp/notes.md   (also supported)
# =============================================================================

#### Release

MODULE_NAME      := webtrees-fan-chart
VENDOR_DIR       := .build/vendor
MODULE_BASE_PKG  := magicsunday/webtrees-module-base
MODULE_BASE_PATH := $(VENDOR_DIR)/$(MODULE_BASE_PKG)

# Accept both 'make release 3.1.0' (goal form) and 'make release VERSION=3.1.0'.
VERSION ?= $(filter-out release release-% dist,$(MAKECMDGOALS))

REQUIRED_TOOLS := git node npm composer jq zip gh sed

.PHONY: release release-check release-prepare release-publish release-bump \
        dist clean-js release-clean build-js-fresh

## Verify all required tools, VERSION, clean tree, no active link-base symlink, gh auth.
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
		echo "Error: VERSION required."; \
		echo "Usage:  make release 3.1.0"; \
		echo "   or:  make release VERSION=3.1.0"; \
		exit 1; \
	fi
	@if ! echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "Error: VERSION must be semver (e.g. 3.1.0 — no v prefix, no suffix)"; \
		exit 1; \
	fi
	@if [ -n "$$(git status --porcelain --untracked-files=no)" ]; then \
		echo "Error: Working directory not clean. Commit or stash changes first."; \
		echo "If a previous release attempt left an unpushed release commit:"; \
		echo "  git tag -d $(VERSION)      # if the tag was created"; \
		echo "  git reset --soft HEAD~1    # undo the release commit"; \
		exit 1; \
	fi
	@if [ -L $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) is a symlink (active 'make link-base')."; \
		echo "Run 'make unlink-base' before releasing — a symlinked vendor copy"; \
		echo "would ship as a broken absolute symlink inside the release zip."; \
		exit 1; \
	fi
	@if ! gh auth status >/dev/null 2>&1; then \
		echo "Error: Not authenticated with GitHub."; \
		echo "Run 'gh auth login' (interactive) or export GH_TOKEN=<token>."; \
		exit 1; \
	fi
	@echo -e "${FGREEN} ✔${FRESET} Release checks passed for $(VERSION)"

## Remove old versioned JS bundles before building new ones (filesystem + git)
clean-js:
	@git rm -f --ignore-unmatch resources/js/fan-chart-*.js resources/js/fan-chart-*.min.js >/dev/null 2>&1 || true
	@rm -f resources/js/fan-chart-*.js resources/js/fan-chart-*.min.js
	@echo -e "${FGREEN} ✔${FRESET} Old JS bundles removed"

## Fresh JS build: clean bundles, wipe node_modules, reinstall, rollup.
## Shared by release-prepare and release-bump so the toolchain stays aligned.
build-js-fresh:
	@$(MAKE) clean-js
	@rm -rf node_modules
	@npm ci
	@npm run prepare

## Build distribution zip from git archive (respects .gitattributes export-ignore)
## and bundle webtrees-module-base into the zip's vendor/ so ZIP installs work
## without requiring the user to run composer themselves.
##
## composer.json files are kept in git (composer uses its own GitHub archive
## fetch for 'composer require' installs) but removed from the release zip,
## since manual ZIP installs drop the module straight into modules_v4/ where
## webtrees never reads composer.json.
dist:
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip $(MODULE_NAME).zip.tmp
	@echo "  Installing composer runtime dependencies into $(VENDOR_DIR)..."
	@composer install --no-dev --no-progress
	@git archive --prefix=$(MODULE_NAME)/ HEAD --format=tar | tar -x
	@if [ ! -d $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) not found after composer install."; \
		echo "Check composer.json vendor-dir config and the require section for $(MODULE_BASE_PKG)."; \
		exit 1; \
	fi
	@if [ -L $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) is a symlink (active 'make link-base')."; \
		echo "Run 'make unlink-base' before releasing."; \
		exit 1; \
	fi
	@mkdir -p $(MODULE_NAME)/vendor/magicsunday
	@cp -rL $(MODULE_BASE_PATH) $(MODULE_NAME)/vendor/magicsunday/webtrees-module-base
	@echo "  Bundled $(MODULE_BASE_PKG) into vendor/"
	@find $(MODULE_NAME)/vendor -name composer.json -delete
	@rm -f $(MODULE_NAME)/composer.json
	@cd $(MODULE_NAME) && zip --quiet --recurse-paths -9 ../$(MODULE_NAME).zip.tmp .
	@mv $(MODULE_NAME).zip.tmp $(MODULE_NAME).zip
	@zip -T $(MODULE_NAME).zip >/dev/null
	@rm -rf $(MODULE_NAME)/
	@echo -e "${FGREEN} ✔${FRESET} $(MODULE_NAME).zip created"

## Prepare: update versions, pin webtrees, build JS, commit, build archive, tag.
## Tag runs AFTER dist succeeds so a dist failure does not leave a dangling tag.
## Recovery on dist failure: git reset --soft HEAD~1 (removes release commit).
release-prepare: release-check
	@echo -e "${FYELLOW}[1/5]${FRESET} Updating versions to $(VERSION)..."
	@sed -i "s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(VERSION)'/" src/Module.php
	@grep -q "CUSTOM_VERSION = '$(VERSION)'" src/Module.php || { echo "Error: Module.php CUSTOM_VERSION update did not apply"; exit 1; }
	@jq --arg v "$(VERSION)" '.version = $$v' package.json > package.json.tmp && mv package.json.tmp package.json
	@jq --arg v "~2.2.0" '.require["fisharebest/webtrees"] = $$v' composer.json > composer.json.tmp && mv composer.json.tmp composer.json
	@echo -e "${FYELLOW}[2/5]${FRESET} Removing old JS bundles..."
	@$(MAKE) clean-js
	@echo -e "${FYELLOW}[3/5]${FRESET} Building JavaScript bundles..."
	@$(MAKE) build-js-fresh
	@echo -e "${FYELLOW}[4/5]${FRESET} Committing release and building archive..."
	@git add src/Module.php package.json composer.json resources/js/
	@git commit -m "Release $(VERSION)"
	@$(MAKE) dist
	@git tag $(VERSION)
	@echo -e "${FGREEN} ✔${FRESET} Release $(VERSION) prepared"

## Publish: push, create GitHub release with zip.
## Pass NOTES_FILE=path for release notes from a file (recommended for multi-line notes).
## Pass NOTES="..." for a short inline note, or omit both for auto-generated notes.
## Example: make release 3.1.1 NOTES_FILE=/tmp/release-notes.md
## Example: make release 3.1.1 NOTES="Bug fix release"
release-publish:
	@if [ -n "$(NOTES_FILE)" ] && [ ! -f "$(NOTES_FILE)" ]; then \
		echo "Error: NOTES_FILE=$(NOTES_FILE) does not exist"; \
		exit 1; \
	fi
	@echo -e "${FYELLOW}[5/5]${FRESET} Publishing to GitHub..."
	@git push origin main --tags
	@if [ -n "$(NOTES_FILE)" ]; then \
		echo "  Notes: from file $(NOTES_FILE)"; \
		gh release create $(VERSION) \
			--title "$(VERSION)" \
			--notes-file "$(NOTES_FILE)" \
			--target main \
			$(MODULE_NAME).zip; \
	elif [ -n "$(NOTES)" ]; then \
		echo "  Notes: inline"; \
		gh release create $(VERSION) \
			--title "$(VERSION)" \
			--notes "$(NOTES)" \
			--target main \
			$(MODULE_NAME).zip; \
	else \
		echo "  Notes: auto-generated by GitHub"; \
		gh release create $(VERSION) \
			--title "$(VERSION)" \
			--generate-notes \
			--target main \
			$(MODULE_NAME).zip; \
	fi
	@echo "RELEASE_PUBLISHED version=$(VERSION)"
	@rm -f $(MODULE_NAME).zip
	@echo -e "${FGREEN} ✔${FRESET} Release $(VERSION) published"

## Bump to next dev version. Standalone-safe — validates VERSION before use.
release-bump:
	@if [ -z "$(VERSION)" ] || ! echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "Error: VERSION must be semver (e.g. 3.1.0)"; \
		exit 1; \
	fi
	$(eval NEXT := $(shell echo "$(VERSION)" | awk -F. '{print $$1"."$$2"."$$3+1}'))
	@echo -e "${FYELLOW}[+]${FRESET} Bumping to $(NEXT)-dev..."
	@sed -i "s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(NEXT)-dev'/" src/Module.php
	@grep -q "CUSTOM_VERSION = '$(NEXT)-dev'" src/Module.php || { echo "Error: Module.php CUSTOM_VERSION bump did not apply"; exit 1; }
	@jq --arg v "$(NEXT)-dev" '.version = $$v' package.json > package.json.tmp && mv package.json.tmp package.json
	@jq --arg v "~2.2.0 || dev-main" '.require["fisharebest/webtrees"] = $$v' composer.json > composer.json.tmp && mv composer.json.tmp composer.json
	@$(MAKE) build-js-fresh
	@git add src/Module.php package.json composer.json resources/js/
	@git commit -m "Bump version to $(NEXT)-dev"
	@git push origin main
	@echo -e "${FGREEN} ✔${FRESET} Version bumped to $(NEXT)-dev"

## Remove leftover release artifacts
release-clean:
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip $(MODULE_NAME).zip.tmp

## Full release pipeline
release: release-prepare release-publish release-bump release-clean ## Create and publish a release (usage: make release 3.1.0)
	@echo ""
	@echo -e "${FGREEN} ✔ Release $(VERSION) complete!${FRESET}"
