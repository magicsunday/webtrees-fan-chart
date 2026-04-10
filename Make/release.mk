# =============================================================================
# TARGETS
# =============================================================================

#### Release

MODULE_NAME := webtrees-fan-chart

# Extract version from arguments: "make release 3.1.0"
VERSION := $(filter-out release release-% dist,$(MAKECMDGOALS))

.PHONY: release release-check release-prepare release-publish release-bump dist

## Check that VERSION is set and valid
release-check:
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
	@echo -e "${FGREEN} ✔${FRESET} Release checks passed for $(VERSION)"

## Build distribution zip from git archive (respects .gitattributes export-ignore)
dist:
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip
	@git archive --prefix=$(MODULE_NAME)/ HEAD --format=tar | tar -x
	@$(COMPOSE_RUN) sh -c "cd /app/$(MODULE_NAME) && zip --quiet --recurse-paths --move -9 /app/$(MODULE_NAME).zip ."
	@rm -rf $(MODULE_NAME)/
	@echo -e "${FGREEN} ✔${FRESET} $(MODULE_NAME).zip created"

## Clean node_modules (may need root if created by different user)
clean-node:
	@if [ -d node_modules ]; then \
		$(COMPOSE_RUN) rm -rf /app/node_modules 2>/dev/null || \
		sudo rm -rf node_modules 2>/dev/null || \
		rm -rf node_modules; \
	fi

## Build JS bundles via node container
js-build: clean-node
	@$(COMPOSE_RUN) sh -c "npm ci && npm run prepare"

## Prepare: update versions, pin webtrees, build JS, commit, tag, build zip
release-prepare: release-check
	@echo -e "${FYELLOW}[1/4]${FRESET} Updating versions to $(VERSION)..."
	@sed -i "s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(VERSION)'/" src/Module.php
	@sed -i '0,/"version":/{s/"version": ".*"/"version": "$(VERSION)"/}' package.json
	@sed -i 's/"fisharebest\/webtrees": "~2.2.0 || dev-main"/"fisharebest\/webtrees": "~2.2.0"/' composer.json
	@echo -e "${FYELLOW}[2/4]${FRESET} Building JavaScript bundles..."
	@$(MAKE) js-build
	@echo -e "${FYELLOW}[3/4]${FRESET} Committing release and building archive..."
	@git add -A
	@git commit -m "Release $(VERSION)"
	@git tag $(VERSION)
	@$(MAKE) dist
	@echo -e "${FGREEN} ✔${FRESET} Release $(VERSION) prepared"

## Publish: push, create GitHub release with zip.
## Set NOTES_FILE to a markdown file for custom release notes.
## Example: make release-publish NOTES_FILE=RELEASE_NOTES.md
release-publish:
	@echo -e "${FYELLOW}[4/4]${FRESET} Publishing to GitHub..."
	@git push origin main --tags
	@if [ -n "$(NOTES_FILE)" ] && [ -f "$(NOTES_FILE)" ]; then \
		gh release create $(VERSION) \
			--title "$(VERSION)" \
			--notes-file "$(NOTES_FILE)" \
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
	@sed -i '0,/"version":/{s/"version": ".*"/"version": "$(NEXT)-dev"/}' package.json
	@sed -i 's/"fisharebest\/webtrees": "~2.2.0"/"fisharebest\/webtrees": "~2.2.0 || dev-main"/' composer.json
	@$(MAKE) js-build
	@git add -A
	@git commit -m "Bump version to $(NEXT)-dev"
	@git push origin main
	@echo -e "${FGREEN} ✔${FRESET} Version bumped to $(NEXT)-dev"

## Full release pipeline
release: release-prepare release-publish release-bump ## Create and publish a release (usage: make release 3.1.0)
	@echo ""
	@echo -e "${FGREEN} ✔ Release $(VERSION) complete!${FRESET}"
