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
JS_NAME          := $(patsubst webtrees-%,%,$(MODULE_NAME))
VENDOR_DIR       := .build/vendor
MODULE_BASE_PKG  := magicsunday/webtrees-module-base
MODULE_BASE_PATH := $(VENDOR_DIR)/$(MODULE_BASE_PKG)

# Accept both 'make release 3.1.0' (goal form) and 'make release VERSION=3.1.0'.
VERSION ?= $(filter-out release release-% dist,$(MAKECMDGOALS))

REQUIRED_TOOLS := git node npm composer jq zip gh sed

.PHONY: release release-check release-prepare release-publish release-bump \
        dist dist-smoke clean-js release-clean build-js-fresh

# release pipeline operates on shared repo state — must run sequentially.
.NOTPARALLEL:

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
		echo "  git tag -d <VERSION>       # if the tag was created"; \
		echo "  git reset --soft HEAD~1    # undo the release commit"; \
		echo "(Stash any other local changes first — git reset only moves HEAD)"; \
		exit 1; \
	fi
	@if ! git symbolic-ref --quiet HEAD >/dev/null 2>&1; then \
		echo "Error: HEAD is detached. Check out the release branch first (typically 'main')."; \
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
	@git rm -f --ignore-unmatch resources/js/$(JS_NAME)-*.js resources/js/$(JS_NAME)-*.min.js >/dev/null 2>&1 || true
	@rm -f resources/js/$(JS_NAME)-*.js resources/js/$(JS_NAME)-*.min.js
	@echo -e "${FGREEN} ✔${FRESET} Old JS bundles removed"

## Fresh JS build: clean bundles, wipe node_modules, reinstall, rollup.
## Shared by release-prepare and release-bump so the toolchain stays aligned.
## Owns the clean-first contract — callers should not invoke clean-js separately.
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
##
## The symlink guard runs before composer install — composer install would
## clobber an active 'make link-base' symlink and produce a stale ZIP.
dist:
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip $(MODULE_NAME).zip.tmp
	@if [ -L $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) is a symlink (active 'make link-base')."; \
		echo "Run 'make unlink-base' before 'make dist'."; \
		exit 1; \
	fi
	@rm -rf $(VENDOR_DIR)
	@echo "  Installing composer runtime dependencies into $(VENDOR_DIR)..."
	@composer update --no-dev --no-progress --no-interaction --no-security-blocking --ignore-platform-req=php
	@git archive --prefix=$(MODULE_NAME)/ HEAD --format=tar | tar -x
	@if [ ! -d $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) not found after composer install."; \
		echo "Check composer.json vendor-dir config and the require section for $(MODULE_BASE_PKG)."; \
		exit 1; \
	fi
	@mkdir -p $(MODULE_NAME)/vendor/magicsunday
	@cp -rL $(MODULE_BASE_PATH) $(MODULE_NAME)/vendor/magicsunday/webtrees-module-base
	@echo "  Bundled $(MODULE_BASE_PKG) into vendor/"
	@find $(MODULE_NAME)/vendor -name composer.json -delete
	@rm -f $(MODULE_NAME)/composer.json
	@cd $(MODULE_NAME) && zip --quiet --recurse-paths -9 ../$(MODULE_NAME).zip.tmp .
	@mv $(MODULE_NAME).zip.tmp $(MODULE_NAME).zip
	@zip -T $(MODULE_NAME).zip >/dev/null || { rm -f $(MODULE_NAME).zip; echo "Error: zip integrity check failed"; exit 1; }
	@rm -rf $(MODULE_NAME)/
	@echo -e "${FGREEN} ✔${FRESET} $(MODULE_NAME).zip created"

## Smoke-test the just-built distribution zip. Asserts required entries
## are present and forbidden ones absent. Suitable for CI on every push.
##   make dist && make dist-smoke
dist-smoke:
	@if [ ! -f $(MODULE_NAME).zip ]; then \
		echo "Error: $(MODULE_NAME).zip not found — run 'make dist' first"; \
		exit 1; \
	fi
	@paths=$$(unzip -Z1 $(MODULE_NAME).zip); \
	for f in module.php LICENSE; do \
		echo "$$paths" | grep -Fxq "$$f" || { echo "Error: required file missing from zip: $$f"; exit 1; }; \
	done; \
	for prefix in \
		resources/js/$(JS_NAME)-[0-9] \
		vendor/magicsunday/webtrees-module-base/src/Model/ \
		vendor/magicsunday/webtrees-module-base/src/Module/ \
		vendor/magicsunday/webtrees-module-base/src/Processor/ \
	; do \
		echo "$$paths" | grep -qE "^$$prefix" || { echo "Error: required prefix has no entries in zip: $$prefix"; exit 1; }; \
	done; \
	if echo "$$paths" | grep -qE '(^|/)composer\.json$$'; then \
		echo "Error: composer.json found in zip"; exit 1; \
	fi; \
	if echo "$$paths" | grep -qE '^assets/'; then \
		echo "Error: assets/ found in zip"; exit 1; \
	fi
	@echo -e "${FGREEN} ✔${FRESET} dist-smoke passed: $(MODULE_NAME).zip is well-formed"

# Atomic JSON edit with cleanup on failure + post-write assertion. Usage:
#   $(call jq_edit,FILE,WRITE_EXPR,ARGS,VERIFY_EXPR)
# The temp file is removed if jq fails, leaving the original file untouched.
# VERIFY_EXPR must evaluate truthy after the write; otherwise the macro aborts.
define jq_edit
( jq --indent 4 $(3) '$(2)' $(1) > $(1).tmp && mv $(1).tmp $(1) ) || ( rm -f $(1).tmp; exit 1 ); \
jq -e $(3) '$(4)' $(1) >/dev/null || { echo "Error: $(1) write did not match $(4)"; exit 1; }
endef

# In-place sed edit with post-write fixed-string assertion. Usage:
#   $(call sed_edit,FILE,SED_EXPR,EXPECTED_FIXED_STR)
# Aborts if FILE does not contain EXPECTED_FIXED_STR after the sed runs.
# printf %s safely handles the literal expected-string value in the error path
# (echo "..." would break on the embedded double quotes inside $(3)).
define sed_edit
sed -i $(2) $(1) && grep -qF $(3) $(1) || { printf 'Error: %s update did not apply (expected: %s)\n' '$(1)' $(3); exit 1; }
endef

## Prepare: update versions, pin webtrees, build JS, commit, build archive, tag.
## Tag runs AFTER dist succeeds so a dist failure does not leave a dangling tag.
## Recovery on dist failure: git reset --soft HEAD~1 (removes release commit).
release-prepare: release-check
	@echo -e "${FYELLOW}[1/5]${FRESET} Updating versions to $(VERSION)..."
	@$(call sed_edit,src/Module.php,"s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(VERSION)'/","CUSTOM_VERSION = '$(VERSION)'")
	@$(call jq_edit,package.json,.version = $$v,--arg v "$(VERSION)",.version == $$v)
	@$(call jq_edit,composer.json,.require["fisharebest/webtrees"] = $$v,--arg v "~2.2.0",.require["fisharebest/webtrees"] == $$v)
	@echo -e "${FYELLOW}[2/5]${FRESET} Cleaning + rebuilding JavaScript bundles..."
	@npm install --package-lock-only --no-audit --no-fund
	@$(MAKE) build-js-fresh
	@echo -e "${FYELLOW}[3/5]${FRESET} Committing release commit..."
	@git add src/Module.php package.json composer.json package-lock.json resources/js/
	@git commit -m "Release $(VERSION)"
	@echo -e "${FYELLOW}[4/5]${FRESET} Building + smoke-testing distribution archive..."
	@$(MAKE) dist
	@$(MAKE) dist-smoke
	@echo -e "${FYELLOW}[5/5]${FRESET} Tagging $(VERSION)..."
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
	@echo -e "${FYELLOW}[publish]${FRESET} Pushing to GitHub..."
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
##
## Recovery paths:
##
## 1. Bump fails BEFORE git commit (sed/jq/build-js-fresh aborted):
##      git stash                            # save unrelated work first
##      git restore src/Module.php package.json composer.json
##      rm -f composer.json.tmp package.json.tmp
##      git stash pop                        # if you stashed
##      make release-bump VERSION=<VERSION>  # retry
##
## 2. Bump fails AFTER release-publish has succeeded (release is live, only
##    the post-release dev bump is missing — same recovery as case 1, the
##    release itself is unaffected and stays valid).
release-bump:
	@if [ -z "$(VERSION)" ] || ! echo "$(VERSION)" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "Error: VERSION must be semver (e.g. 3.1.0)"; \
		exit 1; \
	fi
	@$(eval NEXT := $(shell echo "$(VERSION)" | awk -F. '{print $$1"."$$2"."$$3+1}'))
	@echo -e "${FYELLOW}[bump]${FRESET} Bumping to $(NEXT)-dev..."
	@$(call sed_edit,src/Module.php,"s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(NEXT)-dev'/","CUSTOM_VERSION = '$(NEXT)-dev'")
	@$(call jq_edit,package.json,.version = $$v,--arg v "$(NEXT)-dev",.version == $$v)
	@$(call jq_edit,composer.json,.require["fisharebest/webtrees"] = $$v,--arg v "~2.2.0 || dev-main",.require["fisharebest/webtrees"] == $$v)
	@npm install --package-lock-only --no-audit --no-fund
	@$(MAKE) build-js-fresh
	@git add src/Module.php package.json composer.json package-lock.json resources/js/
	@git commit -m "Bump version to $(NEXT)-dev"
	@git push origin main
	@echo -e "${FGREEN} ✔${FRESET} Version bumped to $(NEXT)-dev"

## Remove leftover release artifacts
release-clean:
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip $(MODULE_NAME).zip.tmp
	@rm -f composer.json.tmp package.json.tmp

## Full release pipeline
release: release-prepare release-publish release-bump release-clean ## Create and publish a release (usage: make release 3.1.0)
	@echo ""
	@echo -e "${FGREEN} ✔ Release $(VERSION) complete!${FRESET}"
