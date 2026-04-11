/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Appends an arc group with path to the given parent element.
 * Applies family color and initial opacity for new elements.
 *
 * @param {Selection} parent       The parent D3 selection (person or marriage group)
 * @param {Function}  arcGenerator The configured d3.arc() generator
 * @param {string}    [color]      Optional fill color for the arc path
 */
export function appendArc(parent, arcGenerator, color) {
    const arcGroup = parent
        .append("g")
        .attr("class", "arc");

    const path = arcGroup
        .append("path")
        .attr("d", arcGenerator);

    if (parent.classed("new")) {
        path.style("opacity", 1e-6);
    } else if (color) {
        path.style("fill", color);
    }
}
