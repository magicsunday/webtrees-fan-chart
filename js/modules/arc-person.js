/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "./d3";
import {innerRadius, outerRadius, endAngle, startAngle} from "./radius";
import {MATH_PI2} from "./math";

/**
 * Appends the arc element to the person element.
 *
 * @param {Object} person The parent element used to append the arc too
 * @param {Object} data   The D3 data object
 *
 * @public
 */
export function addArcToPerson(person, data) {
    // Arc generator
    let arcGen = d3.arc()
        .startAngle(function () {
            return (data.depth === 0) ? 0 : startAngle(data);
        })
        .endAngle(function () {
            return (data.depth === 0) ? MATH_PI2 : endAngle(data);
        })
        .innerRadius(innerRadius(data))
        .outerRadius(outerRadius(data));

    // Append arc
    let arcGroup = person
        .append("g")
        .attr("class", "arc");

    let path = arcGroup
        .append("path")
        .attr("d", arcGen);

    // Hide arc initially if its new during chart update
    if (person.classed("new")) {
        path.style("opacity", 0);
    }
}
