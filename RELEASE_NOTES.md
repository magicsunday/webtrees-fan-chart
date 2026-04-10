## Highlights

### Thumbnail Images in Fan Chart (#115)
Person thumbnail images are now displayed directly inside the fan chart arcs. Silhouette placeholders are shown when no photo is available.

- **Show images** option in the layout settings to toggle arc images on/off
- **Show names** option to hide text and display an image-only chart
- Images automatically scale based on arc size and are hidden when the segment is too narrow
- Images are embedded as data URIs in SVG/PNG exports
- Overlay tooltip always shows the full image regardless of the arc image setting

### Marriage Date Arcs
Parent marriage dates are displayed on dedicated arcs between generations, with configurable visibility.

### Family Branch Colors
Arcs can be colored by family branch with configurable paternal/maternal base colors via color pickers.

### Place Names
Birth and death places are shown in inner generation arcs with configurable detail level (full name, parish, or lowest N levels).

### Compact Date Format
Outer generations now display dates in a compact single-line format (e.g. 1875--1932) instead of two separate lines with symbols.

### Genealogical Symbols
Inner generations use standard genealogical symbols (* for birth, dagger for death, ring for marriage) instead of text labels.

## Code Quality & Tooling
- PHP 8.3+ with constructor promotion and readonly properties
- ESLint with @stylistic plugin for JavaScript
- PHPStan at level max, Rector with full rule sets
- CI workflow tests PHP 8.3/8.4/8.5 with JS linting and unit tests
- Automated release pipeline via `make release 3.1.0`

## Translations
- 24 languages updated with new strings for all features
- Updated Dutch translations (thanks @TheDutchJewel)

## Bug Fixes
- Fix click handler not re-bound after chart update
- Fix marriage dates appearing upside down in 360-degree charts
- Fix npm security vulnerabilities (jest-environment-jsdom, serialize-javascript)
- Fix type coercion for form values (fanDegree, generations)
