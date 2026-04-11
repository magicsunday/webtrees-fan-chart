## Overview
This repository hosts the webtrees fan chart module — an interactive SVG fan chart of an individual's ancestors using D3.js, installed as a Composer package inside webtrees.

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
- After JS changes, always verify in the browser via Playwright before claiming success.

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
- **Model/Symbols** — Backed enum for genealogical symbols (Birth, Death). Marriage symbol is JS-only.

### JS (`resources/js/modules/`)
- **`index.js`** — Exports `FanChart` class (ES module entry point for Rollup).
- **`custom/`** — Fan-chart-specific: `chart.js` (D3 partition layout, click handling), `update.js` (AJAX update, transitions), `hierarchy.js` (D3 hierarchy, symbol constants), `svg/` (person/text/marriage/tooltip rendering), `svg/arc.js` (shared arc DOM helper).
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
- Places are displayed only for generations within the `innerArcs` boundary (not `detailedDateGenerations`).

## Key patterns
- **ES module loading**: `import().then(({ FanChart }) => ...)` in `<script type="module">`, avoiding the `webtrees.load()` race condition.
- **Storage flow**: `page.phtml` reads localStorage → injects as JS variables → `chart.phtml` getter checks `typeof varName !== "undefined"` before falling back to PHP defaults.
- **Unique clipPath IDs**: `"clip-image-" + datum.id + "-" + Date.now()` prevents collisions during D3 transitions.
- **Overlay independence**: Overlay popup always shows images/places regardless of form toggle states.
- **Block template**: Overrides core `modules/charts/chart.phtml` — must stay in sync with webtrees core changes (e.g. VanillaJS conversion).
- **Once-guard callback**: `endAll` + `.catch()` share a `callbackFired` flag to prevent double-invocation of `updateDone`.
- **D3 interrupt handling**: `endAll` listens to both `"end"` and `"interrupt"` events so the callback fires even when transitions are cancelled.

## Release process
Runs inside the buildbox (requires git, node, npm, jq, zip, gh):
```
make release 3.1.2
make release 3.1.2 NOTES="Bug fix release"
```
Pipeline: version bump (via `jq` for package.json, `sed` for Module.php) → clean old bundles (`git rm` + `rm`) → npm ci → rollup → commit → tag → git archive → zip → gh release → bump to next dev.

## Code style

### PHP
- Follow PSR-12 with `declare(strict_types=1)` in every file.
- **No `mixed` types** — use specific types or union types.
- **No `empty()`** — use explicit comparisons (`=== ''`, `=== []`, `=== null`).
- Use enums or typed constants instead of magic numbers/strings.
- Prefer value objects over complex plain arrays.
- Provide explicit parentheses for complex conditional expressions.
- Use expressive variable names; English inline comments only at complex logic.
- Docblocks: Always multi-line format. Describe purpose, not just repeat the method name. Keep `@param` only when it adds information beyond type+name. Keep `@return` tags.

### JavaScript
- ES modules only; vanilla JS except D3.
- **`@private`** on all non-public methods — this is the JS equivalent of PHP `private`.
- **`@return`** on all getters and methods that return a value.
- **No single-line docblocks** — always use multi-line `/**\n * text\n */` format.
- Use `@return` (not `@returns`) for consistency.
- Docblock order: description → `@param` → `@return` → `@private`.
- Parenthesize arithmetic in comparisons: `if (si < (group.length - 1))`.
- Parenthesize sub-conditions in compound booleans: `if ((a > 0) && (b < 1))`.
- No single-letter variable names except loop iterators.
- `for...of` on arrays (not `for...in`).
- `Object.prototype.hasOwnProperty.call()` instead of direct `.hasOwnProperty()` for prototype-pollution safety.

## Security
- Do not commit secrets or PII; rely on secret managers and keep .build outputs out of version control.

## PR/commit checklist
- `composer ci:test` must pass before every commit.
- Use Conventional Commits; include ticket IDs in titles when available (e.g. `Fixes #182`).
- Keep PRs small and focused (~≤300 net LOC) with atomic commits.
- Ensure coverage ≥90% on touched PHP paths.
- After PR receives review comments: assess, fix, commit, reply with commit hash, resolve threads via GraphQL.
- Never comment on GitHub issues/PRs without explicit user approval.

## When stuck
- Check composer scripts (`composer run-script --list`) and the README for expected workflows.

## House Rules
- Maintain strict typing and PHPStan level max alignment.
- Prefer interfaces where sensible; mark data-only classes as `readonly`.
- Avoid external JavaScript libraries beyond D3.
- Always use Playwright to verify JS changes in the browser — don't just trust the tests.
- Use `jq` (not `sed`) for JSON manipulation in build scripts — Alpine `sed` does not support GNU syntax.
