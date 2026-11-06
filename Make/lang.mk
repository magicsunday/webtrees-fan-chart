# =============================================================================
# TARGETS
# =============================================================================

#### Language & Translations

.PHONY: lang lang-check setup-hooks lang-extract lang-merge lang-resolve-fuzzy lang-compile lang-core-owned

# Locales the module ships translations for. Auto-discovered from the
# existing per-locale directories rather than a hardcoded list — a
# community pull request that adds resources/lang/<new>/messages.po is
# picked up by `make lang` with no Makefile edit. A directory created
# without a PO is seeded from the POT by lang-merge.
LOCALES := $(notdir $(patsubst %/,%,$(wildcard resources/lang/*/)))

# The package name from composer.json, without the vendor, so this file stays
# byte-identical across the modules and does not depend on the checkout
# directory, which is /app in the CI container. It feeds the POT header, and
# a versioned POT passes it on to the headers of the PO files.
MODULE_NAME := $(shell sed -n 's/.*"name": *"[^/"]*\/\([^"]*\)".*/\1/p' composer.json | head -n 1)

POT_FILE  := resources/lang/messages.pot
PO_FILES  := $(foreach loc,$(LOCALES),resources/lang/$(loc)/messages.po)
MO_FILES  := $(PO_FILES:.po=.mo)

# The texts webtrees core already owns. webtrees merges the compiled catalogue
# of a module over its own, so a catalogue entry for a text that core translates
# as well would replace the core wording in the whole installation. When the
# list exists, xgettext leaves these texts out of the POT, so no catalogue holds
# them and no translation tool offers them. The list is the intersection of the
# core POT files of the releases named in CORE_RELEASES, rebuilt by
# `lang-core-owned`. A module that wants the list sets CORE_RELEASES in its
# Makefile, above the include of Make/*.mk. The first release is the floor of the
# webtrees constraint of composer.json, and a release core ships later is added.
# A module without the file and without CORE_RELEASES ignores all of this.
CORE_OWNED    ?= dev/core-owned.pot
CORE_RELEASES ?=

# Full pipeline: extract POT → merge into every locale (seeding a missing PO)
# → auto-resolve fuzzy entries that only differ in punctuation → compile every
# PO to a MO. The stages are chained as a dependency LINE (compile →
# resolve-fuzzy → merge → extract), not as sibling prerequisites, so `make -j`
# (or an inherited parallel MAKEFLAGS) cannot run compile before merge or let
# the fuzzy resolver rewrite a PO while it is being compiled — a stale or
# corrupt MO despite a green exit.
lang: .logo lang-compile ## Extract POT, merge PO, auto-resolve fuzzy, compile MO (full i18n pipeline).
	@echo "  ✔ Translations up to date for: $(LOCALES)"

lang-extract: $(POT_FILE) ## Extract translatable strings from src/ + resources/ into the POT.

# Rebuild the list of core-owned texts from a git checkout of webtrees:
# `make lang-core-owned CORE=/path/to/webtrees`. Run it when CORE_RELEASES
# changes, then `make lang` to drop the texts the new list covers. A Composer
# install holds a single webtrees release while the list needs all of them, so
# this cannot run in CI and the committed file is what the freshness gate checks
# `make lang` against.
lang-core-owned: ## Rebuild dev/core-owned.pot from a webtrees git checkout (CORE=/path/to/webtrees).
	@test -n "$(CORE_RELEASES)" || { echo "  ✘ name the core releases in CORE_RELEASES first"; exit 1; }
	@test -n "$(CORE)" || { echo "  ✘ pass CORE=<path to a webtrees git checkout>"; exit 1; }
	@git -C "$(CORE)" rev-parse --git-dir >/dev/null 2>&1 || { echo "  ✘ CORE is not a git checkout"; exit 1; }
	@for tag in $(CORE_RELEASES); do \
		git -C "$(CORE)" rev-parse --verify --quiet "refs/tags/$$tag" >/dev/null || { echo "  ✘ the checkout lacks the tag $$tag"; exit 1; }; \
	done
	@grep -qF '"fisharebest/webtrees": "~$(firstword $(CORE_RELEASES))"' composer.json || { echo "  ✘ CORE_RELEASES does not match the webtrees constraint of composer.json"; exit 1; }
	@rm -rf .build/core-pots && mkdir -p .build/core-pots
	@for tag in $(CORE_RELEASES); do \
		git -C "$(CORE)" show "$$tag:resources/lang/webtrees.pot" > ".build/core-pots/$$tag.pot" || exit 1; \
	done
	@$(COMPOSE_RUN_USER) sh -c 'set -eu; \
		msgcomm --no-location --sort-output --more-than=$$(( $(words $(CORE_RELEASES)) - 1 )) .build/core-pots/*.pot --output-file=.build/core-owned.pot'
	@mkdir -p $(dir $(CORE_OWNED))
	@cat .build/core-owned.pot > $(CORE_OWNED)
	@echo "  ✔ $(CORE_OWNED) rebuilt ($$(grep -c '^msgid ".' $(CORE_OWNED)) texts)"

# xgettext walks every PHP / PHTML source for the I18N::translate
# family. The keyword list mirrors webtrees core's helpers — adding a
# new context-aware variant means extending this list. The POT-Creation-Date
# timestamp is then pinned to a fixed sentinel: xgettext stamps "now",
# which msgmerge would otherwise copy into every PO header on each run,
# producing a spurious diff. Pinning it keeps the catalogue byte-stable so
# the CI diff-gate fires only on real string drift. The trailing `\n"` of
# the header line is left untouched (the regex stops at the timestamp).
$(POT_FILE): $(wildcard $(CORE_OWNED)) $(shell find src resources/views -type f \( -name '*.php' -o -name '*.phtml' \) 2>/dev/null)
	@$(COMPOSE_RUN_USER) sh -c 'set -eu; \
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
			$(if $(wildcard $(CORE_OWNED)),--exclude-file=$(CORE_OWNED)) \
			--output=$(POT_FILE) \
			$$(find src resources/views -type f \( -name "*.php" -o -name "*.phtml" \) | sort) && \
		sed -i "s/POT-Creation-Date: [0-9-]* [0-9:+-]*/POT-Creation-Date: 1970-01-01 00:00+0000/" $(POT_FILE) && \
		echo "  ✔ Extracted $(POT_FILE) ($$(grep -c ^msgid $(POT_FILE)) strings)"'

# The follow-up `msgattrib --no-obsolete` pass drops `#~` entries whose
# msgid left the source rather than letting them accumulate in the
# catalogue (msgmerge itself only marks them obsolete); git history
# retains them if a removed string ever needs its old translation back.
# A reworded msgid is fuzzy-matched and its translation carried over as
# fuzzy (kept for review), not lost. A locale directory without a PO is
# seeded from the POT.
lang-merge: lang-extract ## Update each locale's PO from the latest POT (drops obsolete entries, seeds missing locales).
	@$(COMPOSE_RUN_USER) sh -c 'set -eu; \
		for loc in $(LOCALES); do \
			po="resources/lang/$$loc/messages.po"; \
			if [ ! -f "$$po" ]; then \
				msginit --no-translator --locale="$$loc" --input=$(POT_FILE) --output-file="$$po" >/dev/null && \
					echo "  + Seeded $$po from POT" && \
					echo "    note: for a region/script tag (e.g. en-US, zh-Hans) msginit leaves the" && \
					echo "    Plural-Forms placeholder — set nplurals/plural once by hand; msgmerge preserves it." || exit 1; \
			else \
				msgmerge --quiet --previous --update --backup=none "$$po" $(POT_FILE) && \
					msgattrib --no-obsolete --output-file="$$po" "$$po" && \
					echo "  ↻ Merged $$po" || exit 1; \
			fi; \
		done'

# Resolves the fuzzy entries msgmerge left behind whose source text only
# changed in punctuation or whitespace, with the resolve-fuzzy binary of
# magicsunday/webtrees-module-base. Every other fuzzy entry stays fuzzy and is
# listed for a person to judge, consistent with the shared i18n CI check where
# fuzzy is advisory. A catalogue the resolver refuses fails the recipe.
# The binary is PHP and the tooling image carries PHP and Composer. The Composer
# install runs only in a checkout without a vendor directory, which is the CI
# case, as the calling user like every lang recipe. It installs the development
# packages as well, because a module may require module-base only as one. A
# checkout that has a vendor directory is left alone and the recipe stops with
# the command that brings the binary in. Platform checks and security blocking
# are off, a translation run must not fail on them.
lang-resolve-fuzzy: lang-merge ## Auto-resolve fuzzy entries that only differ in punctuation, with the shared resolve-fuzzy binary.
	@$(COMPOSE_RUN_USER) sh -c 'set -eu; \
		[ -x .build/bin/resolve-fuzzy ] || [ -e .build/vendor ] || { \
			COMPOSER_NO_BLOCKING=1 composer install --no-interaction --no-progress --no-scripts --no-plugins --ignore-platform-reqs --quiet; \
		}; \
		[ -x .build/bin/resolve-fuzzy ] || { \
			echo "  ✘ .build/bin/resolve-fuzzy is missing, run composer update magicsunday/webtrees-module-base in the buildbox"; \
			exit 1; \
		}; \
		.build/bin/resolve-fuzzy $(POT_FILE) $(PO_FILES)'

lang-compile: lang-resolve-fuzzy ## Compile every messages.po to its sibling messages.mo.
	@$(COMPOSE_RUN_USER) sh -c 'set -eu; \
		for po in resources/lang/*/messages.po; do \
			[ -f "$$po" ] || continue; \
			dir=$$(dirname "$$po"); \
			msgfmt -o "$$dir/messages.mo" "$$po" && \
				echo "  ✔ Compiled $$po" || exit 1; \
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
