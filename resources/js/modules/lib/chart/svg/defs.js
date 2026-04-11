/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * Wraps the SVG <defs> element and exposes append, select, and get helpers
 * so callers (Gradient, Text, Marriage, PngExport, …) can register path,
 * clipPath, linearGradient, and filter definitions without holding a raw D3
 * selection themselves.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Defs {
    /**
     * * @param {Selection} svg The D3 selection of the parent <svg> element
     */
    constructor(svg) {
        // Create the <svg:defs> element
        this._element = svg.append("defs");
    }

    get() {
        return this._element;
    }

    /**
     * Selects the first child of <defs> matching the selector.
     *
     * @param {function|string} select CSS selector or D3 selector function
     *
     * @returns {Selection}
     */
    select(select) {
        return this._element.select(select);
    }

    /**
     * Appends a new child element to <defs> and returns its D3 selection.
     *
     * @param {string|function} name Tag name or D3 creator function
     *
     * @returns {Selection}
     */
    append(name) {
        return this._element.append(name);
    }
}
