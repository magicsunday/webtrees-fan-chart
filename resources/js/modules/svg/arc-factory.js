/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import * as d3 from "../d3.js";

/**
 * Creates a d3.arc() generator configured for a person arc segment using
 * geometry-derived radii and angles from the D3 partition datum.
 *
 * @param {object} geometry  Geometry instance for radius/angle calculations
 * @param {object} config    Configuration with padRadius, cornerRadius
 * @param {object} datum     D3 partition datum (depth, x0, x1)
 * @param {number} padAngle  Gap angle between adjacent arcs in radians
 *
 * @returns {Function} Configured d3.arc() generator
 */
export function createPersonArcGenerator(geometry, config, datum, padAngle) {
    return d3
        .arc()
        .startAngle(geometry.startAngle(datum.depth, datum.x0))
        .endAngle(geometry.endAngle(datum.depth, datum.x1))
        .innerRadius(geometry.innerRadius(datum.depth))
        .outerRadius(geometry.outerRadius(datum.depth))
        .padAngle(padAngle)
        .padRadius(config.padRadius)
        .cornerRadius(config.cornerRadius);
}

/**
 * Creates a d3.arc() generator configured for a marriage arc using pre-computed
 * geometry values from _resolveMarriageGeometry().
 *
 * @param {object} config   Configuration with cornerRadius
 * @param {object} geometry Pre-computed { startAngle, endAngle, innerR, outerR }
 *
 * @returns {Function} Configured d3.arc() generator
 */
export function createMarriageArcGenerator(config, geometry) {
    return d3
        .arc()
        .startAngle(geometry.startAngle)
        .endAngle(geometry.endAngle)
        .innerRadius(geometry.innerR)
        .outerRadius(geometry.outerR)
        .padAngle(0)
        .padRadius(0)
        .cornerRadius(config.cornerRadius);
}
