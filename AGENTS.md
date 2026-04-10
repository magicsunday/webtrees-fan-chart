<!-- Managed by agent: keep sections & order; edit content, not structure. Last updated: 2026-04-10 -->

## Overview
- This repository hosts the webtrees fan chart module — an interactive SVG fan chart of an individual's ancestors using D3.js, installed as a Composer package inside webtrees.
- Decision Log:
  - 2025-02-11: Added AGENTS.md scaffolding and documented required composer checks before commits.
  - 2025-02-12: Consolidated JavaScript tests under resources/js/tests and clarified test expectations (JS vs PHP tooling).
  - 2025-02-13: Captured conciseness, documentation, testing, and enum/value-object requirements plus vanilla-JS guidance.
  - 2026-04-10: Added architecture overview, data flow, key patterns, release pipeline, and Docker buildbox workflow.
- Scoped guides: see [src/AGENTS.md](src/AGENTS.md) for PHP code and [resources/AGENTS.md](resources/AGENTS.md) for assets.

## Setup/env
- PHP 8.3+ with extensions dom and json is required; composer installs dependencies into .build/vendor and binaries into .build/bin.
- Node.js tooling is used for asset builds (rollup). Install dev dependencies via `npm install` when touching frontend resources.
- All PHP/Node tooling runs inside the webtrees Docker buildbox — never directly on the NAS or in phpfpm:
  ```
  cd /volume2/docker/webtrees && make bash
  cd app/vendor/magicsunday/webtrees-fan-chart
  ```
- JS bundles are built via the node Docker container from the module directory: `make install`, `make build`.
- After PHP or JS changes visible in the browser: `docker restart webtrees-phpfpm-1`.

## Build & tests
- **`composer ci:test` MUST run before every commit** — catches ESLint, PHPStan, PHP-CS-Fixer, Rector, PHPUnit, Jest, and CPD issues before they reach GitHub CI.
- Individual checks: `composer ci:test:php:phpstan`, `composer ci:test:php:unit`, `composer ci:test:php:cgl`, `composer ci:test:js:lint`, `composer ci:test:js:unit`.
- Single PHPUnit test: `composer ci:test:php:unit -- --filter TestClassName`.
- Auto-fix: `composer ci:cgl` (PHP style), `composer ci:rector` (Rector), `npm run lint:fix` (ESLint).
- JS bundles: `make build` (rollup), `make watch` (dev rebuild loop).
- Translations: `make lang` (compile .po → .mo). All 24 locale files must have non-empty `msgstr` entries.
- Keep PHPStan, PHPCS, and CPD clean on affected code; add PHPUnit attribute-based coverage (positive and negative cases) for every class/method introduced or modified.
- If `node_modules` has permission issues (from node container), clean via: `docker compose run --rm buildbox-root bash -c "rm -rf app/vendor/magicsunday/webtrees-fan-chart/node_modules"`.

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

### PHP (`src/`)
- **Module.php** — Entry point, extends webtrees FanChartModule, registers chart route.
- **Configuration.php** — Reads form parameters from request (POST/GET) with user preference fallback.
- **Facade/DataFacade.php** — Builds hierarchical Node tree. `buildTimespan()` assembles date+place lines from structured event data via `buildEventLine()`. `getUpdateRoute()` generates AJAX URL for person-click navigation.
- **Processor/** — Each processor extracts one aspect from a webtrees Individual (dates, places, names, images).
- **Model/Node, NodeData** — Tree node with JSON serialization for D3.

### JS (`resources/js/modules/`)
- **`index.js`** — Exports `FanChart` class (ES module entry point for Rollup).
- **`custom/`** — Fan-chart-specific: `chart.js` (D3 partition layout, click handling), `update.js` (AJAX update, transitions), `hierarchy.js` (D3 hierarchy, symbol constants), `svg/` (person/text/marriage/tooltip rendering).
- **`lib/`** — Reusable base classes shared with pedigree/descendants chart modules: export, overlay, storage, zoom.

### Views (`resources/views/`)
- **`fan-chart/page.phtml`** — Main page with form. `getUrl()` builds AJAX URL from localStorage values.
- **`fan-chart/chart.phtml`** — AJAX response: `<script type="module">` with `import()` to load ES module bundle.
- **`charts/chart.phtml`** — Block template override (home page widget), uses `data-wt-ajax-url` pattern.

### Data-relevant config parameters
These must be passed in both `getUrl()` (initial AJAX) and `getUpdateRoute()` (person click):
- `generations`, `detailedDateGenerations`, `showPlaces`, `placeParts`
- Other options (`showImages`, `showNames`, `hideEmptySegments`, etc.) are JS-only.
- Boolean parameters must be sent as `"1"`/`"0"` — webtrees `Validator::boolean()` only accepts `'1'`, `'on'`, `true`, not the string `"true"`.

## Key patterns
- **ES module loading**: `import().then(({ FanChart }) => ...)` in `<script type="module">`, avoiding the `webtrees.load()` race condition.
- **Storage flow**: `page.phtml` reads localStorage → injects as JS variables → `chart.phtml` getter checks `typeof varName !== "undefined"` before falling back to PHP defaults.
- **Unique clipPath IDs**: `"clip-image-" + datum.id + "-" + Date.now()` prevents collisions during D3 transitions.
- **Overlay independence**: Overlay popup always shows images/places regardless of form toggle states.
- **Block template**: Overrides core `modules/charts/chart.phtml` — must stay in sync with webtrees core changes (e.g. VanillaJS conversion).

## Release process
Runs inside the buildbox (requires git, node, npm, zip, gh):
```
make release 3.1.1
make release 3.1.1 NOTES="Bug fix release"
```
Pipeline: version bump → clean old bundles → npm ci → rollup → commit → tag → git archive → zip → gh release → bump to next dev.

## Code style
- Follow PSR-12, strict types, KISS, SOLID, DRY, YAGNI, GRASP, Law of Demeter, SoC, and convention over configuration.
- Keep one class per PHP file with meaningful names; add English PHPDoc for every class and method describing intent and parameters.
- Avoid mixed types, `empty()`, nested ternaries, redundant casts/braces, and dynamic static calls; prefer array helpers like `array_find`/`array_any`.
- Keep classes and methods concise; use enums or typed constants instead of magic numbers/strings and prefer value objects over complex plain arrays to capture intermediates.
- Provide explicit parentheses for complex conditional expressions; use expressive variable names and English inline comments only at complex logic.

## Security
- Do not commit secrets or PII; rely on secret managers and keep .build outputs out of version control.
- Update documentation and AGENTS.md files when behavior or configuration affecting security changes.

## PR/commit checklist
- Use Conventional Commits; include ticket IDs in titles when available.
- Keep PRs small and focused (~≤300 net LOC) with atomic commits; ensure coverage ≥90% on touched PHP paths.
- Keep implementations minimal while satisfying requirements; prefer interfaces where contracts are needed and mark classes `readonly` when appropriate.

## Good vs bad examples
- Good: `readonly class ExampleService { /** ... */ public function handle(Request $request): Response { /* ... */ } }`
- Good: `if (array_any($items, static fn ($item): bool => $item->isActive())) { /* ... */ }`
- Bad: `class example { function run($x){ if(empty($x)) return; } } // no types/docs, uses empty()`

## When stuck
- Check composer scripts (`composer run-script --list`) and the README for expected workflows; align new guidance with existing tooling.
- Document deviations or new requirements in the Decision Log of the nearest AGENTS.md.

## House Rules
- Maintain strict typing and PHPStan level max alignment; update Rector or coding-standard configs when code style shifts.
- Prefer interfaces where sensible; mark data-only classes as `readonly` and remove redundant modifiers or arguments.
- Always update AGENTS.md files alongside behavior changes to avoid instruction drift.
- Avoid external JavaScript libraries beyond D3; stick to vanilla JavaScript elsewhere.
