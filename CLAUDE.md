# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A webtrees module that renders an interactive SVG fan chart of an individual's ancestors using D3.js. It runs as a Composer-installed module inside a webtrees installation.

## Build & test commands

All PHP/Node tooling runs inside the webtrees Docker buildbox — never directly on the NAS:

```bash
# Enter buildbox
cd /volume2/docker/webtrees && make bash
cd app/vendor/magicsunday/webtrees-fan-chart

# Full CI suite (MUST run before every commit)
composer ci:test

# Individual checks
composer ci:test:php:phpstan          # Static analysis (level max)
composer ci:test:php:unit             # PHPUnit tests
composer ci:test:php:cgl              # PHP-CS-Fixer (dry-run)
composer ci:test:js:lint              # ESLint
composer ci:test:js:unit              # Jest tests
composer ci:test:php:rector           # Rector (dry-run)

# Single PHPUnit test
composer ci:test:php:unit -- --filter TestClassName

# Auto-fix
composer ci:cgl                       # Fix PHP code style
composer ci:rector                    # Apply Rector rules
npm run lint:fix                      # Fix ESLint issues
```

JS bundles are built via the node Docker container (from the module directory, not the buildbox):

```bash
make install    # npm install
make build      # Rollup bundle (fan-chart-{version}.min.js)
make watch      # Dev rebuild loop
make lang       # Compile .po → .mo translations
```

After PHP or JS changes visible in the browser, restart PHP-FPM:
```bash
docker restart webtrees-phpfpm-1
```

## Release process

Runs inside the buildbox (requires git, node, npm, zip, gh):

```bash
make release 3.1.1
# Optionally: make release 3.1.1 NOTES="Bug fix release"
```

Pipeline: version bump → clean old bundles → npm ci → rollup → commit → tag → git archive → zip → gh release → bump to next dev.

## Architecture

### Data flow: PHP → JSON → D3

```
Module.php (entry point, registers routes)
  → page.phtml (form + AJAX container, localStorage via Storage)
    → chart.phtml (import() loads ES module, passes config as JS object)
      → DataFacade.php (builds Node tree from Individual records)
        → DateProcessor, PlaceProcessor, NameProcessor, ImageProcessor
          → NodeData → JSON → D3 hierarchy → SVG rendering
```

### PHP structure (`src/`)

- **Module.php** — Entry point, extends webtrees `FanChartModule`, registers chart route
- **Configuration.php** — Reads form parameters from request (POST/GET) with user preference fallback
- **Facade/DataFacade.php** — Builds the hierarchical Node tree. Key methods:
  - `createTreeStructure()` — Recursively builds ancestor tree
  - `buildTimespan()` — Assembles date+place lines from structured event data via `buildEventLine()`
  - `getUpdateRoute()` — Generates AJAX URL for person-click navigation (must include all data-relevant params like `showPlaces`, `placeParts`)
- **Processor/** — Each processor extracts one aspect from a webtrees `Individual`
- **Model/Node, NodeData** — Tree node with JSON serialization for D3
- **Traits/** — ModuleChartTrait, ModuleConfigTrait, ModuleCustomTrait

### JS structure (`resources/js/modules/`)

- **`index.js`** — Exports `FanChart` class (ES module entry point for Rollup)
- **`custom/`** — Fan-chart-specific code:
  - `chart.js` — Main chart class, D3 partition layout, person click handling
  - `update.js` — AJAX update on person click, transition animations, clipPath cleanup
  - `hierarchy.js` — D3 hierarchy wrapper, symbol constants (`SYMBOL_BIRTH`, `SYMBOL_DEATH`, `SYMBOL_ELLIPSIS`)
  - `configuration.js` — JS-side config from PHP-provided options
  - `svg/` — SVG rendering: `person.js` (arcs, images, clipPaths), `text.js` (text along arcs), `marriage.js`, `tooltip-renderer.js` (overlay popup)
- **`lib/`** — Reusable base classes shared with pedigree/descendants chart modules:
  - `chart/svg/export.js` — PNG/SVG export with inline base64 images
  - `chart/overlay.js` — Overlay panel (detailed person info)
  - `storage.js` — localStorage wrapper (UMD format, used by page.phtml)

### View templates (`resources/views/`)

- **`fan-chart/page.phtml`** — Main page: form, `getUrl()` builds AJAX URL from localStorage values, `data-wt-ajax-url` triggers `webtrees.load()`
- **`fan-chart/chart.phtml`** — AJAX response: `<script type="module">` with `import()` to load ES module bundle
- **`charts/chart.phtml`** — Block template override (home page widget), uses `data-wt-ajax-url` (not jQuery `$.load()`)
- **`fan-chart/form/`** — Form partials for each option group

### Config parameters that affect server-side data generation

These must be passed in both `getUrl()` (initial AJAX) and `getUpdateRoute()` (person click):

| Parameter | Affects |
|-----------|---------|
| `generations` | Number of ancestor levels |
| `detailedDateGenerations` | Detailed vs compact date format threshold |
| `showPlaces` | Places embedded in timespan |
| `placeParts` | Number of place hierarchy levels |

Other options (`showImages`, `showNames`, `hideEmptySegments`, etc.) are JS-only and don't affect PHP data generation.

Boolean parameters must be sent as `"1"`/`"0"` — webtrees `Validator::boolean()` only accepts `'1'`, `'on'`, `true`, not the string `"true"`.

## Key patterns

- **ES module loading**: Chart JS is loaded via `import().then(({ FanChart }) => ...)` in a `<script type="module">` tag, avoiding the webtrees `webtrees.load()` race condition
- **Storage**: `page.phtml` reads localStorage values and injects them as JS variables; the `chart.phtml` getter checks `typeof varName !== "undefined"` before falling back to PHP defaults
- **Unique clipPath IDs**: Image clipPaths use `"clip-image-" + datum.id + "-" + Date.now()` to prevent ID collisions during D3 transitions
- **Overlay is always visible**: The overlay popup always shows images/places regardless of form toggle states — only arc rendering respects toggles

## Translations

24 language files in `resources/lang/{locale}/messages.po`. Every `msgstr` must be non-empty. Compile with `make lang`. MO files are committed alongside PO files.
