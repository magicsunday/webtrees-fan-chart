# =============================================================================
# TARGETS
# =============================================================================

.PHONY: help

help:
	@echo -e "${FYELLOW}Usage:${FRESET}\n  make [target] ..."
	@cat $(filter-out %.env, $(MAKEFILE_LIST)) | grep -E '(^[a-zA-Z0-9._-]+:.*##|^#### )' | sed -e 's/\\$$//' | sed -E 's/#### (.+)/ \n${FYELLOW}\1${FRESET}/g' | sed -E '/^[^#].*##/ { s/^([^ ]+):/  ${FGREEN}\1${FRESET}/ }' | column -t -s '##'
	@echo ""
