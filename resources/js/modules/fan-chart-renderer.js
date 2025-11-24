/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as defaultD3 from "./lib/d3";
import Chart from "./custom/chart";

/**
 * Renders the fan chart.
 */
export default class FanChartRenderer
{
    /**
     * @param {Object} options
     * @param {string} options.selector
     * @param {Configuration} options.configuration
     * @param {Object} options.hierarchyData
     * @param {string[]} [options.cssFiles]
     * @param {Object} [options.d3]
     */
    constructor({
        selector,
        configuration,
        hierarchyData,
        cssFiles = [],
        d3 = defaultD3,
    }) {
        this._d3             = d3;
        this._selector       = selector;
        this._configuration  = configuration;
        this._hierarchyData  = hierarchyData;
        this._cssFiles       = cssFiles;
        this._chart          = null;
        this._parent         = null;
    }

    /**
     * Draws the chart.
     *
     * @returns {FanChartRenderer}
     */
    render()
    {
        this._parent = this._d3.select(this._selector);
        this._chart  = new Chart(this._parent, this._configuration);

        this._chart.data = this._hierarchyData;
        this._chart.draw();

        return this;
    }

    /**
     * Updates the view box of the chart.
     */
    resize()
    {
        if (this._chart) {
            this._chart.updateViewBox();
        }
    }

    /**
     * Resets the zoom state of the chart.
     */
    resetZoom()
    {
        if (this._chart) {
            this._chart.center();
        }
    }

    /**
     * Exports the chart as PNG or SVG.
     *
     * @param {string} type
     */
    export(type)
    {
        if (!this._chart?.svg) {
            return;
        }

        if (type === "png") {
            this._chart.svg
                .export(type)
                .svgToImage(this._chart.svg, "fan-chart.png");

            return;
        }

        this._chart.svg
            .export(type)
            .svgToImage(
                this._chart.svg,
                this._cssFiles,
                "webtrees-fan-chart-container",
                "fan-chart.svg"
            );
    }

    /**
     * Updates the chart with a new hierarchy root.
     *
     * @param {string} url
     */
    update(url)
    {
        if (this._chart) {
            this._chart.update(url);
        }
    }
}
