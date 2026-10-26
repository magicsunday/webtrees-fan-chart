/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "./d3.js";
import Configuration from "./configuration.js";
import Chart from "./chart.js";
import { DetailPanel } from "@magicsunday/webtrees-chart-lib/chart-core";

/**
 * @import { Selection } from "d3-selection"
 * @import { NodeDatum } from "./hierarchy.js"
 */

/**
 * The panels of the page and the chart that each one acts on. A chart that is loaded again, for
 * example by the descendants switch, builds a new FanChart against the same panel element. The
 * element has one panel with its listeners, so the panel is created once and its actions follow
 * the chart that was built last.
 *
 * @type {WeakMap<Element, { target: { chart: Chart }, panel: DetailPanel }>}
 */
const detailPanels = new WeakMap();

/**
 * Top-level entry point for the fan chart. Wires together the Configuration,
 * Chart, and DOM event listeners, then performs the initial draw.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export class FanChart {
    /**
     * @param {string} selector The CSS selector of the container element to render the chart into
     * @param {object} options  Configuration values passed from the server-rendered page
     *
     * @param {{ zoom: string, move: string }} options.labels The zoom and move hint texts of the overlay
     * @param {number}    options.generations
     * @param {number}    options.fanDegree
     * @param {number}    options.fontScale
     * @param {boolean}   options.hideEmptySegments
     * @param {boolean}   options.showFamilyColors
     * @param {boolean}   options.showParentMarriageDates
     * @param {boolean}   options.showImages
     * @param {boolean}   options.showSilhouettes
     * @param {boolean}   options.showPlaces
     * @param {boolean}   options.showNames
     * @param {boolean}   options.showDescendants
     * @param {boolean}   options.showDetailPanel
     * @param {string}    options.paternalColor
     * @param {string}    options.maternalColor
     * @param {string}    options.nameAbbreviation
     * @param {boolean}   options.rtl
     * @param {number}    options.innerArcs
     * @param {string[]}  options.cssFiles
     * @param {NodeDatum} options.data
     */
    constructor(selector, options) {
        this._selector = selector;
        this._parent = /** @type {Selection<HTMLElement, unknown, HTMLElement, unknown>} */ (
            d3.select(this._selector)
        );

        // Set up configuration
        this._configuration = new Configuration(options);

        // Set up chart instance
        this._chart = new Chart(this._parent, this._configuration);

        // The panel is set up before the first draw, so a chart that is drawn while the panel
        // switch is on already finds the panel connected.
        this.initDetailPanel();

        this.init();

        // Pass the data to the chart and trigger the initial render
        this._chart.data = options.data;
        this._chart.render();
    }

    /**
     * Connects the detail panel of the page with the chart. A chart without the detail panel
     * leaves the panel element of the page hidden.
     *
     * @private
     */
    initDetailPanel() {
        const element = document.getElementById("webtrees-fan-detail-panel");

        if (!this._configuration.showDetailPanel || element === null) {
            return;
        }

        const bound = detailPanels.get(element);

        if (bound !== undefined) {
            bound.target.chart = this._chart;
            this._chart.detailPanel = bound.panel;

            return;
        }

        const target = { chart: this._chart };
        const panel = new DetailPanel(element, {
            onIndividual: (url) => target.chart.redirectToIndividual(url),
            onCenter: (url) => target.chart.update(url),
            onClose: () => target.chart.restoreFocus(),
            onHidden: () => target.chart.clearSelection(),
        });

        panel.enable();
        detailPanels.set(element, { target, panel });
        this._chart.detailPanel = panel;
    }

    /**
     * Binds toolbar button clicks (center, export PNG, export SVG) and sets up
     * fullscreen and orientation-change event listeners.
     */
    init() {
        // Bind click event on center button
        d3.select("#centerButton").on("click", () => this._chart.center());

        // Bind click event on export as PNG button
        d3.select("#exportPNG").on("click", () => this.exportPNG());

        // Bind click event on export as SVG button
        d3.select("#exportSVG").on("click", () => this.exportSVG());

        this.addEventListeners();
    }

    /**
     * Registers fullscreen and screen-orientation change listeners that toggle
     * the body "fullscreen" attribute and recalculate the SVG viewBox.
     *
     * @private
     */
    addEventListeners() {
        // Listen for fullscreen change event
        document.addEventListener("fullscreenchange", () => {
            if (document.fullscreenElement) {
                // Add attribute to the body element to indicate fullscreen state
                document.body.setAttribute("fullscreen", "");
            } else {
                document.body.removeAttribute("fullscreen");
            }

            this._chart.updateViewBox();
        });

        // Listen for orientation change event
        screen.orientation.addEventListener("change", () => {
            this._chart.updateViewBox();
        });
    }

    /**
     * Serializes the SVG to a canvas at A3 resolution and triggers a PNG
     * download.
     *
     * @private
     */
    exportPNG() {
        this._chart.svg.export("png").svgToImage(this._chart.svg, "fan-chart.png");
    }

    /**
     * Deep-clones the SVG with all computed styles inlined, inlines external
     * images as base64, and triggers an SVG file download.
     *
     * @private
     */
    exportSVG() {
        this._chart.svg.export("svg").svgToImage(this._chart.svg, "fan-chart.svg");
    }
}
