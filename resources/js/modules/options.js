/**
 * See LICENSE.md file for further details.
 */

/**
 * This class handles the options passed from outside to the application.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Options
{
    constructor(
        labels,
        generations        = 6,
        fanDegree          = 210,
        defaultColor       = "#eee",
        fontScale          = 100,
        fontColor          = "#000",
        hideEmptySegments  = false,
        showColorGradients = false,
        rtl                = false,
        innerArcs          = 4
    ) {
        this.data = null;

        // Default number of generations to display
        this.generations = generations;

        // Padding in pixel between each generation circle
        this.circlePadding = 0;

        // Number of circles, large enough to print text along arc path
        this.numberOfInnerCircles = innerArcs;

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
        this.fontSize  = 14;
        this.fontScale = fontScale;
        this.fontColor = fontColor;

        this.hideEmptySegments  = hideEmptySegments;
        this.showColorGradients = showColorGradients;

        // Duration of update animation if clicked on a person
        this.updateDuration = 1250;

        // Default degrees of the fan chart
        this.fanDegree = fanDegree;

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
}
