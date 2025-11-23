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
     * Creates a layout descriptor for the given datum.
     *
     * @param {number} depth The depth of the element inside the chart
     * @param {Object} node  The D3 data object
     *
     * @returns {{startAngle: number, endAngle: number, innerRadius: number, outerRadius: number, centerRadius: number}}
     */
    createLayout(depth, node)
    {
        const innerRadius = this.innerRadius(depth);
        const outerRadius = this.outerRadius(depth);

        return {
            startAngle: this.startAngle(depth, node.x0),
            endAngle: this.endAngle(depth, node.x1),
            innerRadius,
            outerRadius,
            centerRadius: this.centerRadius(depth),
        };
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
        return this.relativeRadiusFromLayout(
            {
                innerRadius: this.innerRadius(depth),
                outerRadius: this.outerRadius(depth),
            },
            position
        );
    }

    /**
     * Get a radius relative to the pre-calculated layout radii adjusted by the given position in percent.
     *
     * @param {Object} layout   Geometry layout object
     * @param {number} position Percent offset (0 = inner radius, 100 = outer radius)
     *
     * @returns {number}
     */
    relativeRadiusFromLayout(layout, position)
    {
        return layout.outerRadius - ((100 - position) * (layout.outerRadius - layout.innerRadius) / 100);
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
    arcLength(layout, position)
    {
        return (layout.endAngle - layout.startAngle)
            * this.relativeRadiusFromLayout(layout, position);
    }
}
