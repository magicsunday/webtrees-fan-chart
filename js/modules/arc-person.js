import * as d3 from './d3'
import {innerRadius, outerRadius} from "./radius";

/**
 * Calculate the angle in radians.
 *
 * @param {number} value Value
 *
 * @returns {number}
 */
export function calcAngle(value) {
    return Math.max(
        rso.options.startPi,
        Math.min(rso.options.endPi, rso.options.x(value))
    );
}

/**
 * Get the start angle in radians.
 *
 * @param {object} d D3 data object
 *
 * @returns {number}
 */
export function startAngle(d) {
    return calcAngle(d.x0);
}

/**
 * Get the end angle in radians.
 *
 * @param {object} d D3 data object
 *
 * @returns {number}
 */
export function endAngle(d) {
    return calcAngle(d.x1);
}

/**
 * Append arc element to the person element.
 *
 * @param {object} person Parent element used to append the arc too
 * @param {object} d      D3 data object
 *
 * @return {void}
 */
export function addArcToPerson(person, d) {
    // Arc generator
    let arcGen = d3.arc()
        .startAngle(function () {
            return (d.depth === 0) ? 0 : startAngle(d);
        })
        .endAngle(function () {
            return (d.depth === 0) ? (Math.PI * 2) : endAngle(d);
        })
        .innerRadius(innerRadius(d))
        .outerRadius(outerRadius(d));

    // Append arc
    let arcGroup = person
        .append('g')
        .attr('class', 'arc');

    let path = arcGroup
        .append('path')
        .attr('d', arcGen);

    // Hide arc initially if its new during chart update
    if (person.classed('new')) {
        path.style('opacity', 0);
    }
}
