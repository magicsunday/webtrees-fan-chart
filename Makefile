SHELL = /bin/bash

.SILENT:

MAKEFLAGS += --no-print-directory

.DEFAULT_GOAL := help

# Docker Compose detection
COMPOSE_BIN := $(shell \
	if command -v docker >/dev/null 2>&1; then \
		if docker compose version >/dev/null 2>&1; then \
			echo "docker compose"; \
		elif command -v docker-compose >/dev/null 2>&1; then \
			echo "docker-compose"; \
		else \
			echo "echo 'Error: No Docker Compose found' && exit 1"; \
		fi; \
	else \
		echo "echo 'Error: Docker not found' && exit 1"; \
	fi)

COMPOSE_RUN := $(COMPOSE_BIN) run --rm node

.PHONY: help build watch install clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install node dependencies
	@$(COMPOSE_RUN) npm install

build: ## Build JavaScript bundles
	@$(COMPOSE_RUN) npm run prepare

watch: ## Watch for changes and rebuild automatically
	@$(COMPOSE_RUN) npm run watch

clean: ## Remove node_modules
	@rm -rf node_modules
