# =============================================================================
# TARGETS
# =============================================================================

#### Language & Translations

.PHONY: lang lang-check setup-hooks lang-extract lang-merge lang-resolve-fuzzy lang-compile

# Locales the module ships translations for. Auto-discovered from the
# existing per-locale directories rather than a hardcoded list — a
# community pull request that adds resources/lang/<new>/messages.po is
# picked up by `make lang` with no Makefile edit.
LOCALES := $(notdir $(patsubst %/,%,$(wildcard resources/lang/*/)))

# Derived from the checkout directory so this file stays byte-identical
# across the chart modules. Only feeds the gitignored POT header, never
# a committed PO header (msgmerge keeps each PO's own Project-Id-Version).
MODULE_NAME := $(notdir $(CURDIR))

POT_FILE  := resources/lang/messages.pot
PO_FILES  := $(foreach loc,$(LOCALES),resources/lang/$(loc)/messages.po)
MO_FILES  := $(PO_FILES:.po=.mo)

# Full pipeline: extract POT → merge into every existing locale →
# auto-resolve fuzzy entries that only differ in punctuation → compile
# every PO to a MO.
lang: .logo lang-extract lang-merge lang-resolve-fuzzy lang-compile ## Extract POT, merge PO, auto-resolve fuzzy, compile MO (full i18n pipeline).
	@echo "  ✔ Translations up to date for: $(LOCALES)"

lang-extract: $(POT_FILE) ## Extract translatable strings from src/ + resources/ into the POT.

# xgettext walks every PHP / PHTML source for the I18N::translate
# family. The keyword list mirrors webtrees core's helpers — adding a
# new context-aware variant means extending this list. The POT-Creation-Date
# timestamp is then pinned to a fixed sentinel: xgettext stamps "now",
# which msgmerge would otherwise copy into every PO header on each run,
# producing a spurious diff. Pinning it keeps the catalogue byte-stable so
# the CI diff-gate fires only on real string drift. The trailing `\n"` of
# the header line is left untouched (the regex stops at the timestamp).
$(POT_FILE): $(shell find src resources/views -type f \( -name '*.php' -o -name '*.phtml' \) 2>/dev/null)
	@$(COMPOSE_RUN) sh -c 'apk add --no-cache gettext >/dev/null 2>&1; \
		mkdir -p resources/lang; \
		xgettext \
			--language=PHP \
			--from-code=UTF-8 \
			--keyword=translate \
			--keyword=translateContext:1c,2 \
			--keyword=plural:1,2 \
			--add-comments=I18N \
			--package-name="$(MODULE_NAME)" \
			--copyright-holder="Rico Sonntag" \
			--msgid-bugs-address="https://github.com/magicsunday/$(MODULE_NAME)/issues" \
			--sort-output \
			--output=$(POT_FILE) \
			$$(find src resources/views -type f \( -name "*.php" -o -name "*.phtml" \) | sort) && \
		sed -i "s/POT-Creation-Date: [0-9-]* [0-9:+-]*/POT-Creation-Date: 1970-01-01 00:00+0000/" $(POT_FILE) && \
		echo "  ✔ Extracted $(POT_FILE) ($$(grep -c ^msgid $(POT_FILE)) strings)"'

# The follow-up `msgattrib --no-obsolete` pass drops `#~` entries whose
# msgid left the source rather than letting them accumulate in the
# catalogue (msgmerge itself only marks them obsolete); git history
# retains them if a removed string ever needs its old translation back.
# A reworded msgid is fuzzy-matched and its translation carried over as
# fuzzy (kept for review), not lost.
lang-merge: $(POT_FILE) ## Update each locale's PO from the latest POT (drops obsolete entries).
	@$(COMPOSE_RUN) sh -c 'apk add --no-cache gettext >/dev/null 2>&1; \
		for loc in $(LOCALES); do \
			po="resources/lang/$$loc/messages.po"; \
			[ -f "$$po" ] || continue; \
			msgmerge --quiet --previous --update --backup=none "$$po" $(POT_FILE) && \
				msgattrib --no-obsolete --output-file="$$po" "$$po" && \
				echo "  ↻ Merged $$po"; \
		done'

# Resolves the fuzzy entries msgmerge left behind whose source text only
# changed in punctuation or whitespace, with the resolve-fuzzy binary of
# magicsunday/webtrees-module-base. Every other fuzzy entry stays fuzzy and is
# listed for a person to judge, consistent with the shared i18n CI check where
# fuzzy is advisory. A catalogue the resolver refuses fails the recipe.
# The binary is PHP, so the recipe installs PHP and Composer on demand, like the
# gettext tools above. The Composer install runs only in a checkout without a
# vendor directory, which is the CI case, and hands its files back to the owner
# of the checkout, also when it fails, so the root user of the container leaves
# nothing behind that blocks a later Composer run on the host. A checkout that
# has a vendor directory is left alone, it holds the dev packages, and the recipe
# stops with the command that brings the binary in. Platform checks and security
# blocking are off, a translation run must not fail on them. The PHP package
# names follow the PHP release of the Alpine image.
lang-resolve-fuzzy: lang-merge ## Auto-resolve fuzzy entries that only differ in punctuation, with the shared resolve-fuzzy binary.
	@$(COMPOSE_RUN) sh -c 'set -eu; \
		command -v msgmerge >/dev/null 2>&1 || apk add --no-cache gettext >/dev/null 2>&1; \
		command -v php >/dev/null 2>&1 || { \
			apk add --no-cache composer php85 php85-ctype php85-curl php85-dom php85-iconv php85-intl php85-mbstring php85-openssl php85-phar php85-simplexml php85-tokenizer php85-xml php85-xmlwriter php85-zip >/dev/null 2>&1; \
			ln -s /usr/bin/php85 /usr/local/bin/php; \
		}; \
		[ -x .build/bin/resolve-fuzzy ] || [ -e .build/vendor ] || { \
			trap "chown -R $$(stat -c %u:%g .) .build composer.lock 2>/dev/null || true" EXIT; \
			COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_NO_BLOCKING=1 composer install --no-dev --no-interaction --no-progress --no-scripts --no-plugins --ignore-platform-reqs --quiet; \
		}; \
		[ -x .build/bin/resolve-fuzzy ] || { \
			echo "  ✘ .build/bin/resolve-fuzzy is missing, run composer update magicsunday/webtrees-module-base in the buildbox"; \
			exit 1; \
		}; \
		.build/bin/resolve-fuzzy $(POT_FILE) $(PO_FILES)'

lang-compile: ## Compile every messages.po to its sibling messages.mo.
	@$(COMPOSE_RUN) sh -c 'apk add --no-cache gettext >/dev/null 2>&1; \
		for po in resources/lang/*/messages.po; do \
			dir=$$(dirname "$$po"); \
			msgfmt -o "$$dir/messages.mo" "$$po" && \
				echo "  ✔ Compiled $$po"; \
		done'

setup-hooks: ## Activate the tracked .githooks/ directory for this clone.
	@git config core.hooksPath .githooks && \
		echo "  ✔ core.hooksPath = .githooks (pre-commit gate active)"

lang-check: lang ## Fail if the committed catalogue is stale (local mirror of the CI Pipeline-freshness gate); the pre-push hook runs this.
	@if [ -n "$$(git status --porcelain -- resources/lang)" ]; then \
		echo "  ✘ catalogue stale — run 'make lang' and commit the result:"; \
		git status --porcelain -- resources/lang; \
		exit 1; \
	fi; \
	echo "  ✔ catalogue fresh — make lang is a no-op"
