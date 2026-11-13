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
#   unzip    — extract the dist zip to verify its contents (dist-smoke)
#   php      — lint the extracted module.php (php -l) in dist-smoke
#
# Non-interactive use:
#   export GH_TOKEN=<token>   # instead of 'gh auth login'
#   make release 3.1.0 NOTES_FILE=/tmp/notes.md
#   make release VERSION=3.1.0 NOTES_FILE=/tmp/notes.md   (also supported)
#
# NOTES_FILE must be readable from the shell that runs make. When releasing
# from inside the buildbox container, a host path like /tmp/notes.md is not
# mounted — place the notes file under the (bind-mounted) module directory,
# e.g. NOTES_FILE=.relnotes.md (untracked files are ignored by release-check
# and excluded from the dist archive).
#
# Recovery: if release-prepare aborts mid-way, run 'make release-recover' to
# restore the mutated release files and remove build artifacts.
# =============================================================================

#### Release

# MODULE_NAME, SCOPE_NS, WEBTREES_CONSTRAINT, CHART_LIB_MARKER and SHARED_VIEWS come from
# Make/module.mk, which the Makefile reads before this file.
JS_NAME          := $(patsubst webtrees-%,%,$(MODULE_NAME))
VENDOR_DIR       := .build/vendor
MODULE_BASE_PKG  := magicsunday/webtrees-module-base
MODULE_BASE_PATH := $(VENDOR_DIR)/$(MODULE_BASE_PKG)

# The version of the module base that dist records and dist-smoke checks. The deferred assignment keeps the double
# dollar, which make turns into the end anchor of the regular expression.
MODULE_BASE_VERSION_PATTERN = ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$$

# The release version that release-check, release-publish and release-bump accept. The deferred assignment keeps the
# double dollar, which make turns into the end anchor of the regular expression.
RELEASE_VERSION_PATTERN = ^[0-9]+\.[0-9]+\.[0-9]+$$
RELEASE_VERSION_ERROR   = Error: VERSION must be semver (e.g. 3.1.0, no v prefix, no suffix)

# SCOPE_NS is the per-module namespace prefix injected into the bundled module-base
# classes at dist time. It prevents PHP autoloader collisions when multiple magicsunday
# chart modules at different versions register the same shared namespace
# (see GitHub issues #194, #196). Must be unique per module.

# Per-module name of the view namespace that the bundled module-base registers.
# webtrees keeps one registration per name and the last module to boot wins, so
# a shared name lets a module with an older bundle remove the shared views of
# another one. Derived from the module name, so it is unique per module.
SCOPE_VIEW_NS    := webtrees-module-base-$(JS_NAME)

# Accept both 'make release 3.1.0' (goal form) and 'make release VERSION=3.1.0'.
VERSION ?= $(filter-out release release-% dist,$(MAKECMDGOALS))

REQUIRED_TOOLS := git node npm composer jq zip unzip gh sed php

# WEBTREES_CONSTRAINT is written to composer.json by release-prepare and again by
# release-bump, so the release commit and the development bump cannot differ.

.PHONY: release release-check release-prepare release-publish release-bump \
        release-recover dist dist-stamp dist-smoke dist-base-version clean-js release-clean build-js-fresh \
        release-bootstrap release-dry-run

# release pipeline operates on shared repo state — must run sequentially.
.NOTPARALLEL:

## Provision the dev toolchain a release needs but that a fresh checkout or a
## prior 'make dist' (composer update --no-dev wipes .build/vendor's dev tools)
## may have left missing — so 'make release' / 'make release-dry-run' run end to
## end without a manual 'composer install' / 'npm ci' first. Idempotent: each
## step is guarded and skips when already present, so it is cheap on a warm tree.
##   1. .build/vendor dev tools (phpstan/php-cs-fixer/phpunit) for 'composer ci:test'
##   2. node_modules with the built chart-lib dist (the github source dep ships no
##      dist/; only a real 'npm ci' clones + builds it) for the rollup + js:typecheck
release-bootstrap:
	@if [ ! -d $(VENDOR_DIR)/phpstan/phpstan ]; then \
		echo -e "${FYELLOW}[bootstrap]${FRESET} Restoring dev toolchain ($(VENDOR_DIR))..."; \
		composer install --no-interaction --no-progress; \
	fi
	@if [ ! -f node_modules/@magicsunday/webtrees-chart-lib/dist/$(CHART_LIB_MARKER) ]; then \
		echo -e "${FYELLOW}[bootstrap]${FRESET} Installing node deps + building chart-lib dist (npm ci)..."; \
		npm ci; \
	fi
	@echo -e "${FGREEN} ✔${FRESET} Release toolchain ready"

## Verify all required tools, VERSION, clean tree, no active link-base / link-chart-lib
## symlink, node_modules ownership, gh auth — THEN provision the toolchain. Bootstrap
## runs LAST (from the recipe, not as a prerequisite) so its composer install / npm ci
## can never clobber an active link-base / link-chart-lib BEFORE the symlink guards below
## reject it.
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
	@if ! echo "$(VERSION)" | grep -qE '$(RELEASE_VERSION_PATTERN)'; then \
		echo "$(RELEASE_VERSION_ERROR)"; \
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
	@if [ "$$(git symbolic-ref HEAD)" != refs/heads/main ]; then \
		echo "Error: releases are made from 'main' only, because the publish and bump targets push 'main'."; \
		echo "Check out 'main' first."; \
		exit 1; \
	fi
	@if [ -L $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) is a symlink (active 'make link-base')."; \
		echo "Run 'make unlink-base' before releasing — a symlinked vendor copy"; \
		echo "would ship as a broken absolute symlink inside the release zip."; \
		exit 1; \
	fi
	@if [ -L node_modules/@magicsunday/webtrees-chart-lib ]; then \
		echo "Error: node_modules/@magicsunday/webtrees-chart-lib is a symlink (active 'make link-chart-lib')."; \
		echo "Run 'make unlink-chart-lib' before releasing — the rollup build would"; \
		echo "bundle the sibling clone instead of the tagged release."; \
		exit 1; \
	fi
	@if [ -d node_modules ] && [ -n "$$(find node_modules ! -uid $$(id -u) -print 2>/dev/null | head -n 1)" ]; then \
		echo "Error: node_modules contains files not owned by the current user."; \
		echo "Files that a run as root left behind are the usual cause, and the release"; \
		echo "build cannot remove them, aborting build-js-fresh mid-way. Remove the tree"; \
		echo "and install it again as the calling user:  make clean && make install"; \
		exit 1; \
	fi
	@if ! gh auth status >/dev/null 2>&1; then \
		echo "Error: Not authenticated with GitHub."; \
		echo "Run 'gh auth login' (interactive) or export GH_TOKEN=<token>."; \
		exit 1; \
	fi
	@echo -e "${FGREEN} ✔${FRESET} Release checks passed for $(VERSION)"
	@$(MAKE) release-bootstrap

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
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip $(MODULE_NAME).zip.tmp $(MODULE_NAME).commit
	# The commit is resolved once, so the archive and its stamp name the same commit even when the checkout
	# moves while the dependencies install.
	@git rev-parse HEAD > $(MODULE_NAME).commit
	@if [ -L $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) is a symlink (active 'make link-base')."; \
		echo "Run 'make unlink-base' before 'make dist'."; \
		exit 1; \
	fi
	@rm -rf $(VENDOR_DIR)
	@echo "  Installing composer runtime dependencies into $(VENDOR_DIR)..."
	@composer update --no-dev --no-progress --no-interaction --ignore-platform-req=php
	@git archive --prefix=$(MODULE_NAME)/ "$$(cat $(MODULE_NAME).commit)" --format=tar | tar -x
	@if [ ! -d $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) not found after composer install."; \
		echo "Check composer.json vendor-dir config and the require section for $(MODULE_BASE_PKG)."; \
		exit 1; \
	fi
	@mkdir -p $(MODULE_NAME)/vendor/magicsunday/webtrees-module-base
	@cp -rL $(MODULE_BASE_PATH)/src $(MODULE_NAME)/vendor/magicsunday/webtrees-module-base/src
ifneq ($(strip $(SHARED_VIEWS)),)
	@mkdir -p $(MODULE_NAME)/vendor/magicsunday/webtrees-module-base/resources/views
	@for view in $(SHARED_VIEWS); do \
		[ -f $(MODULE_BASE_PATH)/resources/views/$$view.phtml ] \
			|| { echo "Error: shared view $$view is missing from $(MODULE_BASE_PATH)/resources/views."; exit 1; }; \
		cp -L $(MODULE_BASE_PATH)/resources/views/$$view.phtml \
			$(MODULE_NAME)/vendor/magicsunday/webtrees-module-base/resources/views/$$view.phtml \
			|| exit 1; \
	done
endif
	@cp -L $(MODULE_BASE_PATH)/LICENSE $(MODULE_NAME)/vendor/magicsunday/webtrees-module-base/LICENSE
	@echo "  Bundled $(MODULE_BASE_PKG) (src, LICENSE and the shared views of SHARED_VIEWS) into vendor/"
	@$(MAKE) --no-print-directory dist-base-version
	@find $(MODULE_NAME)/vendor -name composer.json -delete
	@rm -f $(MODULE_NAME)/composer.json
	@echo "  Scoping module-base namespace with prefix $(SCOPE_NS)..."
	@find $(MODULE_NAME) -type f \( -name '*.php' -o -name '*.phtml' \) -exec sed -i \
		-e 's|MagicSunday\\\\Webtrees\\\\ModuleBase|MagicSunday\\\\$(SCOPE_NS)\\\\Webtrees\\\\ModuleBase|g' \
		-e 's|MagicSunday\\Webtrees\\ModuleBase|MagicSunday\\$(SCOPE_NS)\\Webtrees\\ModuleBase|g' \
		{} +
ifneq ($(strip $(SHARED_VIEWS)),)
	@echo "  Scoping module-base view namespace to $(SCOPE_VIEW_NS)..."
	@sed -i -e "s|'webtrees-module-base'|'$(SCOPE_VIEW_NS)'|" \
		$(MODULE_NAME)/vendor/magicsunday/webtrees-module-base/src/View/SharedViews.php
	@grep -qF "'$(SCOPE_VIEW_NS)'" $(MODULE_NAME)/vendor/magicsunday/webtrees-module-base/src/View/SharedViews.php \
		|| { echo "Error: view namespace of the bundled SharedViews.php was not scoped"; exit 1; }
endif
	@hits=$$(find $(MODULE_NAME) -type f \( -name '*.php' -o -name '*.phtml' \) -print0 \
	    | xargs -0 grep -lE 'MagicSunday\\Webtrees\\ModuleBase' 2>/dev/null); \
	if [ -n "$$hits" ]; then \
		echo "Error: unprefixed MagicSunday\\Webtrees\\ModuleBase remains in dist:"; \
		echo "$$hits" | head -5; \
		exit 1; \
	fi
	@cd $(MODULE_NAME) && zip --quiet --recurse-paths -9 ../$(MODULE_NAME).zip.tmp .
	@mv $(MODULE_NAME).zip.tmp $(MODULE_NAME).zip
	@$(MAKE) --no-print-directory dist-stamp
	@zip -T $(MODULE_NAME).zip >/dev/null || { rm -f $(MODULE_NAME).zip; echo "Error: zip integrity check failed"; exit 1; }
	@rm -rf $(MODULE_NAME)/
	@echo -e "${FGREEN} ✔${FRESET} $(MODULE_NAME).zip created"

## Write the commit that the archive was built on into the archive comment, so the publish step can tell
## which commit an archive belongs to. Run by dist, it reads the commit file that dist wrote.
dist-stamp:
	@zip --quiet -z $(MODULE_NAME).zip < $(MODULE_NAME).commit
	@rm -f $(MODULE_NAME).commit

## Write the version that composer resolved for the bundled module base into the bundled copy, so the archive
## says which module base it carries. Run by dist, it reads the composer metadata of the build and stops when
## that holds no release version of the module base.
dist-base-version:
	@version=$$(jq -r --arg package '$(MODULE_BASE_PKG)' 'first(.packages[] | select(.name == $$package) | .version) // empty' $(VENDOR_DIR)/composer/installed.json); \
	[[ "$$version" =~ $(MODULE_BASE_VERSION_PATTERN) ]] \
		|| { echo "Error: no well-formed version of the module base $(MODULE_BASE_PKG) in $(VENDOR_DIR)/composer/installed.json"; exit 1; }; \
	printf '%s\n' "$$version" > $(MODULE_NAME)/vendor/$(MODULE_BASE_PKG)/VERSION

## Smoke-test the just-built distribution zip. Asserts required entries
## are present and forbidden ones absent. Suitable for CI on every push.
##   make dist && make dist-smoke
dist-smoke:
	@if [ ! -f $(MODULE_NAME).zip ]; then \
		echo "Error: $(MODULE_NAME).zip not found — run 'make dist' first"; \
		exit 1; \
	fi
	@build_commit=$$(unzip -z $(MODULE_NAME).zip | tail -n 1); \
	grep -Eq '^[0-9a-f]{40}$$' <<<"$$build_commit" || { echo "Error: the zip carries no build commit, run 'make dist' to stamp it"; exit 1; }
	@base_version=$$(unzip -p $(MODULE_NAME).zip vendor/$(MODULE_BASE_PKG)/VERSION 2>/dev/null); \
	[[ "$$base_version" =~ $(MODULE_BASE_VERSION_PATTERN) ]] \
		|| { echo "Error: the zip carries no well-formed module base version, run 'make dist' to record it"; exit 1; }
	@paths=$$(unzip -Z1 $(MODULE_NAME).zip); \
	for f in module.php LICENSE; do \
		grep -Fxq "$$f" <<<"$$paths" || { echo "Error: required file missing from zip: $$f"; exit 1; }; \
	done; \
	for prefix in \
		resources/js/$(JS_NAME)-[0-9] \
		vendor/magicsunday/webtrees-module-base/src/Contract/ \
		vendor/magicsunday/webtrees-module-base/src/Model/ \
		vendor/magicsunday/webtrees-module-base/src/Module/ \
		vendor/magicsunday/webtrees-module-base/src/Processor/ \
		$(foreach view,$(SHARED_VIEWS),vendor/magicsunday/webtrees-module-base/resources/views/$(view).phtml) \
	; do \
		grep -qE "^$$prefix" <<<"$$paths" || { echo "Error: required prefix has no entries in zip: $$prefix"; exit 1; }; \
	done; \
	if grep -qE '(^|/)composer\.json$$' <<<"$$paths"; then \
		echo "Error: composer.json found in zip"; exit 1; \
	fi; \
	if grep -qE '^assets/' <<<"$$paths"; then \
		echo "Error: assets/ found in zip"; exit 1; \
	fi; \
	if grep -qE '^dev/' <<<"$$paths"; then \
		echo "Error: dev/ found in zip"; exit 1; \
	fi; \
	if grep -qE '^\.githooks/' <<<"$$paths"; then \
		echo "Error: .githooks/ found in zip"; exit 1; \
	fi; \
	if grep -qE '^deptrac\.ya?ml$$' <<<"$$paths"; then \
		echo "Error: deptrac.yaml found in zip"; exit 1; \
	fi; \
	if grep -qE '(^|/)tsconfig\.json$$' <<<"$$paths"; then \
		echo "Error: tsconfig.json found in zip"; exit 1; \
	fi
	@module=$$(unzip -p $(MODULE_NAME).zip module.php); \
	grep -qF 'MagicSunday\\$(SCOPE_NS)\\Webtrees\\ModuleBase' <<<"$$module" \
		|| { echo "Error: module.php in zip is missing prefixed namespace ($(SCOPE_NS))"; exit 1; }; \
	if grep -qE 'MagicSunday\\{1,2}Webtrees\\{1,2}ModuleBase' <<<"$$module"; then \
		echo "Error: module.php in zip still contains unprefixed MagicSunday\\Webtrees\\ModuleBase"; \
		exit 1; \
	fi
	# Beyond the entry-list checks above: actually EXTRACT the zip and verify the
	# unpacked tree — module.php parses, key files are non-empty, the versioned JS
	# bundle is present and non-empty, and every bundled module-base src/ dir holds
	# real PHP files (a truncated/empty bundle or a missing namespace dir passes a
	# name-only listing but fails here).
	@tmp=$$(mktemp -d); trap '[ -n "$$tmp" ] && rm -rf "$$tmp"' EXIT; \
	unzip -q $(MODULE_NAME).zip -d "$$tmp" || { echo "Error: $(MODULE_NAME).zip failed to extract"; exit 1; }; \
	for f in module.php LICENSE; do \
		[ -s "$$tmp/$$f" ] || { echo "Error: $$f missing or empty in extracted zip"; exit 1; }; \
	done; \
	php -l "$$tmp/module.php" >/dev/null 2>&1 || { echo "Error: extracted module.php does not parse"; exit 1; }; \
	bundle=$$(ls "$$tmp"/resources/js/$(JS_NAME)-[0-9]*.min.js 2>/dev/null | head -1); \
	[ -s "$$bundle" ] || { echo "Error: versioned JS bundle missing or empty in extracted resources/js/"; exit 1; }; \
	for d in Contract Model Module Processor; do \
		files=$$(find "$$tmp/vendor/magicsunday/webtrees-module-base/src/$$d" -name '*.php' -print 2>/dev/null); \
		[ -n "$$files" ] \
			|| { echo "Error: bundled module-base src/$$d has no PHP files in extracted zip"; exit 1; }; \
	done; \
	if [ -n "$(strip $(SHARED_VIEWS))" ]; then \
		for v in $(SHARED_VIEWS); do \
			[ -s "$$tmp/vendor/magicsunday/webtrees-module-base/resources/views/$$v.phtml" ] \
				|| { echo "Error: bundled module-base view $$v is missing or empty in extracted zip"; exit 1; }; \
		done; \
		shared_views="$$tmp/vendor/magicsunday/webtrees-module-base/src/View/SharedViews.php"; \
		grep -qF "'$(SCOPE_VIEW_NS)'" "$$shared_views" \
			|| { echo "Error: bundled SharedViews.php does not register the scoped view namespace ($(SCOPE_VIEW_NS))"; exit 1; }; \
		if grep -qF "'webtrees-module-base'" "$$shared_views"; then \
			echo "Error: bundled SharedViews.php still registers the unscoped view namespace"; \
			exit 1; \
		fi; \
	fi
	@echo -e "${FGREEN} ✔${FRESET} dist-smoke passed: $(MODULE_NAME).zip extracts to a well-formed module"

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
	@echo -e "${FYELLOW}[1/6]${FRESET} Verifying — running the full CI test suite..."
	# Run the complete CI gate BEFORE mutating any tracked file, so a failing
	# test aborts with a clean working tree instead of a half-applied version
	# bump. npm ci first: ci:test's js:unit step needs node_modules present.
	# (build-js-fresh below wipes + reinstalls node_modules for the clean-room
	# build, so this install is intentionally separate, not a duplicate.)
	@npm ci
	@composer ci:test
	@echo -e "${FYELLOW}[2/6]${FRESET} Updating versions to $(VERSION)..."
	@$(call sed_edit,src/Module.php,"s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(VERSION)'/","CUSTOM_VERSION = '$(VERSION)'")
	@$(call jq_edit,package.json,.version = $$v,--arg v "$(VERSION)",.version == $$v)
	@$(call jq_edit,composer.json,.require["fisharebest/webtrees"] = $$v,--arg v "$(WEBTREES_CONSTRAINT)",.require["fisharebest/webtrees"] == $$v)
	@echo -e "${FYELLOW}[3/6]${FRESET} Cleaning + rebuilding JavaScript bundles..."
	# --ignore-scripts is required: npm 11 fires the package's "prepare" hook
	# even on --package-lock-only, but devDeps (rollup) aren't installed yet,
	# so the prepare script crashes with "rollup: not found". The actual build
	# happens in build-js-fresh below, which runs npm ci first.
	@npm install --package-lock-only --no-audit --no-fund --ignore-scripts
	@$(MAKE) build-js-fresh
	@echo -e "${FYELLOW}[4/6]${FRESET} Committing release commit..."
	@git add src/Module.php package.json composer.json package-lock.json resources/js/
	@git commit -m "Release $(VERSION)"
	@echo -e "${FYELLOW}[5/6]${FRESET} Building + smoke-testing distribution archive..."
	@$(MAKE) dist
	@$(MAKE) dist-smoke
	@echo -e "${FYELLOW}[6/6]${FRESET} Tagging $(VERSION)..."
	# Signed annotated tag with a message. Without -m git opens an editor, which
	# cannot run in the buildbox, and -s fails the step if the signature fails.
	@git tag -a -s $(VERSION) -m "$(VERSION)"
	@echo -e "${FGREEN} ✔${FRESET} Release $(VERSION) prepared"

# The inline note as written, handed to the shell through NOTES_RAW. NOTES itself is
# unexported in the Makefile, because make expands an exported variable, which would
# lose a dollar sign in the note and run a $(shell ...) in it. A sub-make has no NOTES
# of the environment, so it keeps the NOTES_RAW it inherited. A top-level run ignores
# any NOTES_RAW of its environment.
export NOTES_RAW := $(or $(value NOTES),$(if $(filter-out 0,$(MAKELEVEL)),$(value NOTES_RAW)))

## Publish: push, create GitHub release with zip.
## Pass NOTES_FILE=path for release notes from a file (recommended for multi-line notes).
## Pass NOTES="..." for a short inline note, or omit both for auto-generated notes.
## Once make has received the inline note, backticks, quotes and dollar signs arrive in
## the release as written, and neither make nor the shell runs anything from it. Quote
## the note with single quotes in the calling shell, which evaluates a command
## substitution inside double quotes before make sees it. Make drops leading whitespace
## of a note given on the command line, so use NOTES_FILE or the environment for it.
## Example: make release 3.1.1 NOTES_FILE=/tmp/release-notes.md
## Example: make release 3.1.1 NOTES="Bug fix release"
##
## A standard "Manual installation" warning banner is always prepended so users
## see which asset to download (and not the auto-generated "Source code (zip)").
##
## Recovery: the branch and the tag are pushed before the release is created, and the
## immutable-tags ruleset makes a published tag impossible to remove. When the release
## creation fails afterwards, run the same target again. Pushing the same tag again
## changes nothing on the remote, the archive is kept until the release exists, and an
## interrupted upload leaves a draft release without the asset, which the rerun removes
## before it creates the release. A release that is already published is never touched,
## the rerun stops there. A lookup that fails counts as no release, so that the first
## publish of a version, which has no release to find, goes on.
release-publish:
	@if ! echo "$(VERSION)" | grep -qE '$(RELEASE_VERSION_PATTERN)'; then \
		echo "$(RELEASE_VERSION_ERROR), nothing was pushed."; \
		exit 1; \
	fi
	@if [ ! -f $(MODULE_NAME).zip ]; then \
		echo "Error: $(MODULE_NAME).zip not found. Run 'make dist' on the tagged commit $(VERSION), then 'make dist-smoke', nothing was pushed."; \
		exit 1; \
	fi
	@if [ -n "$(NOTES_FILE)" ] && [ ! -f "$(NOTES_FILE)" ]; then \
		echo "Error: NOTES_FILE=$(NOTES_FILE) does not exist"; \
		exit 1; \
	fi
	# The archive is built from the commit that dist resolved at its start. It belongs to the release only when
	# HEAD is the commit that the tag points at and the archive was built on that commit. An archive built on
	# another commit would be published under the tag of the tagged commit.
	@tag_commit=$$(git rev-parse --verify --quiet "refs/tags/$(VERSION)^{commit}") || { \
		echo "Error: the tag $(VERSION) does not exist, nothing was pushed."; \
		exit 1; \
	}; \
	if [ "$$(git rev-parse HEAD)" != "$$tag_commit" ]; then \
		echo "Error: HEAD is not the commit that the tag $(VERSION) points at, so the archive would not match the tag."; \
		echo "Check out the tagged commit, rebuild the archive there with 'make dist' and run 'make dist-smoke', nothing was pushed."; \
		exit 1; \
	fi; \
	archive_commit=$$(unzip -z $(MODULE_NAME).zip | tail -n 1); \
	if [ "$$archive_commit" != "$$tag_commit" ]; then \
		echo "Error: the archive was not built on the commit that the tag $(VERSION) points at."; \
		echo "Rebuild the archive on the tagged commit with 'make dist' and run 'make dist-smoke', nothing was pushed."; \
		exit 1; \
	fi
	@echo -e "${FYELLOW}[publish]${FRESET} Pushing to GitHub..."
	# Name the release tag explicitly and switch off implicit tag following. --tags
	# and push.followTags would also publish other local tags, and the immutable-tags
	# ruleset makes a published tag impossible to remove.
	@git push --no-follow-tags origin main refs/tags/$(VERSION)
	# Stop at the first failing command and remove the notes file on every exit, so a
	# failed gh call fails the target instead of being masked by the cleanup.
	@set -e; \
	notes_tmp=$$(mktemp); \
	trap 'rm -f "$$notes_tmp"' EXIT; \
	{ \
		echo "> [!IMPORTANT]"; \
		echo "> **Manual / FTP installation:** download the asset **\`$(MODULE_NAME).zip\`** from the **Assets** section below — *not* the GitHub-generated **\"Source code (zip)\"**. The \"Source code\" archives don't include the bundled vendor library and will fail with \`Interface … not found\` when uploaded to \`modules_v4/\`."; \
		echo ""; \
	} > "$$notes_tmp"; \
	if [ -n "$(NOTES_FILE)" ]; then \
		echo "  Notes: from file $(NOTES_FILE)"; \
		cat "$(NOTES_FILE)" >> "$$notes_tmp"; \
	elif [ -n "$$NOTES_RAW" ]; then \
		echo "  Notes: inline"; \
		printf '%s\n' "$$NOTES_RAW" >> "$$notes_tmp"; \
	else \
		echo "  Notes: auto-generated by GitHub"; \
		repo=$$(gh repo view --json nameWithOwner --jq '.nameWithOwner'); \
		gh api -X POST "repos/$$repo/releases/generate-notes" \
			-f tag_name=$(VERSION) \
			-f target_commitish=main \
			--jq '.body' >> "$$notes_tmp"; \
	fi; \
	state=$$(gh release view $(VERSION) --json isDraft --jq .isDraft 2>/dev/null) || state=; \
	case "$$state" in \
		true) \
			echo "  Removing the draft that an earlier attempt left behind"; \
			gh release delete $(VERSION) --yes ;; \
		false) \
			echo "Error: the release $(VERSION) is already published, nothing to do."; \
			exit 1 ;; \
	esac; \
	gh release create $(VERSION) \
		--title "$(VERSION)" \
		--notes-file "$$notes_tmp" \
		--target main \
		$(MODULE_NAME).zip
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
	@if ! echo "$(VERSION)" | grep -qE '$(RELEASE_VERSION_PATTERN)'; then \
		echo "$(RELEASE_VERSION_ERROR)"; \
		exit 1; \
	fi
	@$(eval NEXT := $(shell echo "$(VERSION)" | awk -F. '{print $$1"."$$2"."$$3+1}'))
	@echo -e "${FYELLOW}[bump]${FRESET} Bumping to $(NEXT)-dev..."
	@$(call sed_edit,src/Module.php,"s/CUSTOM_VERSION = '.*'/CUSTOM_VERSION = '$(NEXT)-dev'/","CUSTOM_VERSION = '$(NEXT)-dev'")
	@$(call jq_edit,package.json,.version = $$v,--arg v "$(NEXT)-dev",.version == $$v)
	@$(call jq_edit,composer.json,.require["fisharebest/webtrees"] = $$v,--arg v "$(WEBTREES_CONSTRAINT)",.require["fisharebest/webtrees"] == $$v)
	# --ignore-scripts is required: npm 11 fires the package's "prepare" hook
	# even on --package-lock-only, but devDeps (rollup) aren't installed yet,
	# so the prepare script crashes with "rollup: not found". The actual build
	# happens in build-js-fresh below, which runs npm ci first.
	@npm install --package-lock-only --no-audit --no-fund --ignore-scripts
	@$(MAKE) build-js-fresh
	@git add src/Module.php package.json composer.json package-lock.json resources/js/
	@git commit -m "Bump version to $(NEXT)-dev"
	@git push --no-follow-tags origin main
	@echo -e "${FGREEN} ✔${FRESET} Version bumped to $(NEXT)-dev"

## Remove leftover release artifacts
release-clean:
	@rm -rf $(MODULE_NAME)/ $(MODULE_NAME).zip $(MODULE_NAME).zip.tmp $(MODULE_NAME).commit
	@rm -f composer.json.tmp package.json.tmp

## Recover from a failed release-prepare. Removes freshly-built versioned
## bundles, restores the tracked files release-prepare mutates (version strings
## + the bundle that clean-js may have git-rm'd) from HEAD, and clears build
## artifacts. It does NOT undo a release commit or tag — if release-prepare got
## that far, the printed hints show how to unwind those manually (kept manual
## to avoid destroying work).
release-recover:
	# Restore ONLY what release-prepare mutates: the version strings and the
	# versioned bundle. Both the rm (untracked fresh build + on-disk copy of the
	# tracked bundle) and the checkout are scoped to the $(JS_NAME)-* pattern, so
	# uncommitted edits to source under resources/js/modules|tests are neither
	# deleted nor reverted (a directory-wide git clean/checkout would do both).
	@rm -f resources/js/$(JS_NAME)-*.js resources/js/$(JS_NAME)-*.min.js
	@git checkout HEAD -- src/Module.php package.json composer.json package-lock.json 2>/dev/null || true
	# Two separate checkouts, each tolerant of its own empty glob: a single
	# `git checkout -- <glob1> <glob2>` aborts entirely if EITHER pattern
	# matches nothing in HEAD (e.g. a module that ships only a non-min bundle),
	# silently leaving the bundle unrestored under the trailing `|| true`.
	@git checkout HEAD -- resources/js/$(JS_NAME)-*.js 2>/dev/null || true
	@git checkout HEAD -- resources/js/$(JS_NAME)-*.min.js 2>/dev/null || true
	@$(MAKE) release-clean
	@echo -e "${FGREEN} ✔${FRESET} Restored release files + removed build artifacts."
	@if git log -1 --pretty=%s 2>/dev/null | grep -qE '^Release [0-9]+\.[0-9]+\.[0-9]+$$'; then \
		echo "Note: HEAD is a 'Release' commit — if unpushed, undo it with:"; \
		echo "  git reset --soft HEAD~1"; \
	fi
	@echo "If a tag was created, remove it with: git tag -d <VERSION>"

## Dry run — rehearse the whole build pipeline WITHOUT committing, tagging,
## pushing or publishing, then restore the working tree. Validates exactly the
## steps that historically broke a release (toolchain provisioning, the full
## ci:test gate, the clean-room rollup build incl. chart-lib dist, the dist zip
## and its smoke test). Needs no VERSION and no gh auth, and pushes and publishes
## nothing. The composer and npm steps use the package registries, so run it online.
##   make release-dry-run
# No release-bootstrap PREREQUISITE: the guards below must abort BEFORE any
# provisioning work, so a dirty tree / active symlink fails fast. Bootstrap is
# invoked from the recipe once the guards have passed.
release-dry-run:
	@echo -e "${FYELLOW}[dry-run]${FRESET} Release rehearsal — NO commit, tag, push or publish."
	# Guard like release-check (minus VERSION/gh): the rehearsal rebuilds and then
	# REVERTS the JS bundle, and build-js-fresh wipes node_modules — so on a dirty
	# tree it would discard uncommitted work, and an active link-base / link-chart-lib
	# symlink would be destroyed. Refuse to run unless the tree is clean + unlinked.
	@if [ -n "$$(git status --porcelain --untracked-files=no)" ]; then \
		echo "Error: working tree not clean — commit or stash first (the dry run rebuilds and then reverts the JS bundle)."; \
		exit 1; \
	fi
	@if [ -L $(MODULE_BASE_PATH) ]; then \
		echo "Error: $(MODULE_BASE_PATH) is a symlink (active 'make link-base'). Run 'make unlink-base' first."; \
		exit 1; \
	fi
	@if [ -L node_modules/@magicsunday/webtrees-chart-lib ]; then \
		echo "Error: node_modules/@magicsunday/webtrees-chart-lib is a symlink (active 'make link-chart-lib'); build-js-fresh would destroy it. Run 'make unlink-chart-lib' first."; \
		exit 1; \
	fi
	@if [ -d node_modules ] && [ -n "$$(find node_modules ! -uid $$(id -u) -print 2>/dev/null | head -n 1)" ]; then \
		echo "Error: node_modules contains files not owned by the current user."; \
		echo "Files that a run as root left behind are the usual cause, and the dry run"; \
		echo "cannot remove them, aborting build-js-fresh mid-way. Remove the tree and"; \
		echo "install it again as the calling user:  make clean && make install"; \
		exit 1; \
	fi
	@$(MAKE) release-bootstrap
	# Run the rehearsal capturing its own status, then ALWAYS restore the tree, and
	# exit with the rehearsal's status. A cleanup failure must not mask a failed run
	# (nor a passing run a failed cleanup), and the closing message must tell the
	# truth. `.build/vendor` is left at --no-dev by `dist`; the next release-bootstrap
	# re-provisions it on demand.
	@rc=0; { \
		echo -e "${FYELLOW}[dry-run 1/4]${FRESET} Running the full CI test suite..." && \
		npm ci && \
		composer ci:test && \
		echo -e "${FYELLOW}[dry-run 2/4]${FRESET} Clean-room JavaScript build..." && \
		$(MAKE) build-js-fresh && \
		echo -e "${FYELLOW}[dry-run 3/4]${FRESET} Building distribution archive..." && \
		$(MAKE) dist && \
		echo -e "${FYELLOW}[dry-run 4/4]${FRESET} Smoke-testing the archive..." && \
		$(MAKE) dist-smoke; \
	} || rc=$$?; \
	$(MAKE) release-recover || true; \
	dirty=$$(git status --porcelain --untracked-files=no); \
	if [ "$$rc" -ne 0 ]; then \
		echo -e "${FRED} ✘${FRESET} Dry run FAILED (rc=$$rc) — attempted to restore the working tree."; \
		if [ -n "$$dirty" ]; then echo "   note: tracked files still differ — run 'make release-recover'."; fi; \
		exit $$rc; \
	elif [ -n "$$dirty" ]; then \
		echo -e "${FRED} ✘${FRESET} Rehearsal passed but the working tree is NOT clean after restore — run 'make release-recover':"; \
		git status --short; \
		exit 1; \
	else \
		echo -e "${FGREEN} ✔ Dry run complete — the release would succeed. Working tree restored.${FRESET}"; \
	fi

## Full release pipeline
release: release-prepare release-publish release-bump release-clean ## Create and publish a release (usage: make release 3.1.0)
	@echo ""
	@echo -e "${FGREEN} ✔ Release $(VERSION) complete!${FRESET}"
