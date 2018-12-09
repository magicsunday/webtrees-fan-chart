/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "./d3";

export const MATH_DEG2RAD = Math.PI / 180;
export const MATH_RAD2DEG = 180 / Math.PI;
export const MATH_PI2     = Math.PI * 2;

/**
 * This class handles the geometric methods.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
export default class Geometry
{
    /**
     * Constructor.
     *
     * @param {Options} options
     */
    constructor(options)
    {
        this._options = options;
    }

    /**
     * @return {Number}
     *
     * @private
     */
    get startPi()
    {
        return -(this._options.fanDegree / 2 * MATH_DEG2RAD);
    }

    /**
     * @return {Number}
     *
     * @private
     */
    get endPi()
    {
        return (this._options.fanDegree / 2 * MATH_DEG2RAD);
    }

    /**
     * Scale the angles linear across the circle
     *
     * @return {Number}
     */
    get scale()
    {
        return d3.scaleLinear().range([this.startPi, this.endPi]);
    }

    /**
     * Get the inner radius depending on the depth of an element.
     *
     * @param {Object} data D3 data object
     *
     * @returns {Number}
     *
     * @public
     */
    innerRadius(data)
    {
        if (data.depth === 0) {
            return 0;
        }

        if (data.depth < this._options.numberOfInnerCircles) {
            return ((data.depth - 1) * (this._options.innerArcHeight + this._options.circlePadding))
                + this._options.centerCircleRadius;
        }

        const innerWithPadding = this._options.innerArcHeight + this._options.circlePadding;
        const outerWithPadding = this._options.outerArcHeight + this._options.circlePadding;

        return ((this._options.numberOfInnerCircles - 1) * innerWithPadding)
            + ((data.depth - this._options.numberOfInnerCircles) * outerWithPadding)
            + this._options.centerCircleRadius;
    }

    /**
     * Get the outer radius depending on the depth of an element.
     *
     * @param {Object} data D3 data object
     *
     * @returns {Number}
     *
     * @public
     */
    outerRadius(data)
    {
        if (data.depth === 0) {
            return this._options.centerCircleRadius;
        }

        if (data.depth <  this._options.numberOfInnerCircles) {
            return ((data.depth - 1) * (this._options.innerArcHeight + this._options.circlePadding))
                + this._options.innerArcHeight
                + this._options.centerCircleRadius;
        }

        const innerWithPadding = this._options.innerArcHeight + this._options.circlePadding;
        const outerWithPadding = this._options.outerArcHeight + this._options.circlePadding;

        return ((this._options.numberOfInnerCircles - 1) * innerWithPadding)
            + ((data.depth - this._options.numberOfInnerCircles) * outerWithPadding)
            + this._options.outerArcHeight
            + this._options.centerCircleRadius;
    }

    /**
     * Get the center radius.
     *
     * @param {Object} data D3 data object
     *
     * @returns {Number}
     *
     * @public
     */
    centerRadius(data)
    {
        return (this.innerRadius(data) + this.outerRadius(data)) / 2;
    }

    /**
     * Get an radius relative to the outer radius adjusted by the given
     * position in percent.
     *
     * @param {Object} data     D3 data object
     * @param {Number} position Percent offset (0 = inner radius, 100 = outer radius)
     *
     * @returns {number}
     *
     * @public
     */
    relativeRadius(data, position)
    {
        const outer = this.outerRadius(data);
        return outer - ((100 - position) * (outer - this.innerRadius(data)) / 100);
    }

    /**
     * Calculates the angle in radians.
     *
     * @param {Number} value The value
     *
     * @returns {Number}
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
     * @returns {Number}
     *
     * @public
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
     * @returns {Number}
     *
     * @public
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
     * @param {Number} position The percent offset (0 = inner radius, 100 = outer radius)
     *
     * @return {Number}
     *
     * @public
     */
    arcLength(data, position)
    {
        return (this.endAngle(data) - this.startAngle(data)) * this.relativeRadius(data, position);
    }
}
