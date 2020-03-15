/**
 * See LICENSE.md file for further details.
 */

import * as d3 from "./../../d3";
import Configuration from "./../../configuration";

export const MATH_DEG2RAD = Math.PI / 180;
export const MATH_RAD2DEG = 180 / Math.PI;
export const MATH_PI2     = Math.PI * 2;

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
     * Scale the angles linear across the circle
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
     * @param {Object} data The D3 data object
     *
     * @return {number}
     */
    innerRadius(data)
    {
        if (data.depth === 0) {
            return 0;
        }

        if (data.depth <= this._configuration.numberOfInnerCircles) {
            return ((data.depth - 1) * (this._configuration.innerArcHeight + this._configuration.circlePadding))
                + this._configuration.centerCircleRadius;
        }

        const innerWithPadding = this._configuration.innerArcHeight + this._configuration.circlePadding;
        const outerWithPadding = this._configuration.outerArcHeight + this._configuration.circlePadding;

        return (this._configuration.numberOfInnerCircles * innerWithPadding)
            + ((data.depth - this._configuration.numberOfInnerCircles - 1) * outerWithPadding)
            + this._configuration.centerCircleRadius;
    }

    /**
     * Get the outer radius depending on the depth of an element.
     *
     * @param {Object} data The D3 data object
     *
     * @return {number}
     */
    outerRadius(data)
    {
        if (data.depth === 0) {
            return this._configuration.centerCircleRadius;
        }

        if (data.depth <= this._configuration.numberOfInnerCircles) {
            return ((data.depth - 1) * (this._configuration.innerArcHeight + this._configuration.circlePadding))
                + this._configuration.innerArcHeight
                + this._configuration.centerCircleRadius;
        }

        const innerWithPadding = this._configuration.innerArcHeight + this._configuration.circlePadding;
        const outerWithPadding = this._configuration.outerArcHeight + this._configuration.circlePadding;

        return (this._configuration.numberOfInnerCircles * innerWithPadding)
            + ((data.depth - this._configuration.numberOfInnerCircles - 1) * outerWithPadding)
            + this._configuration.outerArcHeight
            + this._configuration.centerCircleRadius;
    }

    /**
     * Get the center radius.
     *
     * @param {Object} data The D3 data object
     *
     * @return {number}
     */
    centerRadius(data)
    {
        return (this.innerRadius(data) + this.outerRadius(data)) / 2;
    }

    /**
     * Get an radius relative to the outer radius adjusted by the given
     * position in percent.
     *
     * @param {Object} data     The D3 data object
     * @param {number} position Percent offset (0 = inner radius, 100 = outer radius)
     *
     * @return {number}
     */
    relativeRadius(data, position)
    {
        const outer = this.outerRadius(data);
        return outer - ((100 - position) * (outer - this.innerRadius(data)) / 100);
    }

    /**
     * Calculates the angle in radians.
     *
     * @param {number} value The value
     *
     * @return {number}
     *
     * @private
     */
    calcAngle(value)
    {
        return Math.max(
            this.startPi,
            Math.min(this.endPi, this.scale(value))
        );
    }

    /**
     * Gets the start angle in radians.
     *
     * @param {Object} data The D3 data object
     *
     * @return {number}
     */
    startAngle(data)
    {
        return this.calcAngle(data.x0);
    }

    /**
     * Gets the end angle in radians.
     *
     * @param {Object} data The D3 data object
     *
     * @return {number}
     */
    endAngle(data)
    {
        return this.calcAngle(data.x1);
    }

    /**
     * Get an radius relative to the outer radius adjusted by the given
     * position in percent.
     *
     * @param {Object} data     The D3 data object
     * @param {number} position The percent offset (0 = inner radius, 100 = outer radius)
     *
     * @return {number}
     */
    arcLength(data, position)
    {
        return (this.endAngle(data) - this.startAngle(data)) * this.relativeRadius(data, position);
    }
}
