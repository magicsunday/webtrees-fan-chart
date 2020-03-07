/**
 * See LICENSE.md file for further details.
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
     * @param {string[]}  labels
     * @param {number}    generations
     * @param {number}    fanDegree
     * @param {string}    defaultColor
     * @param {number}    fontScale
     * @param {string}    fontColor
     * @param {boolean}   hideEmptySegments
     * @param {boolean}   showColorGradients
     * @param {boolean}   rtl
     * @param {number}    innerArcs
     */
    constructor(
        labels,
        generations        = 6,
        fanDegree          = 210,
        defaultColor       = "rgb(238, 238, 238)",
        fontScale          = 100,
        fontColor          = "rgb(0, 0, 0)",
        hideEmptySegments  = false,
        showColorGradients = false,
        rtl                = false,
        innerArcs          = 4
    ) {
        // Default number of generations to display
        this._generations = generations;

        // Padding in pixel between each generation circle
        this.circlePadding = 0;

        // Number of circles, large enough to print text along arc path
        this._numberOfInnerCircles = innerArcs;

        // Radius of the innermost circle
        this.centerCircleRadius = 85;

        // Height of each inner circle arc
        this.innerArcHeight = 85;

        // Height of each outer circle arc
        this.outerArcHeight = 115;

        // Width of the colored arc above each single person arc
        this.colorArcWidth = 5;

        // Left/Right padding of text (used with truncation)
        this.textPadding = 8;

        // Default background color of an arc
        this.defaultColor = defaultColor;

        // Default font size, color and scaling
        this._fontSize  = 15;
        this._fontScale = fontScale;
        this.fontColor = fontColor;

        this._hideEmptySegments  = hideEmptySegments;
        this._showColorGradients = showColorGradients;

        // Duration of update animation if clicked on a person
        this.updateDuration = 1250;

        // Default degrees of the fan chart
        this._fanDegree = fanDegree;

        this.rtl    = rtl;
        this.labels = labels;

        // Helper method to create a ongoing id
        this.id = (() => {
            let i = 1;

            return function (reset = false) {
                if (reset) {
                    i = 0;
                }

                return i++;
            };
        })();
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
     * Sets whether to show or hide a color gradient above each arc or display male/female colors instead
     *
     * @param {boolean} value Either true or false
     */
    set showColorGradients(value)
    {
        this._showColorGradients = value;
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
