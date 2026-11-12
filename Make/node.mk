# install, build, watch, unlink-chart-lib and lint-fix run npm as the numeric user and group of the caller,
# because they write node_modules, bundles or sources into the bind-mounted checkout, and no root-owned file
# may land there. HOME points at a writable directory. The lang targets run as the caller as well, and clean stays
# with root to remove what an earlier run as root left behind.
COMPOSE_RUN_USER = $(COMPOSE_BIN) run --rm --user $(shell id -u):$(shell id -g) -e HOME=/tmp node

# =============================================================================
# TARGETS
# =============================================================================

#### Node.js & Assets

.PHONY: install build watch clean

install: .logo ## Install node dependencies.
	@$(COMPOSE_RUN_USER) npm install
	@echo -e "${FGREEN} ✔${FRESET} Node dependencies installed"

build: .logo ## Build JavaScript bundles.
	@$(COMPOSE_RUN_USER) npm run prepare
	@echo -e "${FGREEN} ✔${FRESET} JavaScript bundles built"

watch: .logo ## Watch for changes and rebuild automatically.
	@$(COMPOSE_RUN_USER) npm run watch

clean: .logo ## Remove node_modules.
	@$(COMPOSE_RUN) rm -rf node_modules
	@echo -e "${FGREEN} ✔${FRESET} node_modules removed"
