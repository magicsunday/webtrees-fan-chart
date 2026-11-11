/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * @import { Selection } from "d3-selection"
 */

/**
 * Appends a <g class="arc"><path></g> structure to the given parent selection.
 * When a family color is given, the fill is applied via inline style, otherwise
 * the default CSS fill stays.
 *
 * @param {Selection<any, any, any, any>} parent       The parent D3 selection (person or marriage <g>)
 * @param {Function}                       arcGenerator A configured d3.arc() generator
 * @param {string|null|undefined}          [color]      HSL fill color; omit to keep the default CSS fill
 */
export function appendArc(parent, arcGenerator, color) {
    const arcGroup = parent.append("g").attr("class", "arc");

    const path = arcGroup.append("path").attr("d", /** @type {any} */ (arcGenerator));

    if (color) {
        path.style("fill", color);
    }
}
