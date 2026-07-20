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
- **`composer ci:test` MUST run before every commit** — catches Biome lint, PHPStan, PHP-CS-Fixer, Rector, PHPUnit, Jest, and jscpd issues before they reach GitHub CI.
- Individual checks: `composer ci:test:php:phpstan`, `composer ci:test:php:unit`, `composer ci:test:php:cgl`, `composer ci:test:js:lint`, `composer ci:test:js:unit`, `composer ci:test:cpd` (PHP + JS duplicate detection).
- Single PHPUnit test: `composer ci:test:php:unit -- --filter TestClassName`.
- Auto-fix: `composer ci:cgl` (PHP style), `composer ci:rector` (Rector), `npm run lint:fix` + `npm run format` (Biome).
- JS bundles: `make build` (rollup), `make watch` (dev rebuild loop).
- Translations: `make lang` (compile .po → .mo). All 24 locale files must have non-empty `msgstr` entries.
- Keep PHPStan, PHPCS, and CPD clean on affected code; add PHPUnit attribute-based coverage (positive and negative cases) for every class/method introduced or modified.
- If `node_modules` has permission issues (from node container), clean via: `docker compose run --rm buildbox-root bash -c "rm -rf app/vendor/magicsunday/webtrees-fan-chart/node_modules"`.
- **Typecheck scope is intentionally limited to production sources** (`jsconfig.json` includes only `resources/js/modules/**/*.js`). Tests under `resources/js/tests/**` are validated by jest at runtime but skipped by `tsc --noEmit` because the partial mock objects required to isolate units would otherwise produce dozens of structural-incompatibility errors against the real `Configuration` / `Selection` shapes. The strict-typecheck gate applies to shipped code; test scaffolding stays loose.

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
- **Model/Node, NodeData** — Tree node with JSON serialization for D3.
- **Shared classes from [`magicsunday/webtrees-module-base`](https://github.com/magicsunday/webtrees-module-base)** (composer dependency `^1.1`):
  - `Processor/DateProcessor` — generation-aware date formatting; DataFacade calls the `getFormatted*` methods (compact DD.MM.YYYY) rather than the locale-aware legacy methods.
  - `Processor/NameProcessor`, `Processor/ImageProcessor`, `Processor/PlaceProcessor` — name/image/place extraction.
  - `Model/Symbols` — backed enum for genealogical symbols (Birth ★, Death †, MarriageDateUnknown sentinel).
  - `Module/VersionInformation` — GitHub release-checking with file cache.
  - For local edits to module-base while developing fan-chart, run `make link-base` (symlinks `.build/vendor/.../webtrees-module-base` → the sibling clone). Reverse with `make unlink-base` or any `composer install/update`.

### JS (`resources/js/modules/`)
Flat layout — every file is fan-chart-specific glue. Reusable base classes (Storage, ChartExport, ChartOverlay, ChartZoom, Orientations, measureText, truncateNames) live in the external [`@magicsunday/webtrees-chart-lib`](https://github.com/magicsunday/webtrees-chart-lib) package, shared with the pedigree- and descendants-chart modules. Consumed via Git URL pinned in `package.json` (`github:magicsunday/webtrees-chart-lib#vX.Y.Z`); chart-lib's `prepare` script builds its `dist/` during install, so `npm ci --ignore-scripts` will break the build.
- **`index.js`** — Exports `FanChart` class (ES module entry point for Rollup).
- **`page-entry.js` / `page-init.js`** — UMD bundle (`fan-chart-page.min.js`) loaded by `page.phtml`. Owns localStorage form-state wiring; `initPage()` resolves user options and publishes them under `WebtreesFanChart.chartOptions` for `chart.phtml` getters.
- **`chart.js`** (D3 partition layout, click handling), **`chart-updater.js`** (AJAX update, transitions), **`hierarchy.js`** (D3 hierarchy, symbol constants), **`configuration.js`**, **`svg.js`**.
- **`svg/`** — person/text/marriage/tooltip rendering, `arc.js` (shared arc DOM helper), `arc-factory.js`, `geometry.js`, `lifecycle.js`, `family-color.js`, `filter.js`, `label-renderer.js`, `tooltip-renderer.js`.
- **`d3.js`** — D3 facade re-exporting only the d3 sub-packages used by the chart (selection, transition, zoom, hierarchy, scale, etc.).

### Views (`resources/views/`)
- **`fan-chart/page.phtml`** — Form + AJAX container. Loads `fan-chart-page.min.js` and calls `WebtreesFanChart.initPage({ ajaxUrl, defaults… })`.
- **`fan-chart/chart.phtml`** — AJAX response: `<script type="module">` with `import()` to load ES module bundle. Reads user overrides from `WebtreesFanChart.chartOptions ?? PHP defaults`.
- **`charts/chart.phtml`** — Block template override (home page widget), uses `data-wt-ajax-url` pattern.

### Data-relevant config parameters
These must be passed in both `getUrl()` (initial AJAX) and `getUpdateRoute()` (person click):
- `generations`, `detailedDateGenerations`, `showPlaces`, `placeParts`
- Other options (`showImages`, `showNames`, `hideEmptySegments`, etc.) are JS-only.
- Boolean parameters must be sent as `"1"`/`"0"` — webtrees `Validator::boolean()` only accepts `'1'`, `'on'`, `true`, not the string `"true"`.
- Places are displayed only for generations within the `innerArcs` boundary (not `detailedDateGenerations`).

## Key patterns
- **ES module loading**: `import().then(({ FanChart }) => ...)` in `<script type="module">`, avoiding the `webtrees.load()` race condition.
- **Storage flow**: `page-init.js` reads localStorage → publishes resolved options under `WebtreesFanChart.chartOptions` → `chart.phtml` getter reads `opts.x ?? PHP default`.
- **Unique clipPath IDs**: monotonic `clipIdCounter` (in `svg/person.js`) prevents collisions during D3 transitions; `Date.now()` is too coarse when transitions overlap.
- **Overlay independence**: Overlay popup always shows images/places regardless of form toggle states.
- **Block template**: Overrides core `modules/charts/chart.phtml` — must stay in sync with webtrees core changes (e.g. VanillaJS conversion).
- **Once-guard callback**: `endAll` + `.catch()` share a `callbackFired` flag to prevent double-invocation of `updateDone`.
- **D3 interrupt handling**: `endAll` listens to both `"end"` and `"interrupt"` events so the callback fires even when transitions are cancelled.

## Release process
Runs inside the buildbox (requires git, node, npm, composer, jq, zip, gh, sed):
```
make release 3.1.2
make release 3.1.2 NOTES_FILE=/tmp/notes.md
make release VERSION=3.1.2 NOTES="Bug fix release"
```
Pipeline (`make release X.Y.Z`):
- `release-check` — tools, semver, clean tree, no detached HEAD, no active `make link-base` symlink, gh auth (or `GH_TOKEN`).
- `release-prepare` — `sed_edit` macro updates `CUSTOM_VERSION` in `src/Module.php` with a post-write assertion; `jq_edit` macro (with `--indent 4` and post-write assertion) updates `package.json` version + `composer.json` webtrees pin → clean+rebuild JS bundles via `build-js-fresh` → commit → `dist` → tag (only after dist succeeds, so a dist failure does not leave a dangling tag).
- `dist` — symlink guard fires before composer touches anything, `composer install --no-dev --no-interaction`, `git archive HEAD` (respects `.gitattributes` export-ignore), bundles `magicsunday/webtrees-module-base` into the zip's `vendor/` so manual ZIP installs work without composer, strips all `composer.json` files (`find vendor -name composer.json -delete`), atomic write via `.tmp` + rename + `zip -T` integrity check.
- `dist-smoke` — separate target, asserts required entries (module.php, LICENSE, the versioned JS bundle, module-base `src/`) are present and forbidden ones (composer.json, assets/) are absent. CI runs this on every push.
- `release-publish` — `git push --tags`, `gh release create` with the zip + notes, emits `RELEASE_PUBLISHED version=X` marker for agent observers.
- `release-bump` — bump to `VERSION+1-dev`, restore `~2.2.0 || dev-main` constraint, push.

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
- Commit subjects match `^GH-\d+: [A-ZÄÖÜ]` on issue-tied work and `^[A-ZÄÖÜ]`
  otherwise — a capitalised imperative either way. **No conventional-commit prefixes**
  (`feat:`, `fix:`, `chore:` …), no lowercase and no path-like starts
  (`src/Module.php: …`). Branches for an issue are named exactly `GH-<N>`, where
  `<N>` is the issue number.
    - The two patterns are deliberately kept separate. Folded into
      `^(GH-\d+: )?[A-ZÄÖÜ]` the rule stops enforcing the capital *after* the
      prefix: the optional group can be skipped, and the `G` of `GH-` then
      satisfies `[A-ZÄÖÜ]` on its own.
- Never add a `Co-Authored-By:` trailer or any other AI attribution.
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
- Use `jq` (not `sed`) for **JSON file** manipulation in build scripts — Alpine `sed` does not support the GNU regex extensions needed for nested JSON edits. `sed` is fine for non-JSON files (PHP, YAML); see the `sed_edit` and `jq_edit` macros in `Make/release.mk`.
