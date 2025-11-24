/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import { FAN_CHART_BASE_DEFAULTS } from "./custom/fan-chart-definitions";
import Update from "./custom/update";

/**
 * @typedef {import("./custom/service-contracts").FanChartLayoutEngine} FanChartLayoutEngine
 * @typedef {import("./custom/service-contracts").FanChartViewLayer} FanChartViewLayer
 * @typedef {import("./custom/service-contracts").FanChartDataLoader} FanChartDataLoader
 * @typedef {import("./custom/service-contracts").FanChartExportService} FanChartExportService
 * @typedef {import("./custom/service-contracts").FanChartDependencies} FanChartDependencies
 * @typedef {import("./custom/service-contracts").FanChartUpdateService} FanChartUpdateService
 * @typedef {import("./custom/service-contracts").FanChartUpdateServiceFactory} FanChartUpdateServiceFactory
 */

/**
 * Renders the fan chart.
 */
export default class FanChartRenderer
{
    /**
     * @param {object} options
     * @param {import("./custom/service-contracts").FanChartD3} [options.d3]
     * @param {string} options.selector
     * @param {import("./custom/configuration").default} options.configuration
     * @param {object} [options.data]
     * @param {FanChartDependencies} options.services
     * @param {FanChartUpdateService} [options.services.updateService]
     * @param {FanChartUpdateServiceFactory} [options.services.updateServiceFactory]
     */
    constructor({ d3 = FAN_CHART_BASE_DEFAULTS.d3, selector, configuration, data, services }) {
        this._d3            = d3;
        this._selector      = selector;
        this._configuration = configuration;
        this._data          = data;
        this._parent        = null;
        this._services      = services;
        this._updateService = services.updateService ?? null;
        this._updateFactory = services.updateServiceFactory ?? null;
        this._viewLayer     = /** @type {FanChartViewLayer} */ (services.viewLayer);
        this._layoutEngine  = /** @type {FanChartLayoutEngine} */ (services.layoutEngine);
        this._dataLoader    = /** @type {FanChartDataLoader} */ (services.dataLoader);
        this._chartExporter = /** @type {FanChartExportService} */ (services.chartExporter);
        this._viewportService = /** @type {import("./custom/service-contracts").ViewportEventService} */ (services.viewportService);
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
        if (!this._updateService && this._updateFactory) {
            this._updateService = this._updateFactory({
                svg: this._viewLayer.svg,
                configuration: this._configuration,
                layoutEngine: this._layoutEngine,
                dataLoader: this._dataLoader,
            });
        }

        if (!this._updateService) {
            this._updateService = new Update(this._viewLayer.svg, this._configuration, this._layoutEngine, this._dataLoader);
        }

        this._updateService.update(url, () => this._viewLayer.bindClickEventListener());
    }
}
