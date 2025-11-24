<!-- Managed by agent: keep sections & order; edit content, not structure. Last updated: 2025-02-13 -->

## Overview
- This repository hosts the webtrees fan chart module; this file sets global defaults and indexes scoped instructions (nearest AGENTS.md takes precedence).
- Decision Log:
  - 2025-02-11: Added AGENTS.md scaffolding and documented required composer checks before commits.
  - 2025-02-12: Consolidated JavaScript tests under resources/js/tests and clarified test expectations (JS vs PHP tooling).
  - 2025-02-13: Captured conciseness, documentation, testing, and enum/value-object requirements plus vanilla-JS guidance.
- Scoped guides: see [src/AGENTS.md](src/AGENTS.md) for PHP code and [resources/AGENTS.md](resources/AGENTS.md) for assets.

## Setup/env
- PHP 8.3+ with extensions dom and json is required; composer installs dependencies into .build/vendor and binaries into .build/bin.
- Node.js tooling is used for asset builds (rollup). Install dev dependencies via `npm install` when touching frontend resources.
- Prefer running composer/npm commands inside the repository root so paths and caches resolve correctly.

## Build & tests
- When PHP files change, run: `composer ci:test:php:unit:coverage`, `composer ci:test:php:phpstan`, and `composer ci:cgl`; fix any findings and keep coverage at or above 90%.
- When JavaScript files change, run `npm test` (or targeted scripts like `npm run test:exports`) to execute suites under `resources/js/tests`.
- For quick PHP checks, use `composer ci:test:php:unit` for targeted unit feedback and `composer ci:test:php:lint` for syntax validation.
- Asset changes should be validated with `npm run prepare` (build) or `npm run watch` during development.
- Keep PHPStan, PHPCS, and CPD clean on affected code; add PHPUnit attribute-based coverage (positive and negative cases) for every class/method introduced or modified.

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
- Prepare PR bodies with the `M# Sweep — Verify compliance for this milestone` heading above the default template content.
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
