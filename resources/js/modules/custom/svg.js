/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../lib/d3";
import Defs from "../lib/chart/svg/defs";
import Zoom from "../lib/chart/svg/zoom";
import Filter from "./svg/filter";
import ExportFactory from "../lib/chart/svg/export-factory";

/**
 * Creates and manages the root SVG element for the fan chart. Owns the
 * <defs> block, the zoomable visual group, the floating tooltip div, and
 * the drop-shadow filter. Exposes a thin proxy API (select, selectAll,
 * attr, style, transition) so callers do not need to hold a reference to
 * the raw D3 selection.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Svg {
    /**
     * @param {Selection}     parent        The selected D3 parent element container
     * @param {Configuration} configuration The application configuration
     */
    constructor(parent, configuration) {
        // Create the <svg> element
        this._element = parent.append("svg");
        this._defs = new Defs(this._element);

        this._visual = null;
        this._zoom = null;
        this._div = null;
        this._configuration = configuration;

        this.init();
    }

    get defs() {
        return this._defs;
    }

    get zoom() {
        return this._zoom;
    }

    /**
     * The inner <g> element that receives the D3 zoom transform. All chart
     * content (persons, marriages, separators) lives inside this group.
     */
    get visual() {
        return this._visual;
    }

    /**
     * The floating tooltip <div> element. Carries an "active" property that
     * is set to true when the tooltip is pinned open via right-click.
     */
    get div() {
        return this._div;
    }

    /**
     * Sets fixed SVG attributes (size, text rendering, namespace) and registers
     * the drop-shadow filter definition.
     */
    init() {
        // Add SVG element
        this._element
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("text-rendering", "geometricPrecision")
            .attr("text-anchor", "middle")
            .attr("xmlns:xlink", "https://www.w3.org/1999/xlink");

        new Filter(this._defs.get());
    }

    /**
     * Binds SVG-level events: suppresses the context menu, shows the zoom/pan
     * overlay hint on wheel and touch gestures, creates the tooltip div, appends
     * the zoomable visual group, and attaches the D3 zoom behavior.
     *
     * @param {Overlay} overlay The overlay used for zoom/pan hint messages
     */
    initEvents(overlay) {
        this._element
            .on("contextmenu", (event) => event.preventDefault())
            .on("wheel", (event) => {
                if (!event.ctrlKey) {
                    overlay.show(
                        this._configuration.labels.zoom,
                        300,
                        () => {
                            overlay.hide(700, 800);
                        },
                    );
                }
            })
            .on("touchend", (event) => {
                if (event.touches.length < 2) {
                    overlay.hide(0, 800);
                }
            })
            .on("touchmove", (event) => {
                if (event.touches.length >= 2) {
                    // Hide tooltip on more than 2 fingers
                    overlay.hide();
                } else {
                    // Show tooltip if less than 2 fingers are used
                    overlay.show(this._configuration.labels.move);
                }
            })
            .on("click", (event) => this.doStopPropagation(event), true);

        if (this._configuration.rtl) {
            this._element.classed("rtl", true);
        }

        /**

         * @var {Selection} tooltip

         */
        const tooltip = d3.select("div.tooltip");

        if (tooltip.empty()) {
            this._div = d3.select("body")
                .append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);
        } else {
            this._div = tooltip
                .style("opacity", 0);
        }

        // Add a group
        this._visual = this._element.append("g");

        this._visual
            .append("g")
            .attr("class", "personGroup");

        this._zoom = new Zoom(this._visual);
        this._element.call(this._zoom.get());
    }

    /**
     * Stops propagation when the event's default was already prevented,
     * blocking ancestor handlers from receiving the same click.
     *
     * @param {Event} event
     */
    doStopPropagation(event) {
        if (event.defaultPrevented) {
            event.stopPropagation();
        }
    }

    /**
     * Instantiates and returns the appropriate export handler for the given type.
     *
     * @param {string} type "png" or "svg"
     *
     * @return {PngExport|SvgExport}
     */
    export(type) {
        const factory = new ExportFactory();

        return factory.createExport(type);
    }

    node() {
        return this._element.node();
    }

    /**
     * Selects the first descendant of the SVG element matching the selector.
     *
     * @param {function|string} select CSS selector or D3 selector function
     *
     * @returns {Selection}
     */
    select(select) {
        return this._element.select(select);
    }

    /**
     * Selects all descendants of the SVG element matching the selector.
     *
     * @param {function|string|null} select CSS selector or D3 selector function
     *
     * @returns {Selection}
     */
    selectAll(select) {
        return this._element.selectAll(select);
    }

    /**
     * Gets or sets a CSS style on the SVG element. Proxies d3 selection.style().
     *
     * @param {string} name
     *
     * @returns {string|this}
     */
    style(_name) {
        return this._element.style(...arguments);
    }

    /**
     * Gets or sets an attribute on the SVG element. Proxies d3 selection.attr().
     *
     * @param {string} _name
     *
     * @returns {string|this}
     */
    attr(_name) {
        return this._element.attr(...arguments);
    }

    /**
     * Creates a D3 transition on the SVG element. Used by Chart.center() to
     * animate the zoom reset.
     *
     * @returns {Transition}
     */
    transition() {
        return this._element.transition();
    }
}
