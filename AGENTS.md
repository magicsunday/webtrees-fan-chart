## Overview
This repository hosts the webtrees fan chart module — an interactive SVG fan chart of an individual's ancestors using D3.js, installed as a Composer package inside webtrees.

## Setup/env
### Generic setup
- PHP 8.3 up to but not including 9 with extensions dom and json is required. The constraint is `>=8.3 <9` and the CI matrix states what is tested. Composer installs dependencies into .build/vendor and binaries into .build/bin.
- `composer ci:test` needs both dependency sets. Install the PHP dependencies with `composer install` and the Node dependencies with `npm ci` (or `make install`), because the JavaScript steps and `composer ci:test:php:cpd` run the tools in `node_modules`. Node.js tooling is also used for asset builds (rollup).
- The checks need PHP, Composer and Node. Run them with a local toolchain or in the buildbox, the `ghcr.io/magicsunday/webtrees-buildbox:<PHP version>` image of the `webtrees-docker` project, which ships all three. `composer -d <path of the module inside the container> ci:test` runs them from outside the module directory.
- JS bundles are built with `make build` (or `npm run prepare` with a local Node.js), and `make install` installs the Node dependencies. The `make` targets that run npm use the `node` service of `compose.yaml`, so they need Docker and nothing else.
- `compose.yaml` bind-mounts the sibling clone `../webtrees-chart-lib` into the `node` service for every `docker compose run`, because the chart-lib dev symlink of `make link-chart-lib` has to resolve inside the container. Compose has no way to skip a bind mount whose source is missing (`create_host_path: false` makes the run fail instead), so Docker creates the missing `../webtrees-chart-lib` as a root-owned empty directory next to the checkout. It is harmless and unused as long as the dev symlink is not active. Remove it with `rmdir`, which the owner of the checkout may do because the parent directory is theirs, before cloning the real chart-lib there, because `make link-chart-lib` refuses a directory without `package.json`.
- After JS changes, always verify in the browser via Playwright before claiming success.

### Layout of the NAS checkout
- This checkout sits at `/volume2/docker/webtrees/app/vendor/magicsunday/webtrees-fan-chart`, inside the `webtrees-docker` project that provides the buildbox. All PHP/Node tooling runs inside that buildbox — never directly on the NAS or in phpfpm:
  ```
  cd /volume2/docker/webtrees && make bash
  cd app/vendor/magicsunday/webtrees-fan-chart
  ```
  or, without an interactive shell: `cd /volume2/docker/webtrees && docker compose run --rm buildbox composer -d /var/webtrees/app/vendor/magicsunday/webtrees-fan-chart ci:test`.
- The sibling clones (`../webtrees-chart-lib`, `../webtrees-module-base`) are the neighbours of this checkout under `app/vendor/magicsunday/`.
- After PHP or JS changes visible in the browser: `docker restart webtrees-phpfpm-1`.

### Convention for new advisory ignores

Before adding an entry, check the following. Is the package a direct dependency (`composer why`)? Does a public fix exist? Does an exact pin of webtrees alone block that fix (`composer why-not <package> <fixed version>`)? Update instead of ignoring whenever the fix is reachable.

- An advisory that webtrees' exact pin keeps unresolved is ignored by its **advisory ID** under `config.policy.advisories.ignore-id`, so later advisories on the same package keep blocking. Never ignore by package name under `ignore`, because that also hides every later advisory of the package.
- The reason starts with a prefix that says why the entry exists, followed by the CVE and the condition for removing it. `UPSTREAM-PINNED:` marks a fix that exists publicly but is held back by the exact pin of webtrees. `ACCEPTED:` is reserved for a conscious risk acceptance with a low severity and no attack path in this package.
- Remove the entry once the supported webtrees range no longer pins an affected version. `composer ci:test:php:advisories` runs `composer audit --format=json` on the installed packages and fails with the ids of every `ignore-id` entry that is missing from the ignored advisories of the report. An entry has to be the advisory id (PKSA), because the script compares the keys of `ignore-id` with the `advisoryId` values of the report, so an entry keyed by a CVE or a remote id is reported as stale. It is part of `composer ci:test` and runs in CI as a step of the `js` job of `.github/workflows/ci.yml`, because the shared `php-quality.yml` workflow does not know it. The check reads the installed packages, so run `composer update` first when the local `.build/vendor` is older than `composer.json`. The script is `scripts/check-stale-advisory-ignores.php` and its test is `tests/Release/StaleAdvisoryIgnoresTest.php`.

## Build & tests
- **`composer ci:test` MUST run before every commit** — catches Biome lint, PHPStan, PHP-CS-Fixer, Rector, PHPUnit, Jest, and jscpd issues before they reach GitHub CI.
- Individual checks: `composer ci:test:php:phpstan`, `composer ci:test:php:unit`, `composer ci:test:php:cgl`, `composer ci:test:js:lint`, `composer ci:test:js:unit`, `composer ci:test:php:cpd` (PHP + JS duplicate detection), `composer ci:test:php:advisories` (stale advisory ignores).
- `composer ci:test:php:cpd` runs the installed `node_modules/.bin/jscpd`, so the Node dependencies must be installed (`make install` or `npm ci`). jscpd is pinned to an exact version in `package.json`. CI runs it as its own job through the shared `cpd.yml` workflow of the `.github` repository, reported as `cpd / Copy-paste detection`.
- `composer ci:test:php:infection` runs mutation testing against `src/` over the whole tree and only reports. It is not part of `composer ci:test`, because a mutation run is too slow for every local check. CI runs it as the mutation step of the shared `php-quality.yml` workflow, on one PHP leg of its matrix. A fixed score floor over the whole tree rewards tests that only kill a mutant in a getter, a literal, a default or a call order, so `infection.json5` has none. `timeoutsAsEscaped` stays on, since Infection counts a timed-out mutant as killed by default and a mutation that made the suite hang is not one the tests caught. There is deliberately no `maxTimeouts` limit, because the timeout count varies with machine load.
- A pull request is gated on the covered code of the lines it changes, with `composer ci:test:php:infection:changed`. The shared `php-quality.yml` workflow runs that script on a pull request, with the base branch as `--git-diff-base`, so the checkout of that leg fetches the full history, and the script has no default for it. A pull request whose changed lines carry no mutants passes. The floor sits in the command of the script, and a regression is fixed in the tests and never admitted by lowering it. The script switches off the rename detection of Git for its run, so that a file which a pull request renames counts as an added file and is gated in full, a pure move included, where a detected rename would be skipped unchecked. Infection mutates only code that a test executes, so new code that no test reaches produces no mutants and this gate does not catch it. That stays a matter of the coverage of the tests.
- Single PHPUnit test: `composer ci:test:php:unit -- --filter TestClassName`.
- Auto-fix: `composer ci:cgl` (PHP style), `composer ci:rector` (Rector), `npm run lint:fix` + `npm run format` (Biome).
- **Biome rules come from [`magicsunday/coding-standard`](https://github.com/magicsunday/coding-standard)**: `biome.json` extends `@magicsunday/coding-standard/biome/base.json` (npm devDependency pinned to a release tag, `github:magicsunday/coding-standard#X.Y.Z`) and only adds this repository's own `vcs`/`files` scope. Change a shared rule upstream, not here; a local override needs a documented reason. `@biomejs/biome` and `typescript` stay own devDependencies within that package's `peerDependencies`, and `$schema` follows the installed Biome version. `composer ci:test:php:templates` checks the `extends` link because the npm dependency is declared.
- **`tsconfig.json` extends the shared strict `@magicsunday/coding-standard/tsconfig/base`**: the strict compiler flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, …) live there — keep only module-specific settings (target, module, lib, types, paths, file scope) locally and never switch a pinned strict flag back off. `composer ci:test:php:templates` asserts the extends link.
- JS bundles: `make build` (rollup), `make watch` (dev rebuild loop).
- Translations: `make lang` runs the i18n pipeline and compiles every `.po` to its `.mo`, and the merge and compile steps stop at the first locale that fails. A text of this module is translated in the locales that ship a translation for it. A text that webtrees already translates stays empty, see the catalogue rules below.
- **Catalogue rules.** webtrees merges the compiled catalogue of a module over its own, so an entry here replaces the webtrees translation of the same text in the whole installation, not only on this module's pages.
    - Leave the `msgstr` empty for every text that webtrees core translates in that locale, except for a text of the next point. A compiled entry replaces the core text in the whole installation and goes stale when core rewords it. This holds for the chart title (`Fan chart`) and the button and form labels as well. Where core translates them, the core wording is used. The `core-overlap` job of the shared `i18n.yml` workflow compares every catalogue with the `.po` files of the webtrees releases the module supports and fails a pull request that fills such a text, the annotation names the file and line. A text that core does not translate in a locale may be filled. Fuzzy entries and plural entries with an empty first form are not compiled and do not count.
    - A text whose wording the module deliberately words differently from the core carries the name of the module as its context, and the call site passes the translation of that context through `ContextText::resolve()`, for example `ContextText::resolve(I18N::translateContext('webtrees-fan-chart', 'view'), 'view')`. An entry with a context is a key of its own, so it does not replace the core text in the rest of the installation, and the `core-overlap` job leaves it alone. The source text stays a literal at the call site so that `make lang` extracts it. Only a language whose wording differs on purpose carries an entry: German with the wording of the module, and a language that translated the text before the context existed keeps that translation in the entry. Every other entry stays empty. A language without an entry keeps the wording of the core, because `resolve()` falls back to the plain translation.
    - Source texts are American English like in webtrees core. There is no `en-US` catalogue, the source text is the `en-US` text. `en-GB` holds the British variants of changed texts and no copy of the source text. When a source text changes its spelling, change the `msgid` in every catalogue in the same commit so that no entry turns fuzzy.
    - A plural entry is either left empty entirely or has every form filled in, and the number of forms (the `msgstr[N]` slots of an empty entry included) is the number the webtrees plural rule of the locale selects from (`Locale::create($tag)->pluralRule()->plurals()` in `fisharebest/localization`). webtrees ignores the `Plural-Forms` header of the PO, so the header only has to agree with that rule. `tests/CatalogueStructureTest.php` extends the shared catalogue structure case of `webtrees-module-base` and names the catalogue directory. The shared case enforces the form count, the empty forms and the placeholders of the compiled catalogue, the slot count of the source catalogue and the form count in its header, and renders every plural entry for a range of numbers.
- **Every class under `src/` is final**, and a phpat rule in `tests/Architecture/ArchitectureTest.php` enforces it (the rule does not cover traits). The facade tests build a real `Configuration` from a request instead of stubbing it. A class that a test needs to stub is not made final. It is excluded from the rule with a reason.
- **PHPStan runs the shared strict tier** (`phpstan.neon` includes `phpstan/strict.neon` of `magicsunday/coding-standard`, which needs `shipmonk/phpstan-rules`, `symplify/phpstan-rules` and `spaze/phpstan-disallowed-calls` as devDependencies). Fix a finding in code. An irreducible idiom conflict gets an `ignoreErrors` entry scoped by identifier and path with a comment, never a baseline.
- Keep PHPStan, PHPCS, and CPD clean on affected code. Add the PHPUnit tests that the testing policy below calls for, each with its attribute-based coverage target.
- `install`, `build`, `watch`, `lint-fix`, `unlink-chart-lib` and the lang targets run as the numeric user of the caller in the webtrees-docker tooling image, so they leave no root-owned files. Files that an earlier run as root left in `node_modules` are removed with `make clean`, or via: `docker compose run --rm buildbox-root bash -c "rm -rf app/vendor/magicsunday/webtrees-fan-chart/node_modules"`. Root-owned files elsewhere in the checkout are given back once, from the checkout on the Docker host, with `docker run --rm -v "$PWD":/app -w /app alpine find . -xdev -user 0 -exec chown -h "$(id -u):$(id -g)" {} +`.
- **Typecheck scope is intentionally limited to production sources** (`tsconfig.json` includes only `resources/js/modules/**/*.js`). Tests under `resources/js/tests/**` are validated by jest at runtime but skipped by `tsc --noEmit` because the partial mock objects required to isolate units would otherwise produce dozens of structural-incompatibility errors against the real `Configuration` / `Selection` shapes. The typecheck gate applies to shipped code; test scaffolding stays loose.

<!-- testing-policy:begin v1 -->
## Testing policy

Tests protect behavior whose regression would be materially incorrect, unsafe,
destructive or hard to notice before release. They are not a coverage target and
they are not a mutation-score target.

Protect these with durable tests:
- security and privacy boundaries, including untrusted data reaching a path,
  archive member, URL, header, query, command or DOM sink
- confidentiality outside access checks (secrets or personal data in logs,
  exceptions, temporary files, caches, exports, URLs)
- data integrity across import, export, update and migration
- lifecycle and failure semantics: atomic writes, rollback, cleanup, idempotency,
  retries, partial failure, and ordering where the order is the protocol
- calculation and decision rules, including their boundaries
- compatibility boundaries: public API, serialized formats, extension interfaces,
  persisted configuration keys, producer and consumer contracts
- every fixed behavioral bug (some test must fail on the old behavior). A bug
  that is only a wrong label, CSS class or default is not behavioral unless a
  named consumer breaks on it.

For side effects assert the postcondition and the identity of the affected
resource, not only that a collaborator was called.

Do not add tests whose only content is:
- a getter, setter, constructor that only stores values, DTO, enum or constant,
  unless it carries a persisted key or a serialized format from the list above
- a CSS class list, a label or message text, or a default value, unless the exact
  value is a documented interface that a named consumer breaks on. Prefer testing
  the consuming behavior over the producer literal and pin only the minimum literal.
- transparent delegation that adds no argument selection, ordering, error
  translation or security context
- the text of source files instead of the behavior they produce

Order and default assertions are fine when they encode a safety property, for
example authorize before the side effect, write before rename, private unless
made public.

A test that a reviewer, human or agent, questions must show the observable
behavior or invariant it protects, a plausible faulty change it rejects, and for
a pinned literal the consumer that would break. Mutating the code or reverting
the fix and watching the test fail is the way to show it.
<!-- testing-policy:end -->

Where the testing policy and the changed-lines mutation gate point to different answers, the policy wins. A surviving mutant that only a test of a kind the policy excludes could kill, such as a getter, a literal or a default, is answered with an `ignore` entry of its mutator in `infection.json5` with a comment that names the reason. It is never answered with a test that pins the value.

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
- **Privacy of the node tree**: `DataFacade` has no privacy check of its own. It relies on the relation getters and on the processors of webtrees and the module base, so a person that the viewer may not see stays in the chart as a stub. The stub holds the xref, the URLs built from them, the sex, the generation (its position in the tree) and the placeholder name "Private", and its dates, places, image, silhouette and facts are empty. The chart box of core (`resources/views/chart-box.phtml`) also shows details of a person only while `canShow()` is true, so a chart centred on a guessed xref of a private person shows the same stub as a core chart. `tests/Facade/DataFacadePrivacyTest.php` pins this against the real privacy engine of webtrees with a real imported tree, as an administrator control and as a visitor.
- **Record preload**: before `DataFacade` walks the ancestors it loads the parent families and all their members, the children included because the visibility check of a family reads them, one generation at a time, in chunked statements, and puts the families into the record cache of webtrees under the key that `FamilyFactory` reads. The walk then finds every record in the cache, so the statements of a request grow with the number of generations and not with the number of people. A family with a pending change is left to the factory, which decides what an editor sees of it. A webtrees release that changes the cache key of the family factory leaves the preload without effect, and `tests/Facade/DataFacadeQueryCountTest.php` fails then, because it counts the statements of a request over a real imported pedigree.
- **Model/Node, NodeData** — Tree node with JSON serialization for D3. `NodeData` adds the key `facts` to its payload only when the list is not empty.
- **Shared classes from [`magicsunday/webtrees-module-base`](https://github.com/magicsunday/webtrees-module-base)** (composer dependency, the constraint is in `composer.json`):
  - `Processor/FactResolver`: the fact slots of a person (birth, death, the marriage and the divorce of the families of the person with the name of the spouse in `partner`, which the resolver adds by itself because the administration offers only facts of a person, and the optional tags of the tree preference `CHART_BOX_TAGS`). `DataFacade` builds it privately with the full place name, whatever place format the chart arcs use, and puts the slots into the payload of every node, the descendants included, only while `Configuration::getShowDetailPanel()` is on, so a chart without the detail panel pays neither their payload nor their database work. The facade drops the resolver at the start of every `createTreeStructure()` call, because it belongs to the tree of one request.
  - `Processor/DateProcessor` — generation-aware date formatting; DataFacade calls the `getFormatted*` methods (compact DD.MM.YYYY) rather than the locale-aware legacy methods.
  - `Processor/NameProcessor`, `Processor/ImageProcessor`, `Processor/PlaceProcessor` — name/image/place extraction.
  - `Model/Symbols` — backed enum for genealogical symbols (Birth ★, Death †, MarriageDateUnknown sentinel).
  - `Module/VersionInformation` — GitHub release-checking with file cache.
  - `View/SharedViews`: registers the view namespace of the package (`SharedViews::NAMESPACE`), `Module::boot()` calls `SharedViews::register()`. `page.phtml` renders the shared `toolbar-style` view once, with the container class `webtrees-fan-fullscreen-container`, and the shared `detail-panel` view, and `help-button.phtml` renders the shared `help-popover` view. Each of these views writes its rules in a style element of its own, so they are in the document from the first paint and the stylesheet of the module carries only the rules of this chart. The module passes its own translated strings, because xgettext reads only the `I18N::translate` literals of this module.
  - For local edits to module-base while developing fan-chart, run `make link-base` (symlinks `.build/vendor/.../webtrees-module-base` → the sibling clone). Reverse with `make unlink-base` or any `composer install/update`.
  - For local edits to chart-lib, run `make link-chart-lib` (symlinks `node_modules/@magicsunday/webtrees-chart-lib` → the sibling clone, with a relative target so it also resolves inside the node container). Reverse with `make unlink-chart-lib` or any `npm install`.

### JS (`resources/js/modules/`)
Flat layout — every file is fan-chart-specific glue. Reusable base classes (Storage, ChartExport, ChartOverlay, ChartZoom, Orientations, measureText, truncateNames) live in the external [`@magicsunday/webtrees-chart-lib`](https://github.com/magicsunday/webtrees-chart-lib) package, shared with the pedigree- and descendants-chart modules. Consumed via Git URL pinned in `package.json` (`github:magicsunday/webtrees-chart-lib#vX.Y.Z`); chart-lib's `prepare` script builds its `dist/` during install, so `npm ci --ignore-scripts` will break the build.
- **`index.js`** — Exports `FanChart` class (ES module entry point for Rollup).
- **`configuration.js`** — Holds the runtime settings of the chart. It has no defaults of its own, because `chart.phtml` passes a value for every option from `Configuration.php` and the server owns the defaults. A missing option stays undefined, and only `generations`, `fanDegree` and `innerArcs` fall back to a finite number when their value is not one. A test builds it from `createConfigurationValues()` in `resources/js/tests/helpers/configuration-values.js` and overrides only what it exercises.
- **`page-entry.js` / `page-init.js`** — UMD bundle (`fan-chart-page.min.js`) loaded by `page.phtml`. Owns localStorage form-state wiring; `initPage()` resolves user options and publishes them under `WebtreesFanChart.chartOptions` for `chart.phtml` getters.
- **Help popover**: `initHelpPopover()` and `syncHelpMode()` come from `@magicsunday/webtrees-chart-lib/infra`, which holds their behaviour and their tests. `initHelpPopover()` toggles the popover of the help button, mirrors the state in `aria-expanded` on the button and closes an open popover on Escape. The markup and the rules of the popover are the shared `help-popover` view, rendered by `resources/views/modules/components/buttonbar/help-button.phtml` with the rows of this module. The rows marked with a mode describe the tooltip mode or the detail panel mode of the chart, and the rows without a mode apply to both. `syncHelpMode("tooltip")` shows the rows of the mode that the checkbox `showDetailPanel` has at that moment, with `tooltip` as the mode while the panel is off, and `page-init.js` calls it where it sets the AJAX URL of the chart (on load and when the descendants switch loads the chart again), because the chart takes its mode from that load and not from a tick that is not submitted yet.
- **Detail panel**: `DetailPanel` and `PanelSelection` come from `@magicsunday/webtrees-chart-lib/chart-core`, which holds their behaviour and their tests. This module provides the markup (the shared `detail-panel` view, rendered by `page.phtml` with the module class `webtrees-fan-detail-panel`, hidden unless the switch `showDetailPanel` is on, with its parts marked by `data-panel`), the wiring and the highlight of the selected person in `svg.css`. The shared rules of the panel come with the `detail-panel` view. `index.js` creates the panel when the switch is on and hands it the callbacks `onIndividual`, `onCenter`, `onClose` and `onHidden`. A chart that replaces the chart of an open panel on the same page closes that panel, also when the switch of the new chart is off, and the callbacks then act on the new chart. `chart.js` makes a click or Enter select the person instead of navigating and passes `clearSelection` and `restoreFocus` on to the selection. The person arcs are focusable and operable with Enter or Space in both modes, and after a key press has centered the chart the focus goes to the first drawn arc of that person once the chart is drawn again, unless the user has moved the focus to another control meanwhile. A click on an empty part of the page while the update runs puts the focus on the body, which counts as a lost focus, so the arc takes the focus anyway. That case cannot be told apart from a removed arc without extra tracking, and the limit is accepted. `svg/tooltip-renderer.js` binds the tooltip handlers only while the panel is off. The facts and the image come with the node payload. When the panel closes by its button or Escape, the focus goes back to the person first. In every case the selected mark is cleared. The selection belongs to the person and not to an arc. A person who is drawn in several arcs is marked in all of them. When the focus goes back to the selected person it goes to the arc that was clicked, and after an update to the first drawn one of these arcs. The server reads the facts only while the switch is on, so `page-init.js` sends the stored state of the checkbox with the chart request and does not publish it in `chartOptions`.
- **`chart.js`** (D3 partition layout, click handling and selection), **`chart-updater.js`** (AJAX update, transitions), **`draw-rules.js`** (which records are drawn and the family color setup, shared by the render and the update), **`hierarchy.js`** (D3 hierarchy, symbol constants), **`descendant-layout.js`** (angle scale, narrowest child fraction and compact-children flag of the descendant sector, owned by the hierarchy and read by `Geometry`), **`motion.js`** (`motionDuration()` returns zero for an animation when the user prefers reduced motion, and the transitions of the chart and of the zoom reset take their duration through it), **`configuration.js`**, **`svg.js`**.
- **`svg/`** — person/text/marriage/tooltip rendering, `name-parts.js` (pure splitting of a name into label parts), `arc-label-layout.js` (label style, slot positions and line widths of an arc, the vertical stack of the center label and the rotation of the lines of an outer label, no drawing), `arc.js` (shared arc DOM helper), `arc-factory.js`, `geometry.js`, `lifecycle.js`, `family-color.js`, `filter.js`, `text-metrics.js` (the font family, size and weight that the labels of one render pass are measured with, each distinct styling read from the computed style once per pass because every read of a freshly built label makes the browser calculate the style of the whole tree), `tooltip-renderer.js`.
- **`d3.js`** — D3 facade re-exporting only the d3 sub-packages used by the chart (selection, transition, zoom, hierarchy, scale, etc.).

### Views (`resources/views/`)
- **`modules/fan-chart/page.phtml`** — Form + AJAX container, and the shared toolbar style. Loads `fan-chart-page.min.js` and calls `WebtreesFanChart.initPage({ ajaxUrl, defaults… })`.
- **`modules/fan-chart/chart.phtml`** — AJAX response: `<script type="module">` with `import()` to load ES module bundle. Reads user overrides from `WebtreesFanChart.chartOptions ?? PHP defaults`.

### Data-relevant config parameters
The server builds the base of the initial AJAX route (`Module::getAjaxRoute()`), the update route of a node (`DataFacade::getUpdateRoute()`) and the redirect after a form post. All three spread `Configuration::getRouteToggleParams()`, so a setting that these routes carry is added to that list. The page script (`page-init.js`) overrides some query keys of the AJAX URL on the client, and `buildAjaxUrl()` there builds the URL for the first load and for the reload of the descendants switch alike, reading the stored settings from the storage when it runs. `generations`, `showPlaces`, `showDescendants` and `showNicknames` come from the form and the storage, `detailedDateGenerations` from the server default. A setting that the page changes after load is added there as well.
- `generations` and `showPlaces` are among the settings in that list.
- The place format is an administrator setting that is not in the list. `Configuration::getPlaceFormatChoice()` reads the module preference only, so a `placeFormat` query parameter has no effect, and only the save of the administration form reads the posted value (`getSubmittedPlaceFormatChoice()`).
- `detailedDateGenerations` is an admin preference without a chart form field and is not in the list. It resolves again from the module preferences on the re-centered page.
- Options that only the client consumes (`showImages`, `showNames`, `hideEmptySegments` and similar) are in the list as well, so the re-centered page keeps them.
- Boolean parameters must be sent as `"1"`/`"0"` — webtrees `Validator::boolean()` only accepts `'1'`, `'on'`, `true`, not the string `"true"`.
- Places are displayed only for generations within the `innerArcs` boundary (not `detailedDateGenerations`).

## Key patterns
- **ES module loading**: `import().then(({ FanChart }) => ...)` in `<script type="module">`, avoiding the `webtrees.load()` race condition.
- **Storage flow**: `page-init.js` reads localStorage → publishes resolved options under `WebtreesFanChart.chartOptions` → `chart.phtml` getter reads `opts.x ?? PHP default`.
- **Unique clipPath IDs**: monotonic `clipIdCounter` (in `svg/person.js`) prevents collisions during D3 transitions; `Date.now()` is too coarse when transitions overlap.
- **Overlay independence**: Overlay popup always shows images/places regardless of form toggle states.
- **Display mode and the tooltip**: the display mode (`showNames`, `showImages`) only controls the arcs. `TooltipRenderer` does not read either option and the detail panel has no access to them, so the tooltip photo follows the thumbnail of the node alone, and the tooltip silhouette follows `showTooltipSilhouettes`. The server sets that option from the tree preference `USE_SILHOUETTE` alone (`Module::showTooltipSilhouettes()`), independent of the display mode and of `SHOW_HIGHLIGHT_IMAGES`, which only reaches the arcs and the tooltip photo through the empty thumbnail that the image processor returns. Tests in `tooltip-renderer.test.js` pin that the photo and the silhouette stay in every display mode, and `person.test.js` pins that the arc image follows `showImages` and not the tooltip option.
- **One updater per chart**: `Chart` keeps a single `ChartUpdater`, so a newer update aborts the pending request of the older one through the `AbortController` of the updater. A superseded update calls `onSuperseded` instead of its callback, and the chart releases the count in `_runningUpdates` there, because only a callback that rebinds the chart does that otherwise.
- **Page listeners**: the `fullscreenchange` listener on `document` and the orientation listener on `screen.orientation` belong to the page. `FanChart.addEventListeners()` ends the listeners of the chart built before through one `AbortController`, so a chart that is built again leaves no reachable predecessor, and a browser without `screen.orientation` builds the chart without the orientation listener.
- **Failed update notice**: a failed update (HTTP error, an access denial or a response that is not JSON) puts a `role="alert"` element with the translated `labels.updateFailed` text in a row of its own directly above the svg and leaves the previous chart in place, floating above the svg in fullscreen mode. `update-notice.js` reuses one element and the next successful update removes it. The text comes from the PHP chart parameters, so a new label reaches the page through `chart.phtml`.
- **Once-guard callback**: `endAll` + `.catch()` share a `callbackFired` flag to prevent double-invocation of `updateDone`.
- **D3 interrupt handling**: `endAll` listens to both `"end"` and `"interrupt"` events so the callback fires even when transitions are cancelled.

## Release process
Runs inside the buildbox (requires git, node, npm, composer, jq, zip, gh, sed):
```
make release 3.1.2
make release 3.1.2 NOTES_FILE=/tmp/notes.md
make release VERSION=3.1.2 NOTES="Bug fix release"
```
The `Makefile`, `Make/release.mk`, `Make/node.mk`, `Make/lint.mk`, `Make/dev.mk`, `Make/lang.mk`, `Make/helper/` and the release tests `tests/Release/*.php` apart from `StaleAdvisoryIgnoresTest.php` are shared files of the `magicsunday/coding-standard` template (`templates/webtrees-module/`). Never edit them here. A change goes into the template and comes back with `bin/sync-webtrees-module.php`. The values of this module are in `Make/module.mk` (`MODULE_NAME`, `MODULE_NS`, `SCOPE_NS`, `WEBTREES_CONSTRAINT`, `CHART_LIB_MARKER`, `SHARED_VIEWS`), the one file of the setup that the sync never writes. `tests/Release/StaleAdvisoryIgnoresTest.php` and its fixtures belong to this module only.

Pipeline (`make release X.Y.Z`):
- `release-check` — tools, semver, clean tree, checked out on `main`, no active `make link-base` or `make link-chart-lib` symlink, gh auth (or `GH_TOKEN`).
- `release-prepare` — `sed_edit` macro updates `CUSTOM_VERSION` in `src/Module.php` with a post-write assertion; `jq_edit` macro (with `--indent 4` and post-write assertion) updates `package.json` version + `composer.json` webtrees pin → clean+rebuild JS bundles via `build-js-fresh` → commit → `dist` → signed annotated tag with the version as its message (only after dist succeeds, so a dist failure does not leave a dangling tag).
- `dist`: symlink guard fires before composer touches anything, `composer update --no-dev --no-interaction`, with composer's advisory blocking on (an advisory that webtrees' exact pin holds back is ignored by its id, see the convention above), `git archive HEAD` (respects `.gitattributes` export-ignore), bundles `magicsunday/webtrees-module-base` (`src/`, `LICENSE` and the views named in `SHARED_VIEWS`) into the zip's `vendor/` so manual ZIP installs work without composer, records the resolved module base version in its `VERSION` file, strips all `composer.json` files (`find vendor -name composer.json -delete`), scopes the PHP namespace of the bundled module-base with `SCOPE_NS` and the name of the view namespace that its `SharedViews` registers with `SCOPE_VIEW_NS` (both unique per module, the build fails when a rewrite does not apply), atomic write via `.tmp` + rename + `zip -T` integrity check.
- `dist-smoke`: separate target, asserts required entries (module.php, LICENSE, the versioned JS bundle, module-base `src/` and each of its shared views `detail-panel`, `help-popover` and `toolbar-style`) are present and forbidden ones (composer.json, assets/, dev/, .githooks/, deptrac.yaml, tsconfig.json) are absent, and that the bundled `SharedViews.php` registers the scoped view namespace and not the unscoped one. `tests/Release/DistSmokeTest.php` runs the target against archives built for each case. CI runs this on every pull request and on every push to the branches that `ci.yml` lists.
- `release-publish` — refuses a missing zip before it pushes, then pushes `main` and only the tag of the release version (other local tags stay local), `gh release create` with the zip + notes, emits `RELEASE_PUBLISHED version=X` marker for agent observers only after `gh` succeeded. A failing `gh` call fails the target and keeps the zip, and the temporary notes file is removed on every exit. The rerun after such a failure removes the draft release that an interrupted upload left behind before it creates the release, and it stops on a release that is already published. `tests/Release/ReleasePublishTest.php` runs the target against stubbed `git` and `gh`. An inline `NOTES` reaches the shell as raw text through `NOTES_RAW`, so once make has received it backticks, quotes and dollar signs arrive unchanged and neither make nor the shell runs anything from it. Quote the note with single quotes in the calling shell, because that shell evaluates a command substitution inside double quotes before make sees it. Make drops leading whitespace of a note given on the command line, so a note that needs it goes through `NOTES_FILE` or the environment.
- `release-bump` — bump to `VERSION+1-dev`, keep the stable webtrees constraint (`WEBTREES_CONSTRAINT` in `Make/module.mk`, shared with `release-prepare`), push. The dev tree tracks stable webtrees, not `dev-main`, because the `dev-main` i18n refactor removed APIs the module still uses and stable is what end users install; re-add `|| dev-main` here (and adapt the code) when webtrees' next stable nears.

Rollback of a bad release: a published tag is never moved or deleted. A bad release is superseded by the next patch version. Land the fix on `main` first, then run `make release X.Y.Z` with that next version. If the tag was pushed but the GitHub release failed, the tag stays and `make release` is not run again. Run `make release-publish VERSION=X.Y.Z` on the tagged commit, then `make release-bump VERSION=X.Y.Z` on `main` and `make release-clean`, as the comments in `Make/release.mk` describe.

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
- The workflows of this repository call the reusable workflows of the `magicsunday/.github` repository at `@main`. A change on `main` of that repository therefore takes effect here without a review in this repository. That is an accepted risk, because both repositories belong to the same account and the same choice applies to every module that uses the shared workflows, so a pin would have to be decided and bumped there. The documented usage of the shared workflows is `@main` as well. The risk is kept small elsewhere, since external actions are pinned by commit SHA and every workflow declares its permissions at the top.
- Do not commit secrets or PII; rely on secret managers and keep .build outputs out of version control.

## PR/commit checklist
- `composer ci:test` must pass before every commit.
- Commit subjects — and the pull-request title — are governed by the shared `commit-convention` gate; the normative rule and its full rationale live in `magicsunday/.github/.github/workflows/commit-convention.yml@main`, which self-tests a decision table before applying it. In short: a `GH-`-prefixed subject must match `^GH-\d+: [A-Z]`, every other subject `^[A-Z]` — a capitalised English imperative — and conventional-commit prefixes (`feat:`, `Fix:`, …) as well as path-like starts (`src/…: …`) are rejected whatever their case. It runs on every pull request via `.github/workflows/commit-lint.yml`, advisory until `commit-convention / Commit convention` is a required context in branch protection.
- Branches for an issue are named exactly `GH-<N>`; the `GH-<N>: ` prefix marks work that belongs to that issue, so a drive-by fix on the branch keeps its own unprefixed subject.
- The pull-request body closes the issue with `Closes #<N>` — the `GH-<N>: ` subject prefix is not a GitHub link and closes nothing.
- Never add a `Co-Authored-By:` trailer or any other AI attribution.
- Keep PRs small and focused (~≤300 net LOC) with atomic commits.
- Cover the behavior that the testing policy lists with tests. Coverage is a diagnostic here, not a target.
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
