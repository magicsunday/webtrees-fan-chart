<!-- Managed by agent: keep sections & order; edit content, not structure. Last updated: 2025-02-13 -->

## Overview
- Guidance for PHP source under `src/`; follow this when adding modules, facades, models, and traits.
- Decision Log:
  - 2025-02-11: Captured PHP 8.3+ constraints, strict typing, and required composer checks/coverage for backend code.
  - 2025-02-13: Added conciseness, PHPDoc, enum/value-object, and exhaustive testing expectations for PHP code.

## Setup/env
- Ensure PHP 8.3+ with required extensions (dom, json) and composer dependencies installed (`composer install`).
- Autoloading uses PSR-4 root `MagicSunday\\Webtrees\\FanChart\\`; keep namespaces aligned with folder structure.

## Build & tests
- Mandatory before committing: `composer ci:test:php:unit:coverage`, `composer ci:test:php:phpstan`, `composer ci:cgl`.
- During development, run `composer ci:test:php:unit -- --filter <TestName>` for focused suites; keep tests mirroring `src/` structure.
- Favor TDD for fixes: add/adjust PHPUnit 12 attribute-based tests that assert expected behaviors and keep coverage ≥90% on touched code.
- Provide unit tests (including negative cases) for every class and public method; avoid regressions by covering interfaces and enums as well.

## Code style
- PSR-12 with `declare(strict_types=1);` at the top of every file; one class per file with expressive names.
- Provide PHPDoc blocks (English) for every class and method, describing purpose and parameters/return types; avoid `@deprecated`—remove dead code instead.
- Avoid mixed types, `empty()`, nested ternaries, dynamic static calls, redundant casts/braces, and redundant arguments; prefer `array_find`/`array_any` over manual loops where applicable.
- Use interfaces where sensible, mark data-only classes as `readonly`, remove redundant `readonly` keywords, and import fully-qualified references instead of repeated qualifiers.
- Prevent null dereferences by validating nullable inputs; use constants with meaningful identifiers and prefer enums or typed constants over magic numbers/strings.
- Keep classes and methods concise; document complex logic with English inline comments and wrap multi-part conditions in explicit parentheses.
- Prefer value objects over complex plain arrays to capture intermediate results; avoid `{}` string interpolation and redundant default arguments.

## Security
- Keep business logic free of secrets; validate and sanitize inputs where applicable, and avoid logging sensitive data.

## PR/commit checklist
- Confirm max-level PHPStan passes on changed code and that Rector/coding standards stay aligned with repo configs.
- Ensure new classes ship with PHPUnit tests in matching namespaces and directories (e.g., `tests/Facade/...` mirroring `src/Facade/...`).
- Use Conventional Commits with ticket IDs when available; keep changes cohesive and minimal.
- Verify CPD remains free of relevant duplications and that PHPStan/PHPCS stay green.

## Good vs bad examples
- Good: `readonly class FanChartConfig implements ConfigInterface { /** Configure default radius. */ public function radius(): int { return self::DEFAULT_RADIUS; } }`
- Good: `return array_find($pedigrees, static fn (Pedigree $pedigree): bool => $pedigree->isRoot());`
- Bad: `class config { public function r($x){ if(empty($x)) return null; return $x ? $x : 0; } } // no types/docs, empty(), nested ternary style`

## When stuck
- Check phpstan.neon, phpunit.xml, and rector.php for expectations; align new code with existing patterns in `src/` and mirror them in tests.
- Document notable deviations in the Decision Log above to keep instructions current.

## House Rules
- Target ≥90% coverage on touched files; prefer composition and clear separation of concerns.
- Avoid unused code paths—remove redundant methods/classes rather than leaving them dormant.
- Keep implementations minimal while satisfying the design principles (KISS, SOLID, DRY, YAGNI, GRASP, Law of Demeter, SoC, CoC).
