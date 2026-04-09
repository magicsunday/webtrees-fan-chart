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

#### Testing

.PHONY: test

test: .logo ## Run JavaScript unit tests.
	@$(COMPOSE_RUN) npm test
	@echo -e "${FGREEN} ✔${FRESET} Tests passed"
