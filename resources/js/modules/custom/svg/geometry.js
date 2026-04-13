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
     * @param {Configuration} configuration The application configuration
     */
    constructor(configuration) {
        this._configuration = configuration;
    }

    /**
     * Start angle of the fan in radians. For a 90° chart the fan begins at 0
     * (top); for all others it is centered on 0 (i.e. -fanDegree/2 radians).
     *
     * @return {number}
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
     *
     * @return {number}
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
     *
     * @return {Function}
     */
    get scale() {
        return d3.scaleLinear().range([this.startPi, this.endPi]);
    }

    /**
     * Inner radius in pixels for the arc at the given depth. The center node
     * (depth 0) has an inner radius of 0. Inner arcs use innerArcHeight;
     * outer arcs beyond numberOfInnerCircles use outerArcHeight instead.
     * Negative depths (descendants) use the same radii as their positive
     * counterparts via Math.abs().
     *
     * @param {number} depth Hierarchy depth (0 = center node)
     *
     * @return {number}
     */
    innerRadius(depth) {
        if (depth === 0) {
            return 0;
        }

        const absDepth = Math.abs(depth);

        // Descendant children (depth <= -2) skip circlePadding because
        // there is no marriage arc between partner and children rings.
        const padding = (depth < -1) ? 0 : this._configuration.circlePadding;

        if (absDepth <= this._configuration.numberOfInnerCircles) {
            return ((absDepth - 1) * (this._configuration.innerArcHeight))
                + this._configuration.centerCircleRadius
                + padding;
        }

        return (this._configuration.numberOfInnerCircles * this._configuration.innerArcHeight)
            + ((absDepth - this._configuration.numberOfInnerCircles - 1) * this._configuration.outerArcHeight)
            + this._configuration.centerCircleRadius
            + padding;
    }

    /**
     * Outer radius in pixels for the arc at the given depth. The center node
     * (depth 0) outer radius equals centerCircleRadius. Negative depths
     * (descendants) mirror the same radii as positive depths.
     *
     * @param {number} depth Hierarchy depth (0 = center node)
     *
     * @return {number}
     */
    outerRadius(depth) {
        if (depth === 0) {
            return this._configuration.centerCircleRadius;
        }

        const absDepth = Math.abs(depth);

        if (absDepth <= this._configuration.numberOfInnerCircles) {
            return ((absDepth - 1) * (this._configuration.innerArcHeight))
                + this._configuration.centerCircleRadius
                + this._configuration.innerArcHeight;
        }

        return (this._configuration.numberOfInnerCircles * this._configuration.innerArcHeight)
            + ((absDepth - this._configuration.numberOfInnerCircles - 1) * this._configuration.outerArcHeight)
            + this._configuration.centerCircleRadius
            + this._configuration.outerArcHeight;
    }

    /**
     * Midpoint radius between innerRadius and outerRadius at the given depth,
     * used for text path placement and image positioning.
     *
     * @param {number} depth Hierarchy depth
     *
     * @return {number}
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
     *
     * @return {number}
     */
    relativeRadius(depth, position) {
        const outer = this.outerRadius(depth);

        return outer - ((100 - position) * (outer - this.innerRadius(depth)) / 100);
    }

    /**
     * Converts a partition x-coordinate to radians, clamped to [startPi, endPi].
     *
     * @param {number} value Partition x-coordinate in [0, 1]
     *
     * @return {number}
     */
    calcAngle(value) {
        return Math.max(this.startPi, Math.min(this.endPi, this.scale(value)));
    }

    /**
     * Start angle in radians for an arc at the given depth. The center node
     * always starts at 0; negative depths (descendants) use the childScale;
     * positive depths use the ancestor scale via calcAngle.
     *
     * @param {number} depth Hierarchy depth
     * @param {number} x0    Left partition boundary of the node
     *
     * @return {number}
     */
    startAngle(depth, x0) {
        if (depth === 0) {
            return 0;
        }

        if (depth < 0) {
            return this._configuration.childScale
                ? this._configuration.childScale(x0)
                : 0;
        }

        return this.calcAngle(x0);
    }

    /**
     * End angle in radians for an arc at the given depth. The center node
     * always spans the full circle (2π); negative depths use the childScale;
     * positive depths use calcAngle.
     *
     * @param {number} depth Hierarchy depth
     * @param {number} x1    Right partition boundary of the node
     *
     * @return {number}
     */
    endAngle(depth, x1) {
        if (depth === 0) {
            return MATH_PI2;
        }

        if (depth < 0) {
            return this._configuration.childScale
                ? this._configuration.childScale(x1)
                : 0;
        }

        return this.calcAngle(x1);
    }

    /**
     * Arc length in pixels at the given radial position inside the arc band.
     * Used to determine whether truncated text fits within the segment.
     *
     * @param {Object} datum    D3 partition datum (needs depth, x0, x1)
     * @param {number} position Percentage within the arc band (0 = inner, 100 = outer)
     *
     * @return {number}
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
     *
     * @return {number}
     */
    getFontSize(datum) {
        const absDepth = Math.abs(datum.depth);
        let fontSize = this._configuration.fontSize;

        if (absDepth >= (this._configuration.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        let scaled = (fontSize - absDepth) * this._configuration.fontScale / 100.0;

        // For outer labels (ancestor or descendant), cap font size
        // so text fits within the angular width of the segment.
        const isOuterAncestor = datum.depth >= (this._configuration.numberOfInnerCircles + 1);
        const isPartner = (datum.depth === -1);
        const isChild = (datum.depth <= -2);

        if (isOuterAncestor || isPartner) {
            const angularWidth = (this.endAngle(datum.depth, datum.x1) - this.startAngle(datum.depth, datum.x0)) * this.centerRadius(datum.depth);

            // Depth >= 7 merges first + last name into 1 line; others use 2
            const lines = absDepth >= 7 ? 1 : 2;
            const factor = isPartner ? 0.35 : 0.55;
            const maxFont = (angularWidth * factor) / lines;

            scaled = Math.min(scaled, maxFont);
        }

        // Uniform font cap for all children based on the narrowest child arc
        if (isChild && this._configuration.smallestChildFraction) {
            const totalSectorRad = this.endAngle(datum.depth, 1) - this.startAngle(datum.depth, 0);
            const narrowestRad = this._configuration.smallestChildFraction * totalSectorRad;
            const narrowestWidth = narrowestRad * this.centerRadius(datum.depth);
            const maxFont = (narrowestWidth * 0.55) / 2;

            scaled = Math.min(scaled, maxFont);
        }

        return Math.max(1, scaled);
    }

    /**
     * Returns true when the arc's midpoint falls in the bottom half of the
     * chart (between 90° and 270°), indicating that text path direction
     * should be reversed so labels read left-to-right instead of upside-down.
     *
     * Center node (depth 0): never flipped.
     * Descendant nodes (depth < 0): always checked via childScale.
     * Ancestor nodes (depth >= 1): only checked for 360° charts (fanDegree > 270).
     *
     * @param {number} depth Hierarchy depth
     * @param {number} x0    Left partition boundary of the node
     * @param {number} x1    Right partition boundary of the node
     *
     * @return {boolean}
     */
    isPositionFlipped(depth, x0, x1) {
        if (depth === 0) {
            return false;
        }

        // Descendants: the entire sector sits in the lower half of the chart
        // (between 90° and 270°), so all arc-path text needs to be reversed
        // for left-to-right readability. Outer radial labels use this same
        // flag to determine rotation direction.
        if (depth < 0) {
            if (!this._configuration.childScale) {
                return false;
            }

            const midAngle = this._configuration.childScale((x0 + x1) / 2);
            const normalized = ((midAngle % MATH_PI2) + MATH_PI2) % MATH_PI2;

            return (normalized > (90 * MATH_DEG2RAD))
                && (normalized < (270 * MATH_DEG2RAD));
        }

        // depth >= 1: existing ancestor logic unchanged
        if (this._configuration.fanDegree <= 270) {
            return false;
        }

        const startAngle = this.startAngle(depth, x0);
        const endAngle = this.endAngle(depth, x1);
        const midAngle = (startAngle + endAngle) / 2;
        const normalized = ((midAngle % MATH_PI2) + MATH_PI2) % MATH_PI2;

        return (normalized > (90 * MATH_DEG2RAD)) && (normalized < (270 * MATH_DEG2RAD));
    }
}
