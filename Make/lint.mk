# =============================================================================
# TARGETS
# =============================================================================

#### Linting

.PHONY: lint lint-fix

lint: .logo ## Run Biome lint on JavaScript sources.
	@$(COMPOSE_RUN) npm run lint
	@echo -e "${FGREEN} ✔${FRESET} Biome lint passed"

lint-fix: .logo ## Run Biome lint with auto-fix on JavaScript sources.
	@$(COMPOSE_RUN) npm run lint:fix
	@echo -e "${FGREEN} ✔${FRESET} Biome auto-fix applied"

#### Testing

.PHONY: test

test: .logo ## Run JavaScript unit tests.
	@$(COMPOSE_RUN) npm test
	@echo -e "${FGREEN} ✔${FRESET} Tests passed"
