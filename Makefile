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
# The parameter file of the module is read first, so that every shared fragment sees its values
# whatever the order of the file names. A module without the file stops here.
$(if $(wildcard Make/module.mk),,$(error Make/module.mk is missing, copy it from module.mk.example of the template and set the values of the module))
include Make/module.mk

# Parameters that the shared fragments need. SHARED_VIEWS may be empty, but a module has to define it,
# so that having no shared views is a decision and not a forgotten line.
REQUIRED_MODULE_PARAMETERS := MODULE_NAME SCOPE_NS WEBTREES_CONSTRAINT CHART_LIB_MARKER SHARED_VIEWS

$(foreach parameter,$(REQUIRED_MODULE_PARAMETERS),$(if $(filter undefined,$(origin $(parameter))),$(error Make/module.mk does not define $(parameter))))
$(foreach parameter,$(filter-out SHARED_VIEWS,$(REQUIRED_MODULE_PARAMETERS)),$(if $(strip $($(parameter))),,$(error Make/module.mk leaves $(parameter) empty)))

-include $(filter-out Make/module.mk,$(wildcard Make/*.mk))
-include Make/**/*.mk

# Argument fix workaround
%:
	@:
