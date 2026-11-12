/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Coerce a value to a finite number, returning the fallback if the result is
 * NaN or Infinity. Handles strings from HTML inputs safely.
 *
 * @param {*}      value    The value to coerce
 * @param {number} fallback Default if value is not a finite number
 *
 * @return {number}
 */
function toFiniteNumber(value, fallback = 0) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : fallback;
}

/**
 * Holds all runtime settings for the fan chart (arc counts, font sizes, feature
 * flags, colors) and exposes them through typed getters and setters. The values
 * come from the server, which owns every default.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Configuration {
    /**
     * The server passes a value for every option on the real path, so this class holds no
     * defaults of its own. An option that is left out stays undefined, except for the numbers
     * that are validated, which fall back to a finite value.
     *
     * @param {object}   options
     * @param {{ zoom: string, move: string, updateFailed?: string }} options.labels The zoom and move hint texts of the overlay and the notice of a failed update
     * @param {number}   options.generations
     * @param {number}   options.fanDegree
     * @param {number}   options.fontScale
     * @param {boolean}  options.hideEmptySegments
     * @param {boolean}  options.showFamilyColors
     * @param {boolean}  options.showPlaces
     * @param {boolean}  options.showParentMarriageDates
     * @param {boolean}  options.showImages
     * @param {boolean}  options.showNames
     * @param {boolean}  options.showTooltipSilhouettes
     * @param {boolean}  options.showDescendants
     * @param {boolean}  options.showDetailPanel Whether a click selects a person for the detail panel
     * @param {boolean}  options.rtl
     * @param {number}   options.innerArcs
     * @param {string}   options.paternalColor
     * @param {string}   options.maternalColor
     * @param {string}   options.nameAbbreviation One of "GIVEN" or "SURNAME". Resolved server-side from the tree's SURNAME_TRADITION when admin sets it to AUTO.
     */
    constructor({
        labels,
        generations,
        fanDegree,
        fontScale,
        hideEmptySegments,
        showFamilyColors,
        showPlaces,
        showParentMarriageDates,
        showImages,
        showNames,
        showTooltipSilhouettes,
        showDescendants,
        showDetailPanel,
        rtl,
        innerArcs,
        paternalColor,
        maternalColor,
        nameAbbreviation,
    }) {
        // Number of generations to display
        this._generations = toFiniteNumber(generations, 6);

        // Padding in pixel between each generation circle
        this.circlePadding = showParentMarriageDates ? 30 : 0;

        this.padAngle = 0.03;
        this.padRadius = this.circlePadding * 10;
        this.padDistance = this.padAngle * this.padRadius;
        this.cornerRadius = 0;

        // Number of circles, large enough to print text along an arc path
        this._numberOfInnerCircles = toFiniteNumber(innerArcs, 3);

        // Radius of the innermost circle
        this.centerCircleRadius = 115;

        // Height of each inner circle arc
        this.innerArcHeight = showParentMarriageDates ? this.circlePadding + 125 : 115;

        // Height of each outer circle arc
        this.outerArcHeight = showParentMarriageDates ? this.circlePadding + 125 : 175;

        // Width of the colored arc above each single person arc
        this.colorArcWidth = 5;

        // Left/Right padding of the text (used with truncation)
        this.textPadding = 8;

        // Base font size and scaling
        this._fontSize = 22;
        this._fontScale = fontScale;

        this._hideEmptySegments = hideEmptySegments;
        this._showFamilyColors = showFamilyColors;
        this._showPlaces = showPlaces;
        this._showParentMarriageDates = showParentMarriageDates;
        this._showImages = showImages;
        this._showNames = showNames;
        this._showTooltipSilhouettes = showTooltipSilhouettes;

        // Duration of update animation if clicked on a person
        this.updateDuration = 1250;

        // Degrees of the fan chart
        this._fanDegree = toFiniteNumber(fanDegree, 210);

        this._showDescendants = showDescendants;
        this._showDetailPanel = showDetailPanel;

        this.rtl = rtl;
        this.labels = labels;

        this._paternalColor = paternalColor;
        this._maternalColor = maternalColor;
        this._nameAbbreviation = nameAbbreviation;
    }

    /**
     * Returns the resolved name-abbreviation strategy ("GIVEN" or "SURNAME").
     * The server resolves the tree-pref value (which can also be "AUTO") into
     * one of these two before serialising — the JS layer never sees AUTO.
     *
     * @return {string}
     */
    get nameAbbreviation() {
        return this._nameAbbreviation;
    }

    /**
     * @return {number}
     */
    get generations() {
        return this._generations;
    }

    /**
     * Total angular span of the fan in degrees (e.g. 180, 210, 270, 360).
     *
     * @return {number}
     */
    get fanDegree() {
        return this._fanDegree;
    }

    /**
     * Font scaling factor as a percentage (100 = default size).
     *
     * @return {number}
     */
    get fontScale() {
        return this._fontScale;
    }

    /**
     * When true, arc segments for individuals with no data are removed from the
     * DOM.
     *
     * @return {boolean}
     */
    get hideEmptySegments() {
        return this._hideEmptySegments;
    }

    /**
     * When true, arc fills use branch-based family colors instead of sex-based
     * colors.
     *
     * @return {boolean}
     */
    get showFamilyColors() {
        return this._showFamilyColors;
    }

    /**
     * @return {boolean}
     */
    get showPlaces() {
        return this._showPlaces;
    }

    /**
     * When true, a narrow arc between each pair of parent arcs shows the
     * marriage date. Enabling this also increases arc height (circlePadding) to
     * accommodate the extra band.
     *
     * @return {boolean}
     */
    get showParentMarriageDates() {
        return this._showParentMarriageDates;
    }

    /**
     * When true, thumbnail images are rendered inside person arcs where space
     * allows.
     *
     * @return {boolean}
     */
    get showImages() {
        return this._showImages;
    }

    /**
     * When false, only images are rendered in the arcs and text labels are
     * omitted.
     *
     * @return {boolean}
     */
    get showNames() {
        return this._showNames;
    }

    /**
     * When true, a sex-specific silhouette icon is shown in the tooltip for
     * individuals who have no thumbnail photo. The server sets it from the tree
     * preference for silhouettes alone, so it is independent of the display
     * mode and of the rule for the images in the arcs.
     *
     * @return {boolean}
     */
    get showTooltipSilhouettes() {
        return this._showTooltipSilhouettes;
    }

    /**
     * When true, partners and children of the central person are rendered as
     * arcs in the lower section of the fan chart.
     *
     * @return {boolean}
     */
    get showDescendants() {
        return this._showDescendants;
    }

    /**
     * Returns TRUE if a click selects a person for the detail panel instead of
     * opening the chart or the individual page, and the panel replaces the
     * tooltip.
     *
     * @return {boolean}
     */
    get showDetailPanel() {
        return this._showDetailPanel;
    }

    /**
     * Number of generations rendered as wide inner arcs (tall enough for text
     * along the arc path). Generations beyond this threshold use the narrower
     * outer-arc height.
     *
     * @return {number}
     */
    get numberOfInnerCircles() {
        return this._numberOfInnerCircles;
    }

    /**
     * Tells whether a person at the given depth is drawn. With names off only the inner
     * generations are, the outer ones stay empty.
     *
     * @param {number} depth The depth of the person, negative for descendants
     *
     * @return {boolean}
     */
    isDrawn(depth) {
        return this._showNames || depth <= this._numberOfInnerCircles;
    }

    /**
     * Base font size in pixels before depth scaling and fontScale are applied.
     *
     * @return {number}
     */
    get fontSize() {
        return this._fontSize;
    }

    /**
     * @return {string}
     */
    get paternalColor() {
        return this._paternalColor;
    }

    /**
     * @return {string}
     */
    get maternalColor() {
        return this._maternalColor;
    }
}
