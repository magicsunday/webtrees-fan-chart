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
	@rm -rf "$(MODULE_BASE_VENDOR)"
	@ln -s "$$(cd $(MODULE_BASE_CLONE) && pwd)" "$(MODULE_BASE_VENDOR)"
	@echo -e "${FGREEN} ✔${FRESET} Symlinked $(MODULE_BASE_VENDOR) → $$(cd $(MODULE_BASE_CLONE) && pwd)"
	@echo -e "${FYELLOW}   Note:${FRESET} composer install/update will replace this symlink with a fresh checkout."

unlink-base: .logo ## Remove the module-base dev symlink; print how to restore the composer checkout.
	@if [ ! -L "$(MODULE_BASE_VENDOR)" ]; then \
		if [ -e "$(MODULE_BASE_VENDOR)" ]; then \
			echo -e "${FYELLOW} ⚠${FRESET} $(MODULE_BASE_VENDOR) is a real checkout, not a symlink — leaving it untouched."; \
		else \
			echo -e "${FYELLOW} ⚠${FRESET} $(MODULE_BASE_VENDOR) does not exist — nothing to unlink."; \
		fi; \
	else \
		rm -f "$(MODULE_BASE_VENDOR)"; \
		echo -e "${FGREEN} ✔${FRESET} Removed the dev symlink $(MODULE_BASE_VENDOR)."; \
		echo -e "${FYELLOW}   Restore the composer checkout by running composer install for this module"; \
		echo -e "   through the webtrees buildbox (these repos ship no PHP/composer container of their own).${FRESET}"; \
	fi
