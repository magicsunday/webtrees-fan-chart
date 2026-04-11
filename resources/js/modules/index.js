/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "./lib/d3";
import Configuration from "./custom/configuration";
import Chart from "./custom/chart";

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
     * @param {Object} options  Configuration values passed from the server-rendered page
     *
     * @param {Object<string, string>} options.labels
     * @param {number}   options.generations
     * @param {number}   options.fanDegree
     * @param {number}   options.fontScale
     * @param {boolean}  options.hideEmptySegments
     * @param {boolean}  options.showFamilyColors
     * @param {boolean}  options.showParentMarriageDates
     * @param {boolean}  options.showImages
     * @param {boolean}  options.showSilhouettes
     * @param {boolean}  options.rtl
     * @param {number}   options.innerArcs
     * @param {string[]} options.cssFiles
     * @param {Data[]}   options.data
     */
    constructor(selector, options) {
        this._selector = selector;
        this._parent = d3.select(this._selector);

        // Set up configuration
        this._configuration = new Configuration(options);

        this._cssFiles = options.cssFiles;

        // Set up chart instance
        this._chart = new Chart(this._parent, this._configuration);

        this.init();
        this.draw(options.data);
    }

    /**
     * @return {Configuration}
     */
    get configuration() {
        return this._configuration;
    }

    /**
     * Binds toolbar button clicks (center, export PNG, export SVG) and sets
     * up fullscreen and orientation-change event listeners.
     */
    init() {
        // Bind click event on center button
        d3.select("#centerButton")
            .on("click", () => this._chart.center());

        // Bind click event on export as PNG button
        d3.select("#exportPNG")
            .on("click", () => this.exportPNG());

        // Bind click event on export as SVG button
        d3.select("#exportSVG")
            .on("click", () => this.exportSVG());

        this.addEventListeners();
    }

    /**
     * Registers fullscreen and screen-orientation change listeners that
     * toggle the body "fullscreen" attribute and recalculate the SVG viewBox.
     */
    addEventListeners() {
        // Listen for fullscreen change event
        document.addEventListener(
            "fullscreenchange",
            () => {
                if (document.fullscreenElement) {
                    // Add attribute to the body element to indicate fullscreen state
                    document.body.setAttribute("fullscreen", "");
                } else {
                    document.body.removeAttribute("fullscreen");
                }

                this._chart.updateViewBox();
            },
        );

        // Listen for orientation change event
        screen.orientation.addEventListener(
            "change",
            () => {
                this._chart.updateViewBox();
            });
    }

    /**
     * Re-centers the chart on the person at the given URL.
     *
     * @param {string} url The update URL returned by webtrees for the selected individual
     */
    update(url) {
        this._chart.update(url);
    }

    /**
     * Passes data to the chart and triggers the initial render.
     *
     * @param {Object} data The JSON-encoded chart data from the server
     */
    draw(data) {
        this._chart.data = data;
        this._chart.draw();
    }

    /**
     * Serializes the SVG to a canvas at A3 resolution and triggers a PNG download.
     */
    exportPNG() {
        this._chart.svg
            .export("png")
            .svgToImage(this._chart.svg, "fan-chart.png");
    }

    /**
     * Deep-clones the SVG with all computed styles inlined, inlines external
     * images as base64, and triggers an SVG file download.
     */
    exportSVG() {
        this._chart.svg
            .export("svg")
            .svgToImage(
                this._chart.svg,
                this._cssFiles,
                "webtrees-fan-chart-container",
                "fan-chart.svg",
            );
    }
}
