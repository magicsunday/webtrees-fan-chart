/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../../lib/d3";

/**
 * Factory for creating arc generators used across chart segments.
 */
export default class ArcFactory
{
    /**
     * @param {Geometry} geometry
     * @param {Object}   options
     * @param {number}   options.padAngle
     * @param {number}   options.padRadius
     * @param {number}   options.cornerRadius
     */
    constructor(geometry, { padAngle = 0, padRadius = 0, cornerRadius = 0 } = {})
    {
        this._geometry     = geometry;
        this._padAngle     = padAngle;
        this._padRadius    = padRadius;
        this._cornerRadius = cornerRadius;
    }

    /**
     * Creates the arc generator for the primary segment.
     *
     * @param {Object} datum
     * @param {Object} layout
     *
     * @returns {Function}
     */
    createPrimaryArc(datum, layout)
    {
        const arc = d3.arc()
            .startAngle(layout.startAngle)
            .endAngle(layout.endAngle)
            .innerRadius(layout.innerRadius)
            .outerRadius(layout.outerRadius);

        return this._applyPadding(arc, true);
    }

    /**
     * Creates the arc generator for overlay elements (e.g., color ring).
     *
     * @param {Object} datum
     * @param {Object} layout
     * @param {number} thickness
     *
     * @returns {Function}
     */
    createOverlayArc(datum, layout, thickness = 0)
    {
        const outerRadius = layout.outerRadius;

        const arc = d3.arc()
            .startAngle(layout.startAngle)
            .endAngle(layout.endAngle)
            .innerRadius(outerRadius - thickness)
            .outerRadius(outerRadius + 1);

        return this._applyPadding(arc);
    }

    /**
     * Applies padding values and the optional corner radius.
     *
     * @param {Function} arc
     * @param {boolean}  includeCornerRadius
     *
     * @returns {Function}
     *
     * @private
     */
    _applyPadding(arc, includeCornerRadius = false)
    {
        arc.padAngle(this._padAngle)
            .padRadius(this._padRadius);

        if (includeCornerRadius) {
            arc.cornerRadius(this._cornerRadius);
        }

        return arc;
    }
}
