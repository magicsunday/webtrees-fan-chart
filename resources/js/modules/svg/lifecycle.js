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
 * Reads the D3 lifecycle CSS classes from an element and returns a structured
 * object indicating the element's current state in the enter/update/exit data
 * join.
 *
 * @param {Selection<any, any, any, any>} element D3 selection with .classed() method
 *
 * @returns {{ isNew: boolean, isUpdate: boolean, isRemove: boolean }}
 */
export function classifyElement(element) {
    return {
        isNew: element.classed("new"),
        isUpdate: element.classed("update"),
        isRemove: element.classed("remove"),
    };
}
