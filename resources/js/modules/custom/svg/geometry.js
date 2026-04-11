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
 * All radial and angular geometry calculations for the fan chart. Converts
 * D3 partition coordinates (depth, x0, x1) into pixel radii and radian
 * angles, computes font sizes capped to the segment width, and determines
 * whether outer-arc labels need to be flipped for the bottom half of a
 * 360° chart.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Geometry {
    /**
     * * @param {Configuration} configuration The application configuration
     */
    constructor(configuration) {
        this._configuration = configuration;
    }

    /**
     * Start angle of the fan in radians. For a 90° chart the fan begins at 0
     * (top); for all others it is centered on 0 (i.e. -fanDegree/2 radians).
     */
    get startPi() {
        if (this._configuration.fanDegree === 90) {
            return 0;
        }

        return -(this._configuration.fanDegree / 2 * MATH_DEG2RAD);
    }

    /**
     * End angle of the fan in radians. Symmetric with startPi for centered fans;
     * equals fanDegree in radians for the 90° quarter-circle variant.
     */
    get endPi() {
        if (this._configuration.fanDegree === 90) {
            return (this._configuration.fanDegree * MATH_DEG2RAD);
        }

        return (this._configuration.fanDegree / 2 * MATH_DEG2RAD);
    }

    /**
     * D3 linear scale that maps D3 partition x-coordinates [0, 1] to the fan's
     * angular range [startPi, endPi] in radians.
     */
    get scale() {
        return d3.scaleLinear().range([this.startPi, this.endPi]);
    }

    /**
     * Inner radius in pixels for the arc at the given depth. The center node
     * (depth 0) has an inner radius of 0. Inner arcs use innerArcHeight;
     * outer arcs beyond numberOfInnerCircles use outerArcHeight instead.
     *
     * @param {number} depth Hierarchy depth (0 = center node)
     */
    innerRadius(depth) {
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
     * Outer radius in pixels for the arc at the given depth. The center node
     * (depth 0) outer radius equals centerCircleRadius.
     *
     * @param {number} depth Hierarchy depth (0 = center node)
     */
    outerRadius(depth) {
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
     * Midpoint radius between innerRadius and outerRadius at the given depth,
     * used for text path placement and image positioning.
     *
     * @param {number} depth Hierarchy depth
     */
    centerRadius(depth) {
        return (this.innerRadius(depth) + this.outerRadius(depth)) / 2;
    }

    /**
     * Interpolates between innerRadius and outerRadius by position percent.
     * Used to place text paths at a specific vertical position within an arc band.
     *
     * @param {number} depth    Hierarchy depth
     * @param {number} position Percentage within the arc band (0 = inner edge, 100 = outer edge)
     */
    relativeRadius(depth, position) {
        const outer = this.outerRadius(depth);

        return outer - ((100 - position) * (outer - this.innerRadius(depth)) / 100);
    }

    /**
     * Converts a partition x-coordinate to radians, clamped to [startPi, endPi].
     *
     * @param {number} value Partition x-coordinate in [0, 1]
     */
    calcAngle(value) {
        return Math.max(this.startPi, Math.min(this.endPi, this.scale(value)));
    }

    /**
     * Start angle in radians for an arc at the given depth. The center node
     * always starts at 0; all others map x0 through calcAngle.
     *
     * @param {number} depth Hierarchy depth
     * @param {number} x0    Left partition boundary of the node
     */
    startAngle(depth, x0) {
        return (depth === 0) ? 0 : this.calcAngle(x0);
    }

    /**
     * End angle in radians for an arc at the given depth. The center node
     * always spans the full circle (2π); all others map x1 through calcAngle.
     *
     * @param {number} depth Hierarchy depth
     * @param {number} x1    Right partition boundary of the node
     */
    endAngle(depth, x1) {
        return (depth === 0) ? MATH_PI2 : this.calcAngle(x1);
    }

    /**
     * Arc length in pixels at the given radial position inside the arc band.
     * Used to determine whether truncated text fits within the segment.
     *
     * @param {Object} datum    D3 partition datum (needs depth, x0, x1)
     * @param {number} position Percentage within the arc band (0 = inner, 100 = outer)
     */
    arcLength(datum, position) {
        return (this.endAngle(datum.depth, datum.x1) - this.startAngle(datum.depth, datum.x0))
            * this.relativeRadius(datum.depth, position);
    }

    /**
     * Computes the effective font size in pixels for a node at datum.depth.
     * Starts from the base fontSize, subtracts depth, applies fontScale, and
     * for outer arcs caps the result so text fits within 55% of the angular
     * segment width (80% for single-line arcs at depth ≥ 7).
     *
     * @param {Object} datum D3 partition datum (needs depth, x0, x1)
     */
    getFontSize(datum) {
        let fontSize = this._configuration.fontSize;

        if (datum.depth >= (this._configuration.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        let scaled = (fontSize - datum.depth) * this._configuration.fontScale / 100.0;

        // For outer labels, cap font size so text fits within the angular
        // width of the segment. Uses 80% of angular width to leave visual
        // padding and account for descenders / em-box centering offset.
        if (datum.depth >= (this._configuration.numberOfInnerCircles + 1)) {
            const angularWidth = (this.endAngle(datum.depth, datum.x1) - this.startAngle(datum.depth, datum.x0)) * this.centerRadius(datum.depth);

            // Depth >= 7 merges first + last name into 1 line; others use 2
            const lines = datum.depth >= 7 ? 1 : 2;
            const maxFont = (angularWidth * 0.55) / lines;

            scaled = Math.min(scaled, maxFont);
        }

        return Math.max(1, scaled);
    }

    /**
     * Returns true when the arc's midpoint falls in the bottom half of a full
     * 360° chart (between 90° and 270°), indicating that text path direction
     * should be reversed so labels read left-to-right instead of upside-down.
     * Always returns false for fan degrees ≤ 270° or the center node.
     *
     * @param {number} depth Hierarchy depth
     * @param {number} x0    Left partition boundary of the node
     * @param {number} x1    Right partition boundary of the node
     */
    isPositionFlipped(depth, x0, x1) {
        if ((this._configuration.fanDegree <= 270) || (depth < 1)) {
            return false;
        }

        const startAngle = this.startAngle(depth, x0);
        const endAngle = this.endAngle(depth, x1);
        const midAngle = (startAngle + endAngle) / 2;
        const pi2 = Math.PI * 2;
        const normalized = ((midAngle % pi2) + pi2) % pi2;

        return (normalized > (90 * MATH_DEG2RAD)) && (normalized < (270 * MATH_DEG2RAD));
    }
}
