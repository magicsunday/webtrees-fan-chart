/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Coerce a value to a finite number, returning the fallback if the
 * result is NaN or Infinity. Handles strings from HTML inputs safely.
 *
 * @param {*}      value    The value to coerce
 * @param {number} fallback Default if value is not a finite number
 *
 * @return {number}
 */
export function toFiniteNumber(value, fallback = 0) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : fallback;
}

/**
 * Holds all runtime settings for the fan chart (arc counts, font sizes,
 * feature flags, colors) and exposes them through typed getters and setters.
 * Default values are applied when options are omitted or non-finite.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Configuration {
    /**
     * Default color for the paternal lineage.
     *
     * @type {string}
     */
    static PATERNAL_COLOR_DEFAULT = "#70a9cf";

    /**
     * Default color for the maternal lineage.
     *
     * @type {string}
     */
    static MATERNAL_COLOR_DEFAULT = "#d06f94";

    /**
     * @param {Object}   options
     * @param {Object<string, string>} options.labels  Label strings keyed by name (e.g. zoom, move) and generation index
     * @param {number}   [options.generations=6]
     * @param {number}   [options.fanDegree=210]
     * @param {number}   [options.fontScale=100]
     * @param {boolean}  [options.hideEmptySegments=false]
     * @param {boolean}  [options.showFamilyColors=false]
     * @param {boolean}  [options.showPlaces=false]
     * @param {boolean}  [options.showParentMarriageDates=false]
     * @param {boolean}  [options.showImages=false]
     * @param {boolean}  [options.showNames=true]
     * @param {boolean}  [options.showSilhouettes=false]
     * @param {boolean}  [options.rtl=false]
     * @param {number}   [options.innerArcs=4]
     * @param {string}   [options.paternalColor]
     * @param {string}   [options.maternalColor]
     */
    constructor({
        labels = { zoom: "", move: "" },
        generations = 6,
        fanDegree = 210,
        fontScale = 100,
        hideEmptySegments = false,
        showFamilyColors = false,
        showPlaces = false,
        showParentMarriageDates = false,
        showImages = false,
        showNames = true,
        showSilhouettes = false,
        rtl = false,
        innerArcs = 4,
        paternalColor = Configuration.PATERNAL_COLOR_DEFAULT,
        maternalColor = Configuration.MATERNAL_COLOR_DEFAULT,
    } = {}) {
        // Default number of generations to display
        this._generations = toFiniteNumber(generations, 6);

        // Padding in pixel between each generation circle
        this.circlePadding = showParentMarriageDates ? 40 : 0;

        this.padAngle = 0.03;
        this.padRadius = this.circlePadding * 10;
        this.padDistance = this.padAngle * this.padRadius;
        this.cornerRadius = 0;

        // Number of circles, large enough to print text along an arc path
        this._numberOfInnerCircles = toFiniteNumber(innerArcs, 4);

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

        // Default font size, color and scaling
        this._fontSize = 22;
        this._fontScale = fontScale;

        this._hideEmptySegments = hideEmptySegments;
        this._showFamilyColors = showFamilyColors;
        this._showPlaces = showPlaces;
        this._showParentMarriageDates = showParentMarriageDates;
        this._showImages = showImages;
        this._showNames = showNames;
        this._showSilhouettes = showSilhouettes;

        // Duration of update animation if clicked on a person
        this.updateDuration = 1250;

        // Default degrees of the fan chart
        this._fanDegree = toFiniteNumber(fanDegree, 210);

        this.rtl = rtl;
        this.labels = labels;

        this._paternalColor = paternalColor;
        this._maternalColor = maternalColor;
    }

    get generations() {
        return this._generations;
    }

    set generations(value) {
        this._generations = value;
    }

    /**

     * Total angular span of the fan in degrees (e.g. 180, 210, 270, 360).

     */
    get fanDegree() {
        return this._fanDegree;
    }

    set fanDegree(value) {
        this._fanDegree = value;
    }

    /**

     * Font scaling factor as a percentage (100 = default size).

     */
    get fontScale() {
        return this._fontScale;
    }

    set fontScale(value) {
        this._fontScale = value;
    }

    /**

     * When true, arc segments for individuals with no data are removed from the DOM.

     */
    get hideEmptySegments() {
        return this._hideEmptySegments;
    }

    set hideEmptySegments(value) {
        this._hideEmptySegments = value;
    }

    /**

     * When true, arc fills use branch-based family colors instead of sex-based colors.

     */
    get showFamilyColors() {
        return this._showFamilyColors;
    }

    set showFamilyColors(value) {
        this._showFamilyColors = value;
    }

    get showPlaces() {
        return this._showPlaces;
    }

    /**
     * When true, a narrow arc between each pair of parent arcs shows the marriage date.
     * Enabling this also increases arc height (circlePadding) to accommodate the extra band.
     */
    get showParentMarriageDates() {
        return this._showParentMarriageDates;
    }

    set showParentMarriageDates(value) {
        this._showParentMarriageDates = value;
    }

    /**

     * When true, thumbnail images are rendered inside person arcs where space allows.

     */
    get showImages() {
        return this._showImages;
    }

    /**

     * When false, only images are rendered in the arcs and text labels are omitted.

     */
    get showNames() {
        return this._showNames;
    }

    /**
     * When true, a sex-specific silhouette icon is shown in the tooltip for
     * individuals who have no thumbnail photo.
     */
    get showSilhouettes() {
        return this._showSilhouettes;
    }

    /**
     * Number of generations rendered as wide inner arcs (tall enough for
     * text along the arc path). Generations beyond this threshold use the
     * narrower outer-arc height.
     */
    get numberOfInnerCircles() {
        return this._numberOfInnerCircles;
    }

    set numberOfInnerCircles(value) {
        this._numberOfInnerCircles = value;
    }

    /**

     * Base font size in pixels before depth scaling and fontScale are applied.

     */
    get fontSize() {
        return this._fontSize;
    }

    get paternalColor() {
        return this._paternalColor;
    }

    get maternalColor() {
        return this._maternalColor;
    }
}
