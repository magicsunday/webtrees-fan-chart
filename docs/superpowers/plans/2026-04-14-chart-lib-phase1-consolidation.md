# Phase 1: Fan-Chart Internal Consolidation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract shared patterns from Person and Marriage into reusable utilities (lifecycle, text-truncation, arc-factory) to reduce duplication before the lib extraction in Phase 2.

**Architecture:** Composition over inheritance — Person and Marriage stay separate classes. Three new utility modules in `custom/svg/` provide shared functions consumed via imports. No base class.

**Tech Stack:** ES modules, D3.js, Jest (ESM via `--experimental-vm-modules`), Rollup

**Spec:** `docs/2026-04-14-chart-lib-extraction-design.md`

**Build command:** `cd /volume2/docker/webtrees && docker compose run --rm buildbox bash -c "cd app/vendor/magicsunday/webtrees-fan-chart && <command>"`

**Test command:** `npm test` (alias for `node --experimental-vm-modules node_modules/jest/bin/jest.js --passWithNoTests`)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `resources/js/modules/custom/svg/lifecycle.js` | `classifyElement()`, `fadeIfUpdating()` |
| Create | `resources/js/modules/custom/svg/text-truncation.js` | `truncateToFit()` |
| Create | `resources/js/modules/custom/svg/arc-factory.js` | `createArcGenerator()` |
| Create | `resources/js/tests/modules/custom/svg/lifecycle.test.js` | Tests for lifecycle utilities |
| Create | `resources/js/tests/modules/custom/svg/text-truncation.test.js` | Tests for truncateToFit |
| Create | `resources/js/tests/modules/custom/svg/arc-factory.test.js` | Tests for createArcGenerator |
| Modify | `resources/js/modules/custom/svg/person.js:72-74,355-366` | Use lifecycle + arc-factory |
| Modify | `resources/js/modules/custom/svg/marriage.js:65-67,124-151,244-247` | Use lifecycle + arc-factory + truncation |
| Modify | `resources/js/modules/custom/svg/label-renderer.js:51` | Use fadeIfUpdating |
| Modify | `resources/js/modules/custom/svg/text.js:504-516` | Use truncateToFit |

---

### Task 1: Extract lifecycle utilities

**Files:**
- Create: `resources/js/modules/custom/svg/lifecycle.js`
- Create: `resources/js/tests/modules/custom/svg/lifecycle.test.js`

- [ ] **Step 1: Write failing tests for classifyElement and fadeIfUpdating**

```javascript
// resources/js/tests/modules/custom/svg/lifecycle.test.js
import { describe, it, expect, beforeEach } from "@jest/globals";
import { classifyElement, fadeIfUpdating } from "resources/js/modules/custom/svg/lifecycle";

function createMockElement(classes = {}) {
    const classMap = { new: false, update: false, remove: false, ...classes };

    return {
        classed: (name) => classMap[name] ?? false,
    };
}

function createMockSelection() {
    let opacity = null;

    return {
        style: (prop, value) => { if (prop === "opacity") opacity = value; },
        getOpacity: () => opacity,
    };
}

describe("classifyElement", () => {
    it("detects new elements", () => {
        const el = createMockElement({ new: true });
        const result = classifyElement(el);

        expect(result).toEqual({ isNew: true, isUpdate: false, isRemove: false });
    });

    it("detects update elements", () => {
        const el = createMockElement({ update: true });
        const result = classifyElement(el);

        expect(result).toEqual({ isNew: false, isUpdate: true, isRemove: false });
    });

    it("detects remove elements", () => {
        const el = createMockElement({ remove: true });
        const result = classifyElement(el);

        expect(result).toEqual({ isNew: false, isUpdate: false, isRemove: true });
    });

    it("returns all false for unclassified elements", () => {
        const el = createMockElement();
        const result = classifyElement(el);

        expect(result).toEqual({ isNew: false, isUpdate: false, isRemove: false });
    });
});

describe("fadeIfUpdating", () => {
    it("sets opacity to 1e-6 when parent is updating", () => {
        const parent = createMockElement({ update: true });
        const selection = createMockSelection();

        fadeIfUpdating(selection, parent);

        expect(selection.getOpacity()).toBe(1e-6);
    });

    it("does not set opacity when parent is not updating", () => {
        const parent = createMockElement();
        const selection = createMockSelection();

        fadeIfUpdating(selection, parent);

        expect(selection.getOpacity()).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `SKIP_EXPORT_BUILD=true npm test -- resources/js/tests/modules/custom/svg/lifecycle.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement lifecycle.js**

```javascript
// resources/js/modules/custom/svg/lifecycle.js

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * Reads the D3 lifecycle CSS classes from an element and returns
 * a structured object indicating the element's current state in the
 * enter/update/exit data join.
 *
 * @param {Object} element D3 selection with .classed() method
 *
 * @returns {{ isNew: boolean, isUpdate: boolean, isRemove: boolean }}
 */
export function classifyElement(element) {
    return {
        isNew: element.classed("new"),
        isUpdate: element.classed("update"),
        isRemove: element.classed("remove"),
    };
}

/**
 * Sets a selection's opacity to near-zero when the parent element is
 * in the "update" lifecycle state. Used for cross-fade transitions
 * where new content fades in while old content fades out.
 *
 * @param {Object} selection D3 selection to hide
 * @param {Object} parent    D3 selection of the parent element
 */
export function fadeIfUpdating(selection, parent) {
    if (parent.classed("update")) {
        selection.style("opacity", 1e-6);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SKIP_EXPORT_BUILD=true npm test -- resources/js/tests/modules/custom/svg/lifecycle.test.js`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add resources/js/modules/custom/svg/lifecycle.js resources/js/tests/modules/custom/svg/lifecycle.test.js
git commit -m "Extract lifecycle utilities (classifyElement, fadeIfUpdating)"
```

---

### Task 2: Refactor Person, Marriage, LabelRenderer to use lifecycle utilities

**Files:**
- Modify: `resources/js/modules/custom/svg/person.js`
- Modify: `resources/js/modules/custom/svg/marriage.js`
- Modify: `resources/js/modules/custom/svg/label-renderer.js`

- [ ] **Step 1: Refactor person.js**

Add import at the top of person.js:
```javascript
import { classifyElement, fadeIfUpdating } from "./lifecycle.js";
```

Replace lines 72-74 in `init()`:
```javascript
// Before:
const isNew = person.classed("new");
const isUpdate = person.classed("update");
const isRemove = person.classed("remove");

// After:
const { isNew, isUpdate, isRemove } = classifyElement(person);
```

Find all `label.style("opacity", 1e-6)` patterns gated by update checks in person.js and replace with `fadeIfUpdating(label, person)` where applicable.

- [ ] **Step 2: Refactor marriage.js**

Add import at the top of marriage.js:
```javascript
import { classifyElement } from "./lifecycle.js";
```

Replace lines 65-67 in `init()`:
```javascript
// Before:
const isNew = marriage.classed("new");
const isUpdate = marriage.classed("update");
const isRemove = marriage.classed("remove");

// After:
const { isNew, isUpdate, isRemove } = classifyElement(marriage);
```

- [ ] **Step 3: Refactor label-renderer.js**

Add import at the top of label-renderer.js:
```javascript
import { fadeIfUpdating } from "./lifecycle.js";
```

Replace the update-opacity block around line 51:
```javascript
// Before:
if (parent.classed("update")) {
    label.style("opacity", 1e-6);
}

// After:
fadeIfUpdating(label, parent);
```

- [ ] **Step 4: Run full test suite**

Run: `SKIP_EXPORT_BUILD=true npm test -- --ignore=resources/js/tests/export`
Expected: All tests PASS (no behavioral change)

- [ ] **Step 5: Commit**

```bash
git add resources/js/modules/custom/svg/person.js resources/js/modules/custom/svg/marriage.js resources/js/modules/custom/svg/label-renderer.js
git commit -m "Refactor Person, Marriage, LabelRenderer to use lifecycle utilities"
```

---

### Task 3: Extract text truncation utility

**Files:**
- Create: `resources/js/modules/custom/svg/text-truncation.js`
- Create: `resources/js/tests/modules/custom/svg/text-truncation.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// resources/js/tests/modules/custom/svg/text-truncation.test.js
import { describe, it, expect } from "@jest/globals";
import { truncateToFit } from "resources/js/modules/custom/svg/text-truncation";

function createMockTspan(initialWidth, charWidth = 8) {
    let text = "";
    let width = initialWidth;

    return {
        node: () => ({
            getComputedTextLength: () => width,
        }),
        text: (newText) => {
            if (newText === undefined) return text;
            text = newText;
            width = newText.length * charWidth;

            return undefined;
        },
        getText: () => text,
    };
}

describe("truncateToFit", () => {
    it("does not truncate text that fits", () => {
        const tspan = createMockTspan(50);

        tspan.text("Hello");

        const result = truncateToFit(tspan, 100);

        expect(result).toBe("Hello");
    });

    it("truncates text that exceeds maxWidth and appends ellipsis", () => {
        const tspan = createMockTspan(200, 10);

        tspan.text("A very long name that does not fit");

        const result = truncateToFit(tspan, 50);

        expect(result.endsWith("\u2026")).toBe(true);
        expect(result.length).toBeLessThan("A very long name that does not fit".length);
    });

    it("returns empty string with ellipsis for single-char text that does not fit", () => {
        const tspan = createMockTspan(100, 100);

        tspan.text("X");

        const result = truncateToFit(tspan, 10);

        expect(result).toBe("\u2026");
    });

    it("removes trailing dot before appending ellipsis", () => {
        const tspan = createMockTspan(200, 10);

        tspan.text("Name with trailing.");

        const result = truncateToFit(tspan, 80);

        expect(result.endsWith(".\u2026")).toBe(false);
        expect(result.endsWith("\u2026")).toBe(true);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `SKIP_EXPORT_BUILD=true npm test -- resources/js/tests/modules/custom/svg/text-truncation.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement text-truncation.js**

```javascript
// resources/js/modules/custom/svg/text-truncation.js

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

const ELLIPSIS = "\u2026";

/**
 * Progressively removes trailing characters from the text content of a
 * tspan element until the rendered width fits within maxWidth, then
 * appends an ellipsis. If the text already fits, returns it unchanged.
 *
 * @param {Object} tspan    D3 selection of a <tspan> element
 * @param {number} maxWidth Maximum allowed rendered width in pixels
 *
 * @returns {string} The final (possibly truncated) text
 */
export function truncateToFit(tspan, maxWidth) {
    let text = tspan.text();

    while ((tspan.node().getComputedTextLength() > maxWidth) && (text.length > 1)) {
        text = text.slice(0, -1).trim();
        tspan.text(text);
    }

    if (text.length < tspan.text().length || tspan.node().getComputedTextLength() > maxWidth) {
        // Remove trailing dot before adding ellipsis
        if (text.endsWith(".")) {
            text = text.slice(0, -1).trim();
        }

        text = text + ELLIPSIS;
        tspan.text(text);
    }

    return text;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SKIP_EXPORT_BUILD=true npm test -- resources/js/tests/modules/custom/svg/text-truncation.test.js`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add resources/js/modules/custom/svg/text-truncation.js resources/js/tests/modules/custom/svg/text-truncation.test.js
git commit -m "Extract text truncation utility (truncateToFit)"
```

---

### Task 4: Refactor Marriage and Text to use truncateToFit

**Files:**
- Modify: `resources/js/modules/custom/svg/marriage.js`
- Modify: `resources/js/modules/custom/svg/text.js`

- [ ] **Step 1: Refactor marriage.js addLabel()**

Add import at the top of marriage.js:
```javascript
import { truncateToFit } from "./text-truncation.js";
```

Replace the truncation while-loop around lines 244-247 in `addLabel()`:
```javascript
// Before:
while ((tspan.node().getComputedTextLength() > arcLength) && (label.length > 1)) {
    label = label.slice(0, -1).trim();
    tspan.text(label);
}
// ... trailing dot + ellipsis logic

// After:
truncateToFit(tspan, arcLength - LABEL_ARC_PADDING);
```

Note: Check the exact `maxWidth` value. Marriage uses `arcLength` with a padding constant subtracted. Pass the net width.

- [ ] **Step 2: Refactor text.js renderTimespanLines()**

Add import at the top of text.js:
```javascript
import { truncateToFit } from "./text-truncation.js";
```

Replace the truncation while-loop around lines 504-516:
```javascript
// Before:
while ((textLength > availableWidth) && (text.length > 1)) {
    text = text.slice(0, -1).trim();
    tspan.text(text);
    textLength = that.getTextLength(parent);
}
if (text[text.length - 1] === ".") {
    tspan.text(text.slice(0, -1).trim());
}

// After:
truncateToFit(tspan, availableWidth);
```

Note: text.js uses `that.getTextLength(parent)` instead of `tspan.node().getComputedTextLength()`. The `truncateToFit` function uses the tspan's own `getComputedTextLength()`. Verify that both measure the same thing — if `getTextLength` measures differently (e.g., the parent group width), the refactoring must account for this. Read `getTextLength()` in text.js to confirm before applying.

- [ ] **Step 3: Run full test suite**

Run: `SKIP_EXPORT_BUILD=true npm test -- --ignore=resources/js/tests/export`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add resources/js/modules/custom/svg/marriage.js resources/js/modules/custom/svg/text.js
git commit -m "Refactor Marriage and Text to use truncateToFit utility"
```

---

### Task 5: Extract arc-factory utility

**Files:**
- Create: `resources/js/modules/custom/svg/arc-factory.js`
- Create: `resources/js/tests/modules/custom/svg/arc-factory.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
// resources/js/tests/modules/custom/svg/arc-factory.test.js
import { jest, describe, it, expect } from "@jest/globals";

const arcInstance = {
    startAngle: jest.fn().mockReturnThis(),
    endAngle: jest.fn().mockReturnThis(),
    innerRadius: jest.fn().mockReturnThis(),
    outerRadius: jest.fn().mockReturnThis(),
    padAngle: jest.fn().mockReturnThis(),
    padRadius: jest.fn().mockReturnThis(),
    cornerRadius: jest.fn().mockReturnThis(),
};

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    arc: jest.fn(() => arcInstance),
}));

const { createPersonArcGenerator, createMarriageArcGenerator } = await import(
    "resources/js/modules/custom/svg/arc-factory"
);

const mockGeometry = {
    startAngle: jest.fn((depth, x0) => x0 * Math.PI),
    endAngle: jest.fn((depth, x1) => x1 * Math.PI),
    innerRadius: jest.fn((depth) => 100 + depth * 50),
    outerRadius: jest.fn((depth) => 150 + depth * 50),
};

const mockConfig = {
    padRadius: 300,
    cornerRadius: 5,
};

describe("createPersonArcGenerator", () => {
    it("configures d3.arc with geometry-derived values", () => {
        const datum = { depth: 2, x0: 0.1, x1: 0.3 };

        createPersonArcGenerator(mockGeometry, mockConfig, datum, 0.03);

        expect(arcInstance.startAngle).toHaveBeenCalledWith(mockGeometry.startAngle(2, 0.1));
        expect(arcInstance.endAngle).toHaveBeenCalledWith(mockGeometry.endAngle(2, 0.3));
        expect(arcInstance.innerRadius).toHaveBeenCalledWith(mockGeometry.innerRadius(2));
        expect(arcInstance.outerRadius).toHaveBeenCalledWith(mockGeometry.outerRadius(2));
        expect(arcInstance.padAngle).toHaveBeenCalledWith(0.03);
        expect(arcInstance.padRadius).toHaveBeenCalledWith(300);
        expect(arcInstance.cornerRadius).toHaveBeenCalledWith(5);
    });
});

describe("createMarriageArcGenerator", () => {
    it("configures d3.arc with explicit radii and angles", () => {
        createMarriageArcGenerator(mockConfig, {
            startAngle: 0.5,
            endAngle: 1.2,
            innerR: 200,
            outerR: 220,
        });

        expect(arcInstance.startAngle).toHaveBeenCalledWith(0.5);
        expect(arcInstance.endAngle).toHaveBeenCalledWith(1.2);
        expect(arcInstance.innerRadius).toHaveBeenCalledWith(200);
        expect(arcInstance.outerRadius).toHaveBeenCalledWith(220);
        expect(arcInstance.padAngle).toHaveBeenCalledWith(0);
        expect(arcInstance.padRadius).toHaveBeenCalledWith(0);
        expect(arcInstance.cornerRadius).toHaveBeenCalledWith(5);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `SKIP_EXPORT_BUILD=true npm test -- resources/js/tests/modules/custom/svg/arc-factory.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement arc-factory.js**

```javascript
// resources/js/modules/custom/svg/arc-factory.js

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import * as d3 from "../../lib/d3";

/**
 * Creates a d3.arc() generator configured for a person arc segment using
 * geometry-derived radii and angles from the D3 partition datum.
 *
 * @param {Object} geometry  Geometry instance for radius/angle calculations
 * @param {Object} config    Configuration with padRadius, cornerRadius
 * @param {Object} datum     D3 partition datum (depth, x0, x1)
 * @param {number} padAngle  Gap angle between adjacent arcs in radians
 *
 * @returns {Function} Configured d3.arc() generator
 */
export function createPersonArcGenerator(geometry, config, datum, padAngle) {
    return d3.arc()
        .startAngle(geometry.startAngle(datum.depth, datum.x0))
        .endAngle(geometry.endAngle(datum.depth, datum.x1))
        .innerRadius(geometry.innerRadius(datum.depth))
        .outerRadius(geometry.outerRadius(datum.depth))
        .padAngle(padAngle)
        .padRadius(config.padRadius)
        .cornerRadius(config.cornerRadius);
}

/**
 * Creates a d3.arc() generator configured for a marriage arc using
 * pre-computed geometry values from _resolveMarriageGeometry().
 *
 * @param {Object} config   Configuration with cornerRadius
 * @param {Object} geometry Pre-computed { startAngle, endAngle, innerR, outerR }
 *
 * @returns {Function} Configured d3.arc() generator
 */
export function createMarriageArcGenerator(config, geometry) {
    return d3.arc()
        .startAngle(geometry.startAngle)
        .endAngle(geometry.endAngle)
        .innerRadius(geometry.innerR)
        .outerRadius(geometry.outerR)
        .padAngle(0)
        .padRadius(0)
        .cornerRadius(config.cornerRadius);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SKIP_EXPORT_BUILD=true npm test -- resources/js/tests/modules/custom/svg/arc-factory.test.js`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add resources/js/modules/custom/svg/arc-factory.js resources/js/tests/modules/custom/svg/arc-factory.test.js
git commit -m "Extract arc-factory utility (createPersonArcGenerator, createMarriageArcGenerator)"
```

---

### Task 6: Refactor Person and Marriage to use arc-factory

**Files:**
- Modify: `resources/js/modules/custom/svg/person.js`
- Modify: `resources/js/modules/custom/svg/marriage.js`

- [ ] **Step 1: Refactor person.js addArcToPerson()**

Add import at the top of person.js:
```javascript
import { createPersonArcGenerator } from "./arc-factory.js";
```

Replace the arc generator code in `addArcToPerson()` around lines 355-365:
```javascript
// Before:
const arcGenerator = d3.arc()
    .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
    .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
    .innerRadius(this._geometry.innerRadius(datum.depth))
    .outerRadius(this._geometry.outerRadius(datum.depth))
    .padAngle(this.getArcPadAngle(datum))
    .padRadius(this._configuration.padRadius)
    .cornerRadius(this._configuration.cornerRadius);

appendArc(person, arcGenerator, datum.data.data.familyColor);

// After:
const arcGenerator = createPersonArcGenerator(
    this._geometry,
    this._configuration,
    datum,
    this.getArcPadAngle(datum),
);

appendArc(person, arcGenerator, datum.data.data.familyColor);
```

Remove the `d3.arc` import if it is no longer used elsewhere in person.js. Check that `d3` is still needed for `d3.select()` calls.

- [ ] **Step 2: Refactor marriage.js addArc()**

Add import at the top of marriage.js:
```javascript
import { createMarriageArcGenerator } from "./arc-factory.js";
```

Replace the arc generator code in `addArc()` around lines 137-144:
```javascript
// Before:
const arcGenerator = d3.arc()
    .startAngle(startAngle)
    .endAngle(endAngle)
    .innerRadius(innerR)
    .outerRadius(outerR)
    .padAngle(0)
    .padRadius(0)
    .cornerRadius(this._configuration.cornerRadius);

// After:
const arcGenerator = createMarriageArcGenerator(
    this._configuration,
    { startAngle, endAngle, innerR, outerR },
);
```

Check whether `d3.arc` is still needed elsewhere in marriage.js (e.g., for the text-path arc in `addLabel()`). If yes, keep the d3 import. If not, remove it.

- [ ] **Step 3: Run full test suite**

Run: `SKIP_EXPORT_BUILD=true npm test -- --ignore=resources/js/tests/export`
Expected: All tests PASS

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: 0 errors, 0 warnings

- [ ] **Step 5: Commit**

```bash
git add resources/js/modules/custom/svg/person.js resources/js/modules/custom/svg/marriage.js
git commit -m "Refactor Person and Marriage to use arc-factory utilities"
```

---

### Task 7: Rebuild bundles, verify in browser, final commit

**Files:**
- Rebuild: `resources/js/fan-chart-3.3.3-dev.min.js`
- Rebuild: `resources/js/fan-chart-page.min.js`

- [ ] **Step 1: Rebuild minified bundles**

Run: `npm run prepare`
Expected: All bundles created without errors

- [ ] **Step 2: Restart phpfpm**

Run (from `/volume2/docker/webtrees`): `docker compose restart phpfpm`

- [ ] **Step 3: Verify in browser via Playwright**

Navigate to the fan chart page and verify:
1. Chart renders without console errors (no NaN, no undefined)
2. Click on a person re-centers the chart (ChartUpdater works)
3. Toggle "Show descendants" — fan degree slider clamps correctly
4. Right-click shows tooltip with dates and image
5. PNG/SVG export buttons work

- [ ] **Step 4: Commit rebuilt bundles**

```bash
git add resources/js/fan-chart-3.3.3-dev.min.js resources/js/fan-chart-page.min.js
git commit -m "Rebuild minified bundles after Phase 1 consolidation"
```

- [ ] **Step 5: Push**

```bash
git push
```

---

## Phase 2-4: Library Extraction & Migration (Follow-up Plans)

These phases operate in separate repos/workspaces and should get their own
implementation plans once Phase 1 is merged.

### Phase 2: Create `@magicsunday/webtrees-chart-lib` package

**Workspace:** New repo `magicsunday/webtrees-chart-lib`

Key tasks (see spec for details):
1. Create repo, copy `lib/chart/` + `lib/storage.js` from fan-chart
2. Rename classes (Defs→SvgDefs, Zoom→ChartZoom, etc.)
3. Rewrite D3 facade imports → direct D3 module imports
4. Add `import "d3-transition"` to ChartOverlay
5. Convert measure.js default→named export
6. Reconcile storage.js `_name`→`_storageKey`
7. Set up rollup with `external: ["d3-transition", "d3-zoom"]`
8. Set up package.json, .npmrc, GitHub Actions publish
9. Transfer and adapt tests from fan-chart lib/ tests
10. Tag v1.0.0, publish to GitHub Packages

### Phase 3: Migrate fan-chart

**Workspace:** `magicsunday/webtrees-fan-chart`

Key tasks:
1. Add .npmrc, `npm install @magicsunday/webtrees-chart-lib`
2. Rewrite all `../lib/...` imports to package imports
3. Update class names to prefixed names
4. Remove `lib/chart/`, `lib/storage.js`, `lib/d3.js`
5. Update jest config if needed
6. Verify build, tests, browser

### Phase 4: Migrate pedigree-chart and descendants-chart

**Workspace:** Each repo separately

Key tasks (per repo):
1. Same as Phase 3
2. Reconcile storage.js field name `_name`→`_storageKey`
3. Keep `lib/tree/`, `lib/common/`, `lib/constants.js` (not part of package)
