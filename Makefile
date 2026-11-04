SHELL = /bin/bash

.SILENT:

# Do not print "Entering directory ..."
MAKEFLAGS += --no-print-directory

# Keep the inline release note out of the exported variables. Make expands an
# exported variable for every $(shell ...) call and every recipe, which would lose
# a dollar sign in the note and run a $(shell ...) in it. This line has to stay
# above the first $(shell ...) call. Make/release.mk hands the note over as NOTES_RAW.
unexport NOTES

.PHONY: no_targets__ *
	no_targets__:

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

# Includes
-include Make/*.mk
-include Make/**/*.mk

# Argument fix workaround
%:
	@:
