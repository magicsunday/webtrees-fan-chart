/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * This class handles the configuration of the application.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Configuration
{
    /**
     * Constructor.
     *
     * @param {string[]} labels
     * @param {number}   generations
     * @param {number}   fanDegree
     * @param {number}   fontScale
     * @param {boolean}  hideEmptySegments
     * @param {boolean}  showColorGradients
     * @param {boolean}  showParentMarriageDates
     * @param {boolean}  showImages
     * @param {boolean}  showSilhouettes
     * @param {boolean}  rtl
     * @param {number}   innerArcs
     */
    constructor(
        labels,
        generations = 6,
        fanDegree = 210,
        fontScale = 100,
        hideEmptySegments = false,
        showColorGradients = false,
        showParentMarriageDates = false,
        showImages = false,
        showSilhouettes = false,
        rtl = false,
        innerArcs = 4
    ) {
        // Default number of generations to display
        this._generations = generations;

        // Padding in pixel between each generation circle
        this.circlePadding = 0;

        if (showParentMarriageDates) {
            this.circlePadding = 40;
        }

        this.padAngle = 0.03;
        this.padRadius = this.circlePadding * 10;
        this.padDistance = this.padAngle * this.padRadius;
        this.cornerRadius = 0;

        // Number of circles, large enough to print text along an arc path
        this._numberOfInnerCircles = innerArcs;

        // Radius of the innermost circle
        this.centerCircleRadius = 100;

        // Height of each inner circle arc
        this.innerArcHeight = 100;

        // Height of each outer circle arc
        this.outerArcHeight = 160;

        if (showParentMarriageDates) {
            this.innerArcHeight = this.circlePadding + 110;
            this.outerArcHeight = this.circlePadding + 110;
        }

        // Width of the colored arc above each single person arc
        this.colorArcWidth = 5;

        // Left/Right padding of the text (used with truncation)
        this.textPadding = 8;

        // Default font size, color and scaling
        this._fontSize  = 18;
        this._fontScale = fontScale;

        this._hideEmptySegments  = hideEmptySegments;
        this._showColorGradients = showColorGradients;
        this._showParentMarriageDates = showParentMarriageDates;
        this._showImages = showImages;
        this._showSilhouettes = showSilhouettes;

        // Duration of update animation if clicked on a person
        this.updateDuration = 1250;

        // Default degrees of the fan chart
        this._fanDegree = fanDegree;

        this.rtl    = rtl;
        this.labels = labels;
    }

    /**
     * Returns the number of generations to display.
     *
     * @return {number}
     */
    get generations()
    {
        return this._generations;
    }

    /**
     * Sets the number of generations to display.
     *
     * @param {number} value The number of generations to display
     */
    set generations(value)
    {
        this._generations = value;
    }

    /**
     * Returns the degrees of the fan chart.
     *
     * @return {number}
     */
    get fanDegree()
    {
        return this._fanDegree;
    }

    /**
     * Sets the degrees of the fan chart.
     *
     * @param {number} value The degrees of the fan chart
     */
    set fanDegree(value)
    {
        this._fanDegree = value;
    }

    /**
     * Returns the font scaling.
     *
     * @return {number}
     */
    get fontScale()
    {
        return this._fontScale;
    }

    /**
     * Sets the font scaling.
     *
     * @param {number} value The font scaling
     */
    set fontScale(value)
    {
        this._fontScale = value;
    }

    /**
     * Returns whether to show or hide empty chart segments.
     *
     * @return {boolean}
     */
    get hideEmptySegments()
    {
        return this._hideEmptySegments;
    }

    /**
     * Sets whether to show or hide empty chart segments.
     *
     * @param {boolean} value Either true or false
     */
    set hideEmptySegments(value)
    {
        this._hideEmptySegments = value;
    }

    /**
     * Returns whether to show or hide a color gradient above each arc or display male/female colors instead.
     *
     * @return {boolean}
     */
    get showColorGradients()
    {
        return this._showColorGradients;
    }

    /**
     * Sets whether to show or hide a color gradient above each arc or display male/female colors instead.
     *
     * @param {boolean} value Either true or false
     */
    set showColorGradients(value)
    {
        this._showColorGradients = value;
    }

    /**
     * Returns whether to show or hide the parent marriage dates.
     *
     * @return {boolean}
     */
    get showParentMarriageDates()
    {
        return this._showParentMarriageDates;
    }

    /**
     * Sets whether to show or hide the parent marriage dates.
     *
     * @param {boolean} value Either true or false
     */
    set showParentMarriageDates(value)
    {
        this._showParentMarriageDates = value;
    }

    /**
     * Returns TRUE if individual image should be shown otherwise FALSE.
     *
     * @return {boolean}
     */
    get showImages()
    {
        return this._showImages;
    }

    /**
     * Returns TRUE if silhouette placeholder image should be shown otherwise FALSE.
     *
     * @return {boolean}
     */
    get showSilhouettes()
    {
        return this._showSilhouettes;
    }

    /**
     * Returns the number of inner arcs to display.
     *
     * @return {number}
     */
    get numberOfInnerCircles()
    {
        return this._numberOfInnerCircles;
    }

    /**
     * Sets the number of inner arcs to display.
     *
     * @param {number} value The number of inner arcs
     */
    set numberOfInnerCircles(value)
    {
        this._numberOfInnerCircles = value;
    }

    /**
     * Returns the font size in pixel.
     *
     * @return {number}
     */
    get fontSize()
    {
        return this._fontSize;
    }
}
