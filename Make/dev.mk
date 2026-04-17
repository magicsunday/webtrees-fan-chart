# =============================================================================
# Local development helpers
# =============================================================================

#### Local development

.PHONY: link-base unlink-base

# Path to the sibling dev clone of webtrees-module-base.
# Adjust if your clone lives elsewhere.
MODULE_BASE_CLONE := ../webtrees-module-base

# Path inside this module where composer installs module-base.
MODULE_BASE_VENDOR := .build/vendor/magicsunday/webtrees-module-base

link-base: .logo ## Symlink .build/vendor/.../webtrees-module-base to the sibling dev clone for live editing.
	@if [ ! -d "$(MODULE_BASE_CLONE)" ]; then \
		echo -e "${FRED} ✘${FRESET} Expected sibling clone at $(MODULE_BASE_CLONE)"; \
		exit 1; \
	fi
	@rm -rf $(MODULE_BASE_VENDOR)
	@ln -s "$$(cd $(MODULE_BASE_CLONE) && pwd)" $(MODULE_BASE_VENDOR)
	@echo -e "${FGREEN} ✔${FRESET} Symlinked $(MODULE_BASE_VENDOR) → $$(cd $(MODULE_BASE_CLONE) && pwd)"
	@echo -e "${FYELLOW}   Note:${FRESET} composer install/update will replace this symlink with a fresh checkout."

unlink-base: .logo ## Restore .build/vendor/.../webtrees-module-base from composer.
	@rm -rf $(MODULE_BASE_VENDOR)
	@$(COMPOSE_RUN) composer install --quiet
	@echo -e "${FGREEN} ✔${FRESET} Restored $(MODULE_BASE_VENDOR) from composer."
