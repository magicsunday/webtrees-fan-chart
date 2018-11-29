/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
export const MATH_DEG2RAD = Math.PI / 180;
export const MATH_RAD2DEG = 180 / Math.PI;
export const MATH_PI2     = Math.PI * 2;

/**
 *
 */
export class Geometry
{
    /**
     * Constructor.
     */
    constructor(options)
    {
        this.options = options;
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

        if (data.depth < this.options.numberOfInnerCircles) {
            return ((data.depth - 1) * (this.options.innerArcHeight + this.options.circlePadding))
                + this.options.centerCircleRadius;
        }

        return ((this.options.numberOfInnerCircles - 1) * (this.options.innerArcHeight + this.options.circlePadding))
            + ((data.depth - this.options.numberOfInnerCircles) * (this.options.outerArcHeight + this.options.circlePadding))
            + this.options.centerCircleRadius;
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
            return this.options.centerCircleRadius;
        }

        if (data.depth <  this.options.numberOfInnerCircles) {
            return ((data.depth - 1) * (this.options.innerArcHeight + this.options.circlePadding))
                + this.options.innerArcHeight + this.options.centerCircleRadius;
        }

        return ((this.options.numberOfInnerCircles - 1) * (this.options.innerArcHeight + this.options.circlePadding))
            + ((data.depth - this.options.numberOfInnerCircles) * (this.options.outerArcHeight + this.options.circlePadding))
            + this.options.outerArcHeight + this.options.centerCircleRadius;
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
            this.options.startPi,
            Math.min(this.options.endPi, this.options.x(value))
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
     * @returns {Number}
     */
    arcLength(data, position)
    {
        return (this.endAngle(data) - this.startAngle(data)) * this.relativeRadius(data, position);
    }
}
