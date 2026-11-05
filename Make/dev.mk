# =============================================================================
# Local development helpers
# =============================================================================

#### Local development

.PHONY: link-base unlink-base link-chart-lib unlink-chart-lib

# Path to the sibling dev clone of webtrees-module-base.
# Adjust if your clone lives elsewhere.
MODULE_BASE_CLONE := ../webtrees-module-base

# Path inside this module where composer installs module-base.
MODULE_BASE_VENDOR := .build/vendor/magicsunday/webtrees-module-base

# Path to the sibling dev clone of webtrees-chart-lib.
CHART_LIB_CLONE := ../webtrees-chart-lib

# Path inside this module where npm installs @magicsunday/webtrees-chart-lib.
CHART_LIB_NODE := node_modules/@magicsunday/webtrees-chart-lib

# Relative-path target for the chart-lib symlink. Must be resolvable both
# on the host (where rollup.config.js sits) and inside the node compose
# container (which mounts `../webtrees-chart-lib:/webtrees-chart-lib` and
# `./:/app` so a host-absolute target would not exist in-container).
# node_modules/@magicsunday/<this-link> → ../../../webtrees-chart-lib
CHART_LIB_SIBLING := ../../../webtrees-chart-lib

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

link-chart-lib: .logo ## Symlink node_modules/.../webtrees-chart-lib to the sibling dev clone for live editing. Uses a RELATIVE target so the symlink resolves inside the node compose container too.
	@if [ ! -d "$(CHART_LIB_CLONE)" ]; then \
		echo -e "${FRED} ✘${FRESET} Expected sibling clone at $(CHART_LIB_CLONE)"; \
		exit 1; \
	fi
	@rm -rf $(CHART_LIB_NODE)
	@mkdir -p node_modules/@magicsunday
	@ln -s "$(CHART_LIB_SIBLING)" $(CHART_LIB_NODE)
	@echo -e "${FGREEN} ✔${FRESET} Symlinked $(CHART_LIB_NODE) → $(CHART_LIB_SIBLING)"
	@echo -e "${FYELLOW}   Note:${FRESET} npm install will replace this symlink with the registry / git checkout."

unlink-chart-lib: .logo ## Restore node_modules/.../webtrees-chart-lib from npm.
	@rm -rf $(CHART_LIB_NODE)
	@$(COMPOSE_RUN) npm install --quiet
	@echo -e "${FGREEN} ✔${FRESET} Restored $(CHART_LIB_NODE) from npm."
