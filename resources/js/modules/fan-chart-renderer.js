/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import DataLoader from "./custom/data-loader";
import D3ChartExporter from "./custom/export/d3-chart-exporter";
import LayoutEngine from "./custom/layout-engine";
import ViewLayer from "./custom/view-layer";
import Update from "./custom/update";
import ViewportEventService from "./custom/viewport-event-service";
import * as defaultD3 from "./lib/d3";

/**
 * @typedef {import("./custom/service-contracts").FanChartLayoutEngine} FanChartLayoutEngine
 * @typedef {import("./custom/service-contracts").FanChartViewLayer} FanChartViewLayer
 * @typedef {import("./custom/service-contracts").FanChartDataLoader} FanChartDataLoader
 * @typedef {import("./custom/service-contracts").FanChartExportService} FanChartExportService
 */

/**
 * Renders the fan chart.
 */
export default class FanChartRenderer
{
    /**
     * @param {import("./custom/fan-chart-options").ResolvedFanChartOptions} options
     */
    constructor(options) {
        this._d3             = options.d3 ?? defaultD3;
        this._selector       = options.selector;
        this._configuration  = options.configuration;
        this._data           = options.data;
        this._cssFiles       = options.cssFiles ?? [];
        this._parent         = null;
        this._viewLayer      = /** @type {FanChartViewLayer} */ (options.viewLayer ?? new ViewLayer(this._configuration));
        this._layoutEngine   = /** @type {FanChartLayoutEngine} */ (options.layoutEngine ?? new LayoutEngine(this._configuration));
        this._dataLoader     = /** @type {FanChartDataLoader} */ (options.dataLoader ?? new DataLoader());
        this._chartExporter  = /** @type {FanChartExportService} */ (options.chartExporter ?? options.exportService ?? new D3ChartExporter(this._cssFiles));
        this._viewportService = /** @type {import("./custom/service-contracts").ViewportEventService} */ (
            options.viewportService ?? new ViewportEventService({
                getContainer: () => this._parent,
                onUpdateViewBox: () => this._viewLayer.updateViewBox(),
                onCenter: () => this._viewLayer.center(),
            })
        );
    }

    /**
     * Draws the chart.
     *
     * @returns {FanChartRenderer}
     */
    render()
    {
        this._parent = this._d3.select(this._selector);
        this._layoutEngine.initializeHierarchy(this._data);
        this._viewLayer.onUpdate((url) => this.update(url));
        this._viewLayer.render(this._parent, this._layoutEngine);
        this._viewportService.register();

        return this;
    }

    /**
     * Updates the view box of the chart.
     */
    resize()
    {
        this._viewportService.resize();
    }

    /**
     * Resets the zoom state of the chart.
     */
    resetZoom()
    {
        this._viewportService.center();
    }

    /**
     * Exports the chart as PNG or SVG.
     *
     * @param {string} type
     */
    export(type)
    {
        this._chartExporter.export(type, this._viewLayer.svg);
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
