# =============================================================================
# TARGETS
# =============================================================================

#### Node.js & Assets

.PHONY: install build watch clean

install: .logo ## Install node dependencies.
	@$(COMPOSE_RUN) npm install
	@echo -e "${FGREEN} ✔${FRESET} Node dependencies installed"

build: .logo ## Build JavaScript bundles.
	@$(COMPOSE_RUN) npm run prepare
	@echo -e "${FGREEN} ✔${FRESET} JavaScript bundles built"

watch: .logo ## Watch for changes and rebuild automatically.
	@$(COMPOSE_RUN) npm run watch

clean: .logo ## Remove node_modules.
	@$(COMPOSE_RUN) rm -rf node_modules
	@echo -e "${FGREEN} ✔${FRESET} node_modules removed"
