/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";

export const MATH_DEG2RAD = Math.PI / 180;
export const MATH_RAD2DEG = 180 / Math.PI;

const MATH_PI2 = Math.PI * 2;

/**
 * This class handles the geometric methods.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Geometry
{
    /**
     * Constructor.
     *
     * @param {Configuration} configuration The application configuration
     */
    constructor(configuration)
    {
        this._configuration = configuration;
    }

    /**
     * @return {number}
     *
     * @private
     */
    get startPi()
    {
        if (this._configuration.fanDegree === 90) {
            return 0;
        }

        return -(this._configuration.fanDegree / 2 * MATH_DEG2RAD);
    }

    /**
     * @return {number}
     *
     * @private
     */
    get endPi()
    {
        if (this._configuration.fanDegree === 90) {
            return (this._configuration.fanDegree * MATH_DEG2RAD);
        }

        return (this._configuration.fanDegree / 2 * MATH_DEG2RAD);
    }

    /**
     * Scale the angles linear across the circle.
     *
     * @return {number}
     */
    get scale()
    {
        return d3.scaleLinear().range([this.startPi, this.endPi]);
    }

    /**
     * Get the inner radius depending on the depth of an element.
     *
     * @param {number} depth The depth of the element inside the chart
     *
     * @return {number}
     */
    innerRadius(depth)
    {
        if (depth === 0) {
            return 0;
        }

        if (depth <= this._configuration.numberOfInnerCircles) {
            return ((depth - 1) * (this._configuration.innerArcHeight))
                + this._configuration.centerCircleRadius
                + this._configuration.circlePadding;
        }

        return (this._configuration.numberOfInnerCircles * this._configuration.innerArcHeight)
            + ((depth - this._configuration.numberOfInnerCircles - 1) * this._configuration.outerArcHeight)
            + this._configuration.centerCircleRadius
            + this._configuration.circlePadding;
    }

    /**
     * Get the outer radius depending on the depth of an element.
     *
     * @param {number} depth The depth of the element inside the chart
     *
     * @return {number}
     */
    outerRadius(depth)
    {
        if (depth === 0) {
            return this._configuration.centerCircleRadius;
        }

        if (depth <= this._configuration.numberOfInnerCircles) {
            return ((depth - 1) * (this._configuration.innerArcHeight))
                + this._configuration.centerCircleRadius
                + this._configuration.innerArcHeight;
        }

        return (this._configuration.numberOfInnerCircles * this._configuration.innerArcHeight)
            + ((depth - this._configuration.numberOfInnerCircles - 1) * this._configuration.outerArcHeight)
            + this._configuration.centerCircleRadius
            + this._configuration.outerArcHeight;
    }

    /**
     * Get the center radius.
     *
     * @param {number} depth The depth of the element inside the chart
     *
     * @return {number}
     */
    centerRadius(depth)
    {
        return (this.innerRadius(depth) + this.outerRadius(depth)) / 2;
    }

    /**
     * Get an radius relative to the outer radius adjusted by the given
     * position in percent.
     *
     * @param {number} depth    The depth of the element inside the chart
     * @param {number} position Percent offset (0 = inner radius, 100 = outer radius)
     *
     * @return {number}
     */
    relativeRadius(depth, position)
    {
        const outer = this.outerRadius(depth);
        return outer - ((100 - position) * (outer - this.innerRadius(depth)) / 100);
    }

    /**
     * Calculates the angle in radians.
     *
     * @param {number} value The starting point of the rectangle
     *
     * @return {number}
     */
    calcAngle(value)
    {
        return Math.max(this.startPi, Math.min(this.endPi, this.scale(value)));
    }

    /**
     * Gets the start angle in radians.
     *
     * @param {number} depth The depth of the element inside the chart
     * @param {number} x0    The left edge (x0) of the rectangle
     *
     * @return {number}
     */
    startAngle(depth, x0)
    {
        // Starting from the left edge (x0) of the rectangle
        return (depth === 0) ? 0 : this.calcAngle(x0);
    }

    /**
     * Gets the end angle in radians.
     *
     * @param {number} depth The depth of the element inside the chart
     * @param {number} x1    The right edge (x1) of the rectangle
     *
     * @return {number}
     */
    endAngle(depth, x1)
    {
        // Starting from the right edge (x1) of the rectangle
        return (depth === 0) ? MATH_PI2 : this.calcAngle(x1);
    }

    /**
     * Get an radius relative to the outer radius adjusted by the given
     * position in percent.
     *
     * @param {Object} datum    The D3 data object
     * @param {number} position The percent offset (0 = inner radius, 100 = outer radius)
     *
     * @return {number}
     */
    arcLength(datum, position)
    {
        return (this.endAngle(datum.depth, datum.x1) - this.startAngle(datum.depth, datum.x0))
            * this.relativeRadius(datum.depth, position);
    }

    /**
     * Get the scaled font size for a given depth. Outer circles (beyond the
     * inner circle count) get a +1 bump before the depth is subtracted.
     *
     * @param {Object} datum The D3 data object
     *
     * @return {number}
     */
    getFontSize(datum)
    {
        let fontSize = this._configuration.fontSize;

        if (datum.depth >= (this._configuration.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        let scaled = (fontSize - datum.depth) * this._configuration.fontScale / 100.0;

        // For outer labels, cap font size so text fits within the angular
        // width of the segment. Uses 80% of angular width to leave visual
        // padding and account for descenders / em-box centering offset.
        if (datum.depth >= (this._configuration.numberOfInnerCircles + 1)) {
            let angularWidth = (this.endAngle(datum.depth, datum.x1) - this.startAngle(datum.depth, datum.x0)) * this.centerRadius(datum.depth);

            // Depth >= 7 merges first + last name into 1 line; others use 2
            let lines  = datum.depth >= 7 ? 1 : 2;
            let maxFont = (angularWidth * 0.55) / lines;

            scaled = Math.min(scaled, maxFont);
        }

        return Math.max(1, scaled);
    }

    /**
     * Check for the 360-degree chart if the current arc labels should
     * be flipped for easier reading (bottom half of the chart).
     *
     * @param {number} depth The depth of the element inside the chart
     * @param {number} x0    The left edge (x0) of the rectangle
     * @param {number} x1    The right edge (x1) of the rectangle
     *
     * @return {boolean}
     */
    isPositionFlipped(depth, x0, x1)
    {
        if ((this._configuration.fanDegree <= 270) || (depth < 1)) {
            return false;
        }

        const startAngle = this.startAngle(depth, x0);
        const endAngle   = this.endAngle(depth, x1);
        const midAngle   = (startAngle + endAngle) / 2;
        const pi2        = Math.PI * 2;
        const normalized = ((midAngle % pi2) + pi2) % pi2;

        return (normalized > (90 * MATH_DEG2RAD)) && (normalized < (270 * MATH_DEG2RAD));
    }
}
