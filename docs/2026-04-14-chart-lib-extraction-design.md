# Design: Extract shared chart library (`@magicsunday/webtrees-chart-lib`)

**Date:** 2026-04-14
**Status:** Draft
**Author:** Rico Sonntag + Claude

## Problem

The `lib/chart/` directory and `lib/storage.js` exist as identical copies in three
chart repos:
- `webtrees-fan-chart`
- `webtrees-pedigree-chart`
- `webtrees-descendants-chart`

Changes must be manually synchronized. The fan-chart `lib/` is the canonical source;
pedigree and descendants follow.

Note: pedigree-chart and descendants-chart also have `lib/tree/` and `lib/common/`
directories that are shared between those two repos but do **not** exist in the
fan-chart. These are out of scope for this extraction (they could become a separate
package later, or be promoted into this library when they are generalized).

Within the fan-chart, Person and Marriage duplicate arc rendering, text truncation,
and lifecycle patterns.

## Goals

1. Consolidate shared patterns within the fan-chart (arc factory, text truncation,
   lifecycle utilities)
2. Extract `lib/chart/` and `lib/storage.js` into a standalone npm package
   `@magicsunday/webtrees-chart-lib` published on GitHub Packages
3. Migrate all three chart repos to consume the package as a dependency
4. Design the library to be fully generic — no chart-specific logic

## Non-Goals

- Monorepo — each chart keeps its own repository
- PHP-side changes — only JavaScript modules affected
- Full generalization of all chart-specific code in one step (incremental approach)
- Extracting `lib/tree/` or `lib/common/` from pedigree/descendants (separate effort)

## Package Structure

```
@magicsunday/webtrees-chart-lib/
  src/
    storage.js                      # localStorage persistence
    chart/
      ChartOverlay.js               # Instructional hint overlay
      svg/
        SvgDefs.js                  # <defs> wrapper
        ChartZoom.js                # D3 zoom (Ctrl+Wheel, Pinch)
        ChartExport.js              # Export base class
        ChartExportFactory.js       # PNG/SVG dispatch
        export/
          PngChartExport.js         # Canvas-based PNG export
          SvgChartExport.js         # Style-inlining SVG export
      text/
        measure.js                  # Canvas text measurement
    index.js                        # Public API
  dist/                             # Build output (ES module only)
  package.json
  rollup.config.js
  README.md
```

## Public API

```javascript
// src/index.js
export { Storage } from "./storage.js";
export { ChartOverlay } from "./chart/ChartOverlay.js";
export { SvgDefs } from "./chart/svg/SvgDefs.js";
export { ChartZoom } from "./chart/svg/ChartZoom.js";
export { ChartExport } from "./chart/svg/ChartExport.js";
export { ChartExportFactory } from "./chart/svg/ChartExportFactory.js";
export { PngChartExport } from "./chart/svg/export/PngChartExport.js";
export { SvgChartExport } from "./chart/svg/export/SvgChartExport.js";
export { measureText } from "./chart/text/measure.js";
```

### Naming Convention

All exports use prefixed names for unambiguous usage without import-path context:

| Current name | New name | Reason |
|--------------|----------|--------|
| `Defs` | `SvgDefs` | Avoids collision with generic "Defs" |
| `Zoom` | `ChartZoom` | Distinguishes from d3.zoom |
| `Overlay` | `ChartOverlay` | More specific than generic "Overlay" |
| `Export` | `ChartExport` | Base class — "Export" alone too vague |
| `ExportFactory` | `ChartExportFactory` | Consistent with ChartExport |
| `PngExport` | `PngChartExport` | Consistent |
| `SvgExport` | `SvgChartExport` | Consistent |
| `Storage` | `Storage` | Already clear |
| `measureText` | `measureText` | Already clear |

### What stays chart-specific

- **SvgFilter** (drop shadow) — only used by fan-chart, stays in `custom/svg/`
- **d3.js facade** — not re-exported; each chart imports D3 directly

### D3 Handling

The library does **not** re-export D3 modules. Each chart imports D3 directly as its
own devDependency. The library declares D3 modules it uses internally as
`peerDependencies` to avoid duplicate bundles.

Rationale:
- The d3.js facade is a pure re-export with no logic
- Each chart needs different D3 subsets (fan: d3-shape, pedigree: d3-path)
- A shared facade would either export everything or still require chart-specific imports
- Less API surface = fewer breaking changes on D3 upgrades

**Important:** All lib source files that currently import from the local `d3.js` facade
(e.g., `import * as d3 from "../../d3"`) must be rewritten to import directly from the
specific D3 modules they use (e.g., `import { zoom } from "d3-zoom"`). This applies to
at least: `ChartZoom.js`, `ChartOverlay.js`, `ChartExport.js`, and the export subclasses.

`ChartOverlay` calls `.transition()` on D3 selections without importing `d3-transition`
directly — it relies on the ambient side-effect import from the chart bundle. The lib
source must add an explicit `import "d3-transition"` to ensure the Selection prototype
is patched when the lib is consumed in isolation.

## Package Configuration

```json
{
  "name": "@magicsunday/webtrees-chart-lib",
  "version": "1.0.0",
  "license": "GPL-3.0-or-later",
  "type": "module",
  "module": "dist/webtrees-chart-lib.es.js",
  "exports": {
    ".": {
      "import": "./dist/webtrees-chart-lib.es.js"
    }
  },
  "files": ["dist/"],
  "peerDependencies": {
    "d3-transition": "^3.0",
    "d3-zoom": "^3.0"
  }
}
```

- **`files`**: Only `dist/` is published. Source is in the repo for contributors.
- **ES module only**: All three chart repos consume via Rollup — no UMD consumer exists.
  UMD can be added later if a need arises.
- **peerDependencies**: Charts bring their own D3 version; the lib declares what it needs.

## Build Configuration

```javascript
// rollup.config.js
import resolve from "@rollup/plugin-node-resolve";

export default {
    input: "src/index.js",
    external: [
        "d3-transition",
        "d3-zoom",
    ],
    output: [
        {
            file: "dist/webtrees-chart-lib.es.js",
            format: "es",
        },
    ],
    plugins: [
        resolve(),
    ],
};
```

**Critical:** D3 peerDependencies must be listed as `external` in the rollup config.
Without this, Rollup bundles D3 into the lib output, and the consuming chart bundles
D3 again — resulting in two copies. This breaks `d3-zoom` (which patches the Selection
prototype) and doubles bundle size.

## Publish & Auth

**Publish:** GitHub Packages via GitHub Actions.
- Trigger: git tag `vX.Y.Z`
- Automatic publish to `https://npm.pkg.github.com`
- Workflow needs `permissions: { contents: write, packages: write }`

**Consumer setup:** Each chart repo adds `.npmrc` (committed to repo):
```
@magicsunday:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

The `${GITHUB_TOKEN}` placeholder is resolved at runtime by the shell — never hardcoded.
- **CI (GitHub Actions):** `GITHUB_TOKEN` is provided automatically
- **Local (buildbox):** Injected via
  `GH_TOKEN=$(gh auth token) docker compose run --rm -e GITHUB_TOKEN=$GH_TOKEN buildbox ...`

This follows the same pattern already used for `gh` CLI auth in the release workflow.

**Versioning:** SemVer.
- Major: breaking API changes (renames, removals)
- Minor: new exports, new features
- Patch: bugfixes

## Fan-Chart Internal Consolidation

Before extracting the lib, shared patterns within the fan-chart are consolidated.
These live in `custom/svg/` (chart-specific, not in the lib) but reduce duplication
between Person and Marriage.

Phase 1 must complete before Phase 2 begins — the fan-chart `lib/` is the canonical
source for the extracted package, and Phase 1 ensures the codebase is clean before
the extraction snapshot is taken.

### New utilities

**`arc-factory.js`** — `createArcGenerator(geometry, config, datum)`
- Extracted from Person.addArcToPerson() and Marriage.addArc()
- Configures d3.arc() with geometry-derived radii, angles, padding
- Eliminates ~15 lines of duplication per class

**`text-truncation.js`** — `truncateToFit(element, maxWidth, ellipsis)`
- Extracted from Marriage.addLabel() and Text.renderTimespanLines()
- Character-by-character removal loop with ellipsis append
- Single implementation, two call sites

**`lifecycle.js`** — Element lifecycle utilities
- `classifyElement(element)` returns `{isNew, isUpdate, isRemove}`
- `fadeIfUpdating(element, parent)` sets opacity to 1e-6 when parent is updating
- Extracted from Person.init(), Marriage.init(), LabelRenderer.addLabel()

### Design decision: composition over inheritance

Person and Marriage remain separate classes. Their differences (images, tooltips,
color strips vs. single date label) are too significant for a shared base class.
The shared patterns are consumed via utility imports, not inheritance.

## Migration Path

### Phase 1: Fan-chart consolidation (current branch)

1. Extract arc-factory, text-truncation, lifecycle utilities into `custom/svg/`
2. Refactor Person and Marriage to use the new utilities
3. Verify all tests pass, verify in browser

### Phase 2: Create the library package

1. Create repo `magicsunday/webtrees-chart-lib`
2. Copy `lib/chart/` and `lib/storage.js` contents from fan-chart into `src/`
3. Apply naming convention (Defs -> SvgDefs, etc.)
4. Rewrite D3 imports: replace relative `../../d3` facade imports with direct
   D3 module imports (e.g., `import { zoom } from "d3-zoom"`)
5. Add explicit `import "d3-transition"` to ChartOverlay (ambient dependency)
6. Convert `measure.js` from default export to named export (`measureText`)
7. Reconcile `storage.js` field name: use `_storageKey` (fan-chart canonical)
   instead of `_name` (pedigree/descendants variant)
8. Set up rollup build with `external` list for D3 peerDependencies
9. Set up `.npmrc` with `${GITHUB_TOKEN}` placeholder
10. Set up GitHub Actions publish workflow (tag trigger)
11. Set up jest test suite (tests transfer from fan-chart `lib/` tests)
12. Tag and publish v1.0.0

### Phase 3: Migrate fan-chart

1. Add `.npmrc` with GitHub Packages registry + token placeholder
2. `npm install @magicsunday/webtrees-chart-lib`
3. Replace all `import ... from "../lib/..."` with
   `import ... from "@magicsunday/webtrees-chart-lib"`
4. Update class names to new prefixed names
5. Remove `lib/chart/`, `lib/storage.js`, `lib/d3.js` from fan-chart repo
   (keep `lib/` directory only if other files remain)
6. Update jest moduleNameMapper if needed for new import paths
7. Verify build, tests, browser

### Phase 4: Migrate pedigree-chart and descendants-chart

1. Same as Phase 3 for each repo
2. Update `storage.js` internal field name `_name` → `_storageKey` if not
   already aligned (private field, no external API break)
3. Remove shared `lib/chart/`, `lib/storage.js`, `lib/d3.js` from each repo
   (keep `lib/tree/`, `lib/common/`, `lib/constants.js` — these are not
   part of the extracted package)

### Future phases (incremental)

As pedigree-chart and descendants-chart are extended, additional shared patterns
can be promoted to the library:

- **Geometry** — base class with `innerRadius()`, `outerRadius()`, `startAngle()`,
  `endAngle()` interface; fan-chart provides radial implementation, pedigree/descendants
  could add cartesian variants
- **Hierarchy** — base class for D3 hierarchy setup; chart-specific subclasses for
  partition vs tree layout
- **Orientation** — abstract layout direction system (already a pattern in
  pedigree/descendants)
- **Configuration** — base properties (fontSize, padding, rtl, labels) in lib;
  chart-specific extensions in custom/
- **FamilyColor** — generalized ColorScheme system usable by multiple charts
- **Text truncation** — promote from fan-chart custom/ to lib once
  pedigree/descendants need it
- **`lib/tree/` + `lib/common/`** — shared between pedigree and descendants;
  could become part of this package or a second shared package

Each promotion follows the same pattern: extract, generalize the interface, publish
a minor version bump, migrate consumers.

## Testing Strategy

- Library gets its own test suite (jest, same setup as chart repos)
- Tests transfer from fan-chart `lib/` tests but require adaptation: D3 import
  paths must be rewritten (facade removal), `measure.js` assertions must use the
  named export (`measureText`), and `storage.js` tests must reference `_storageKey`
- Chart repos keep their integration tests but drop unit tests for lib components
  (those now live in the lib repo)
- CI for the lib runs independently; chart CI consumes published versions
- During Phase 3 development (before v1.0.0 is published), the chart can use
  `npm install ../path/to/webtrees-chart-lib` or `npm pack` + file reference
  for local testing

## Risk Assessment

**Low risk:**
- The `lib/chart/` and `lib/storage.js` code is stable and shared across repos
- No functional changes during extraction, only module boundaries
- Each phase can be merged independently

**Medium risk:**
- D3 version drift between charts — mitigated by peerDependencies with `^` ranges
- Minor divergences in lib files across repos (e.g., `storage.js` field naming) —
  mitigated by documenting fan-chart as canonical source and reconciling in Phase 2

**Rollback:** Revert the migration commits in the affected chart repo. The lib code
is preserved in git history and can be restored to `lib/` from any pre-migration
commit. The package approach can be abandoned without data loss.
