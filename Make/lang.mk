# =============================================================================
# TARGETS
# =============================================================================

#### Language & Translations

.PHONY: lang

lang: .logo ## Compile .po translation files to .mo files.
	@$(COMPOSE_RUN) sh -c 'apk add --no-cache gettext >/dev/null 2>&1; \
		for po in resources/lang/*/messages.po; do \
			dir=$$(dirname "$$po"); \
			msgfmt -o "$$dir/messages.mo" "$$po" && \
			echo "  ✔ Compiled $$po"; \
		done'
