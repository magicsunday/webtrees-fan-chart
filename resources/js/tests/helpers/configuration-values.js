/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Builds a complete set of values for the Configuration. The server passes every option
 * on the real path, and the Configuration has no defaults of its own, so a test starts from
 * this set and overrides only what it exercises.
 *
 * @param {object} overrides The values that differ from the base set
 *
 * @return {object}
 */
export function createConfigurationValues(overrides = {}) {
    return {
        labels: { zoom: "", move: "" },
        generations: 6,
        fanDegree: 210,
        fontScale: 100,
        hideEmptySegments: false,
        showFamilyColors: false,
        showPlaces: false,
        showParentMarriageDates: false,
        showImages: false,
        showNames: true,
        showSilhouettes: false,
        showDescendants: false,
        showDetailPanel: false,
        rtl: false,
        innerArcs: 4,
        paternalColor: "#aa0000",
        maternalColor: "#0000aa",
        nameAbbreviation: "GIVEN",
        ...overrides,
    };
}
