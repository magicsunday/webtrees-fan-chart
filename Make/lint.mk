# =============================================================================
# TARGETS
# =============================================================================

#### Linting

.PHONY: lint lint-fix

lint: .logo ## Run ESLint on JavaScript sources.
	@$(COMPOSE_RUN) npm run lint
	@echo -e "${FGREEN} ✔${FRESET} ESLint passed"

lint-fix: .logo ## Run ESLint with auto-fix on JavaScript sources.
	@$(COMPOSE_RUN) npm run lint:fix
	@echo -e "${FGREEN} ✔${FRESET} ESLint auto-fix applied"
