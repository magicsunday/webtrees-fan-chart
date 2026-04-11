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
 * This class handles the configuration of the application.
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
     * Constructor.
     *
     * @param {Object}   options
     * @param {string[]} options.labels
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
        labels,
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

    /**
     * Returns the number of generations to display.
     *
     * @return {number}
     */
    get generations() {
        return this._generations;
    }

    /**
     * Sets the number of generations to display.
     *
     * @param {number} value The number of generations to display
     */
    set generations(value) {
        this._generations = value;
    }

    /**
     * Returns the degrees of the fan chart.
     *
     * @return {number}
     */
    get fanDegree() {
        return this._fanDegree;
    }

    /**
     * Sets the degrees of the fan chart.
     *
     * @param {number} value The degrees of the fan chart
     */
    set fanDegree(value) {
        this._fanDegree = value;
    }

    /**
     * Returns the font scaling.
     *
     * @return {number}
     */
    get fontScale() {
        return this._fontScale;
    }

    /**
     * Sets the font scaling.
     *
     * @param {number} value The font scaling
     */
    set fontScale(value) {
        this._fontScale = value;
    }

    /**
     * Returns whether to show or hide empty chart segments.
     *
     * @return {boolean}
     */
    get hideEmptySegments() {
        return this._hideEmptySegments;
    }

    /**
     * Sets whether to show or hide empty chart segments.
     *
     * @param {boolean} value Either true or false
     */
    set hideEmptySegments(value) {
        this._hideEmptySegments = value;
    }

    /**
     * Returns whether to show or hide family colors above each arc or display male/female colors instead.
     *
     * @return {boolean}
     */
    get showFamilyColors() {
        return this._showFamilyColors;
    }

    /**
     * Sets whether to show or hide family colors above each arc or display male/female colors instead.
     *
     * @param {boolean} value Either true or false
     */
    set showFamilyColors(value) {
        this._showFamilyColors = value;
    }

    /**
     * Returns whether to show or hide place names.
     *
     * @return {boolean}
     */
    get showPlaces() {
        return this._showPlaces;
    }

    /**
     * Returns whether to show or hide the parent marriage dates.
     *
     * @return {boolean}
     */
    get showParentMarriageDates() {
        return this._showParentMarriageDates;
    }

    /**
     * Sets whether to show or hide the parent marriage dates.
     *
     * @param {boolean} value Either true or false
     */
    set showParentMarriageDates(value) {
        this._showParentMarriageDates = value;
    }

    /**
     * Returns TRUE if individual image should be shown otherwise FALSE.
     *
     * @return {boolean}
     */
    get showImages() {
        return this._showImages;
    }

    /**
     * Returns TRUE if names and dates should be shown in the arcs otherwise FALSE.
     *
     * @return {boolean}
     */
    get showNames() {
        return this._showNames;
    }

    /**
     * Returns TRUE if silhouette placeholder image should be shown otherwise FALSE.
     *
     * @return {boolean}
     */
    get showSilhouettes() {
        return this._showSilhouettes;
    }

    /**
     * Returns the number of inner arcs to display.
     *
     * @return {number}
     */
    get numberOfInnerCircles() {
        return this._numberOfInnerCircles;
    }

    /**
     * Sets the number of inner arcs to display.
     *
     * @param {number} value The number of inner arcs
     */
    set numberOfInnerCircles(value) {
        this._numberOfInnerCircles = value;
    }

    /**
     * Returns the font size in pixel.
     *
     * @return {number}
     */
    get fontSize() {
        return this._fontSize;
    }

    /**
     * Returns the hex color for the paternal lineage.
     *
     * @return {string}
     */
    get paternalColor() {
        return this._paternalColor;
    }

    /**
     * Returns the hex color for the maternal lineage.
     *
     * @return {string}
     */
    get maternalColor() {
        return this._maternalColor;
    }
}
