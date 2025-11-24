/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as defaultD3 from "./lib/d3";
import DataLoader from "./custom/data-loader";
import ExportService from "./custom/export-service";
import LayoutEngine from "./custom/layout-engine";
import ViewLayer from "./custom/view-layer";
import Update from "./custom/update";

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
        this._parent         = null;
        this._viewLayer      = new ViewLayer(this._configuration);
        this._layoutEngine   = new LayoutEngine(this._configuration);
        this._dataLoader     = new DataLoader();
        this._exportService  = new ExportService(this._cssFiles);
    }

    /**
     * Draws the chart.
     *
     * @returns {FanChartRenderer}
     */
    render()
    {
        this._parent = this._d3.select(this._selector);
        this._layoutEngine.initializeHierarchy(this._hierarchyData);
        this._viewLayer.onUpdate((url) => this.update(url));
        this._viewLayer.render(this._parent, this._layoutEngine);

        return this;
    }

    /**
     * Updates the view box of the chart.
     */
    resize()
    {
        this._viewLayer.updateViewBox();
    }

    /**
     * Resets the zoom state of the chart.
     */
    resetZoom()
    {
        this._viewLayer.center();
    }

    /**
     * Exports the chart as PNG or SVG.
     *
     * @param {string} type
     */
    export(type)
    {
        this._exportService.export(type, this._viewLayer.svg);
    }

    /**
     * Updates the chart with a new hierarchy root.
     *
     * @param {string} url
     */
    update(url)
    {
        this._update = new Update(this._viewLayer.svg, this._configuration, this._layoutEngine, this._dataLoader);

        this._update.update(url, () => this._viewLayer.bindClickEventListener());
    }
}
