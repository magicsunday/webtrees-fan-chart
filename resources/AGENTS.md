<!-- Managed by agent: keep sections & order; edit content, not structure. Last updated: 2025-02-13 -->

## Overview
- Instructions for assets under `resources/` (JS, CSS, translations, views).
- Decision Log:
  - 2025-02-11: Documented rollup-based build steps and alignment with PHP module guidelines for assets.
  - 2025-02-12: Documented JavaScript test location (`resources/js/tests`) and required commands after JS changes.
  - 2025-02-13: Reinforced vanilla-JS preference (D3 only external) plus concise, documented code expectations.

## Setup/env
- Install Node.js dependencies with `npm install`; rollup configuration lives in `rollup.config.js` and uses ES modules.
- Keep D3-related packages and rollup plugins in sync with package.json; avoid switching package managers.

## Build & tests
- Build assets via `npm run prepare`; use `npm run watch` while developing to mirror rollup bundling.
- When JavaScript files change, run `npm test` (or focused scripts like `npm run test:exports`) to exercise suites in `resources/js/tests`.
- Run `composer ci:test:php:unit:coverage`, `composer ci:test:php:phpstan`, and `composer ci:cgl` only when PHP changes accompany asset updates.
- For static assets, prefer linting via rollup warnings; keep generated artifacts out of version control unless explicitly required.

## Code style
- Use modern ES modules and avoid nested ternaries; prefer small, pure functions and descriptive naming.
- Keep translations and templates consistent with PHP naming; avoid embedding secrets or API keys in client code.
- Keep classes and functions concise; document intent with English JSDoc or inline comments at complex logic, and avoid external JavaScript libraries beyond D3 (vanilla JS otherwise).

## Security
- Do not bundle secrets; sanitize user-provided data before rendering and avoid logging sensitive values in the browser.

## PR/commit checklist
- Verify rollup builds succeed and outputs load without console errors.
- Keep changes minimal and aligned with PHP module behavior; commit messages follow Conventional Commits with ticket IDs when available.

## Good vs bad examples
- Good: `const visibleIndividuals = nodes.filter((node) => node.visible);`
- Bad: `for (let i in nodes) { if (!nodes[i]) continue; /* ... complex nested ternary ... */ } // avoid for-in on arrays and nested ternaries`

## When stuck
- Review `rollup.config.js` and existing modules under `resources/js` for patterns; cross-check with README for expected asset locations.
- Capture new conventions or deviations in the Decision Log above.

## House Rules
- Keep assets lightweight and accessible; aim for WCAG 2.2 AA where applicable and avoid unused bundles.
- Prefer enums or constants for shared codes and avoid magic values in JS.
