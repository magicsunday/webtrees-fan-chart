/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Appends a <g class="arc"><path></g> structure to the given parent selection.
 * For elements entering the chart (CSS class "new"), opacity starts at nearly
 * zero so the Update transition can fade them in. For existing elements with a
 * family color, the fill is applied immediately via inline style.
 *
 * @param {Selection}             parent       The parent D3 selection (person or marriage <g>)
 * @param {Function}              arcGenerator A configured d3.arc() generator
 * @param {string|null|undefined} [color]      HSL fill color; omit to keep the default CSS fill
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
