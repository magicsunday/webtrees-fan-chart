# =============================================================================
# TARGETS
# =============================================================================

#### Language & Translations

.PHONY: lang lang-extract lang-merge lang-resolve-fuzzy lang-compile

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
		sed -i "s/POT-Creation-Date: [0-9-]* [0-9:+]*/POT-Creation-Date: 1970-01-01 00:00+0000/" $(POT_FILE) && \
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

# Heuristic resolver for entries msgmerge marked fuzzy due to trivial
# punctuation drift (em-dash ↔ middle dot, comma/period swap, whitespace,
# "Dekade" ↔ "Jahrzehnt" in DE). German-tuned: for other languages it
# leaves the fuzzy flag for community review, consistent with the shared
# i18n CI check where fuzzy is advisory. Idempotent: a clean PO is a no-op.
lang-resolve-fuzzy: ## Auto-resolve fuzzy entries with trivial punctuation diffs in the new msgid.
	@python3 dev/fuzzy-resolver.py

lang-compile: ## Compile every messages.po to its sibling messages.mo.
	@$(COMPOSE_RUN) sh -c 'apk add --no-cache gettext >/dev/null 2>&1; \
		for po in resources/lang/*/messages.po; do \
			dir=$$(dirname "$$po"); \
			msgfmt -o "$$dir/messages.mo" "$$po" && \
				echo "  ✔ Compiled $$po"; \
		done'
