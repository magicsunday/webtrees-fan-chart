/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import DataLoader from "./custom/data-loader";
import ExportService from "./custom/export-service";
import LayoutEngine from "./custom/layout-engine";
import ViewLayer from "./custom/view-layer";
import Update from "./custom/update";
import * as defaultD3 from "./lib/d3";

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
        this._viewLayer      = new ViewLayer(this._configuration);
        this._layoutEngine   = new LayoutEngine(this._configuration);
        this._dataLoader     = new DataLoader();
        this._exportService  = new ExportService(this._cssFiles);
        this._handleFullscreenChange = this.handleFullscreenChange.bind(this);
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
        document.addEventListener("fullscreenchange", this._handleFullscreenChange);

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
     * Reacts to changes of the fullscreen state and resizes the chart if the
     * current view is affected.
     */
    handleFullscreenChange()
    {
        const fullscreenElement = document.fullscreenElement;
        const parentNode        = this._parent?.node?.();

        if (!parentNode) {
            return;
        }

        const exitedFullscreen       = fullscreenElement === null;
        const fullscreenContainsNode = fullscreenElement?.contains?.(parentNode) ?? false;
        const nodeContainsFullscreen = parentNode.contains?.(fullscreenElement) ?? false;
        const isFullscreenTarget = fullscreenElement === parentNode
            || fullscreenContainsNode
            || nodeContainsFullscreen;

        document.documentElement?.toggleAttribute("fullscreen", !exitedFullscreen && isFullscreenTarget);

        if (exitedFullscreen || isFullscreenTarget) {
            this.resize();
        }
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
