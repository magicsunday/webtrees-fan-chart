/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * @import { Selection } from "d3-selection"
 * @import Svg from "../svg.js"
 * @import Geometry from "./geometry.js"
 */

/**
 * The font properties of a text element that the measuring of a name needs.
 *
 * @typedef {{ fontSize: string, fontWeight: string }} TextFont
 */

/**
 * The metrics of the render passes, one entry per geometry. A geometry is created once for each pass
 * that draws labels, so the metrics of a pass end with it and a later pass reads the styles again.
 *
 * @type {WeakMap<Geometry, TextMetrics>}
 */
const metricsByGeometry = new WeakMap();

/**
 * Returns the metrics of the render pass that the geometry belongs to.
 *
 * @param {Svg}      svg      The chart svg
 * @param {Geometry} geometry The geometry instance of the render pass
 *
 * @return {TextMetrics}
 */
export function getTextMetrics(svg, geometry) {
    let metrics = metricsByGeometry.get(geometry);

    if (metrics === undefined) {
        metrics = new TextMetrics(svg);
        metricsByGeometry.set(geometry, metrics);
    }

    return metrics;
}

/**
 * Provides the font properties that the labels of one render pass are measured with. Reading the
 * computed style of an element that was just created makes the browser calculate the style of the
 * whole tree again, so doing it for every label costs most of the time of a render. The labels of a
 * pass share their styling, so each distinct styling is read once and the answer is reused.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class TextMetrics {
    /**
     * @param {Svg} svg The chart svg that carries the font family
     */
    constructor(svg) {
        this._svg = svg;

        /** @type {string|null} */
        this._fontFamily = null;

        /** @type {Map<string, TextFont>} */
        this._fonts = new Map();
    }

    /**
     * Returns the font family of the chart svg. It is read once for the pass.
     *
     * @return {string}
     */
    getFontFamily() {
        if (this._fontFamily === null) {
            this._fontFamily = /** @type {string} */ (this._svg.style("font-family"));
        }

        return this._fontFamily;
    }

    /**
     * Returns the font size and the font weight that the element renders with. The computed style is
     * read for the first element of each styling only. Elements share a styling when they have the
     * same tag, class and inline style, and so do all of their ancestors, which is all that the
     * style sheets of the chart select the font on.
     *
     * @param {Selection<any, any, any, any>} element The <text> or <textPath> element to measure for
     *
     * @return {TextFont}
     */
    getFont(element) {
        const key = this.createStylingKey(element.node());
        let font = this._fonts.get(key);

        if (font === undefined) {
            font = {
                fontSize: element.style("font-size"),
                fontWeight: element.style("font-weight"),
            };

            this._fonts.set(key, font);
        }

        return font;
    }

    /**
     * Describes everything that decides the font of an element: the tag, the class and the inline style
     * of the element and of each of its ancestors.
     *
     * @param {Element|null} element The element to describe
     *
     * @return {string}
     *
     * @private
     */
    createStylingKey(element) {
        const parts = [];

        for (let node = element; node !== null; node = node.parentElement) {
            parts.push(
                `${node.tagName}.${node.getAttribute("class") ?? ""}|${node.getAttribute("style") ?? ""}`,
            );
        }

        return parts.join(">");
    }
}
