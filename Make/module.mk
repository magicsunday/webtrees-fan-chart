# =============================================================================
# Module parameters
#
# The only file of the Make setup and of tests/Release/ that holds values of one
# module. Everything else is copied from the template by bin/sync-webtrees-module.php
# and is the same in every module. Copy this file to Make/module.mk, replace the
# values and keep it out of the sync, it is not part of the shared files.
#
# The Makefile reads this file before every other fragment, and the release tests
# read it at run time.
#
# Make, the sync script and the release tests read the file the same way. A line
# is an assignment with = or := (optionally indented with spaces). The last one of
# a name wins. ?= sets a name only when no line before it did. A value carries no
# comment after it, and += is not used.
# =============================================================================

# The package name of composer.json without the vendor. The release archive, the
# POT header and the issue URL of the translations carry it, and the name of the
# JavaScript bundle is derived from it by dropping the webtrees- prefix.
MODULE_NAME := webtrees-fan-chart

# The segment of the PHP namespace between MagicSunday\Webtrees\ and the Test\ or
# the src/ part, as autoload and autoload-dev of composer.json spell it. The sync
# script writes it into the namespace line of the files under tests/Release/.
MODULE_NS := FanChart

# The prefix injected into the bundled module-base classes at dist time. It keeps
# two modules at different versions from registering the same shared namespace.
# Must be unique per module.
SCOPE_NS := FanChartVendor

# The webtrees constraint that release-prepare and release-bump write to composer.json.
# A module that keeps the list of core owned texts derives it from CORE_RELEASES
# instead (see below), which needs the deferred form: = and not :=.
WEBTREES_CONSTRAINT := ~2.2.0

# The file of the chart library build that marks a finished build. release-bootstrap
# runs npm ci when it is missing from node_modules/@magicsunday/webtrees-chart-lib/dist/.
CHART_LIB_MARKER := webtrees-chart-lib-infra.es.js

# The shared module-base views that the archive bundles, by file name without the
# extension. The view namespace is scoped to webtrees-module-base- and the JavaScript
# name of the module, so it is unique per module. A module without shared views
# defines the variable empty, the archive then carries the module-base source only.
SHARED_VIEWS := detail-panel help-popover toolbar-style

# Optional. The webtrees core releases whose catalogues define the texts that core
# owns, see Make/lang.mk. Leave the line out when the module keeps no such list.
# CORE_RELEASES := 2.2.2 2.2.3
# WEBTREES_CONSTRAINT = ~$(firstword $(CORE_RELEASES))
