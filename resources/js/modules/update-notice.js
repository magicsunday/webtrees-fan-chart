/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * @import Svg from "./svg.js"
 */

/**
 * The class that marks the notice element of a failed update.
 *
 * @type {string}
 */
const NOTICE_CLASS = "fan-chart-update-notice";

/**
 * Looks up the notice element that sits directly above the svg of the chart.
 *
 * @param {SVGSVGElement} element The svg element of the chart
 *
 * @return {Element|null}
 */
function findNotice(element) {
    const previous = element.previousElementSibling;

    return previous?.classList.contains(NOTICE_CLASS) ? previous : null;
}

/**
 * Shows the notice of a failed update above the chart. A notice that is already there is reused,
 * so repeated failures leave one notice. The text is set as text and never as markup.
 *
 * @param {Svg}    svg  The svg of the chart
 * @param {string} text The translated notice
 */
export function showUpdateNotice(svg, text) {
    const element = svg.node();

    if (element === null || text === "") {
        return;
    }

    let notice = findNotice(element);

    if (notice === null) {
        notice = document.createElement("div");
        notice.className = `${NOTICE_CLASS} alert alert-danger`;
        notice.setAttribute("role", "alert");

        element.before(notice);
    }

    notice.textContent = text;
}

/**
 * Removes the notice of a failed update, if there is one.
 *
 * @param {Svg} svg The svg of the chart
 */
export function clearUpdateNotice(svg) {
    const element = svg.node();

    if (element !== null) {
        findNotice(element)?.remove();
    }
}
