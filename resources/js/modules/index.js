/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Configuration from "./custom/configuration";
import FanChartRenderer from "./fan-chart-renderer";

const createConfiguration = (options) => options.configuration instanceof Configuration
    ? options.configuration
    : new Configuration(
        options.labels,
        options.generations,
        options.fanDegree,
        options.fontScale,
        options.hideEmptySegments,
        options.showColorGradients,
        options.showParentMarriageDates,
        options.showImages,
        options.showSilhouettes,
        options.rtl,
        options.innerArcs,
    );

const forwardCallback = (callback, handler) => {
    if (typeof callback === "function") {
        callback(handler);
    }
};

const createRendererActions = (renderer) => ({
    render: () => renderer.render(),
    resize: () => renderer.resize(),
    center: () => renderer.resetZoom(),
    export: (type) => renderer.export(type),
    exportPNG: () => renderer.export("png"),
    exportSVG: () => renderer.export("svg"),
    update: (url) => renderer.update(url),
});

const registerCallbacks = (callbacks, actions) => {
    if (!callbacks) {
        return;
    }

    forwardCallback(callbacks.onRender, actions.render);
    forwardCallback(callbacks.onResize, actions.resize);
    forwardCallback(callbacks.onCenter, actions.center);
    forwardCallback(callbacks.onExport, actions.export);
    forwardCallback(callbacks.onExportPNG, actions.exportPNG);
    forwardCallback(callbacks.onExportSVG, actions.exportSVG);
    forwardCallback(callbacks.onUpdate, actions.update);
};

/**
 * @typedef {Object} FanChartControlCallbacks
 * @property {(handler: () => void) => void} [onRender] Register a handler that triggers rendering.
 * @property {(handler: () => void) => void} [onResize] Register a handler that resizes the chart.
 * @property {(handler: () => void) => void} [onCenter] Register a handler that resets zoom and centers the chart.
 * @property {(handler: (type: string) => void) => void} [onExport] Register a handler for custom export triggers.
 * @property {(handler: () => void) => void} [onExportPNG] Register a handler for PNG export.
 * @property {(handler: () => void) => void} [onExportSVG] Register a handler for SVG export.
 * @property {(handler: (url: string) => void) => void} [onUpdate] Register a handler to refresh data from a URL.
 */

/**
 * @typedef {Object} FanChartOptions
 * @property {string} selector CSS selector targeting the chart container.
 * @property {Object} [data] Hierarchy data object for the fan chart.
 * @property {Configuration} [configuration] Optional configuration instance.
 * @property {Array<string>} [cssFiles] Additional CSS files to load.
 * @property {FanChartControlCallbacks} [controls] Callback map for integrating host-provided controls.
 * @property {Function} [d3] D3 instance for rendering.
 */

/**
 * Create a fan chart renderer and wire host-provided controls to its actions.
 *
 * @param {FanChartOptions} options Fan chart configuration and control callbacks.
 * @returns {FanChartRenderer & { actions: ReturnType<typeof createRendererActions> }} Renderer exposing callable actions.
 */
export const createFanChart = (options = {}) => {
    const configuration = createConfiguration(options);
    const renderer      = new FanChartRenderer({
        selector: options.selector,
        configuration,
        hierarchyData: options.data,
        cssFiles: options.cssFiles || [],
        d3: options.d3,
    });

    const actions = createRendererActions(renderer);
    const callbacks = options.controls ?? {
        onRender: options.onRender,
        onResize: options.onResize,
        onCenter: options.onCenter,
        onExport: options.onExport,
        onExportPNG: options.onExportPNG,
        onExportSVG: options.onExportSVG,
        onUpdate: options.onUpdate,
    };

    registerCallbacks(callbacks, actions);

    if (!callbacks || !callbacks.onRender) {
        actions.render();
    }

    renderer.actions = actions;

    return renderer;
};

export class FanChart
{
    constructor(selector, options = {})
    {
        this.renderer = createFanChart({
            ...options,
            selector,
        });
        this.actions  = this.renderer.actions;
    }

    render()
    {
        this.actions.render();

        return this;
    }

    resize()
    {
        this.actions.resize();

        return this;
    }

    center()
    {
        this.actions.center();

        return this;
    }

    export(type)
    {
        this.actions.export(type);

        return this;
    }

    update(url)
    {
        this.actions.update(url);

        return this;
    }

    registerControls(callbacks)
    {
        registerCallbacks(callbacks, this.actions);

        return this;
    }
}

export { FanChartRenderer };
export default FanChart;
