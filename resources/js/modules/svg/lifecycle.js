/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Reads the D3 lifecycle CSS classes from an element and returns
 * a structured object indicating the element's current state in the
 * enter/update/exit data join.
 *
 * @param {object} element D3 selection with .classed() method
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

/**
 * Sets a selection's opacity to near-zero when the parent element is
 * in the "update" lifecycle state. Used for cross-fade transitions
 * where new content fades in while old content fades out.
 *
 * @param {object} selection D3 selection to hide
 * @param {object} parent    D3 selection of the parent element
 */
export function fadeIfUpdating(selection, parent) {
    if (parent.classed("update")) {
        selection.style("opacity", 1e-6);
    }
}
