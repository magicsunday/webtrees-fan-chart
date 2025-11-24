/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Configuration from "./custom/configuration";
import { resolveFanChartOptions } from "./custom/fan-chart-options";
import FanChartRenderer from "./fan-chart-renderer";

const createConfiguration = (options) => options.configuration instanceof Configuration
    ? options.configuration
    : new Configuration(options);

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

const resolveContainer = (selector) => {
    if (typeof document === "undefined") {
        return undefined;
    }

    if (!selector) {
        return document;
    }

    const chartElement = document.querySelector(selector);

    return chartElement?.closest(".webtrees-fan-chart-container") ?? chartElement ?? document;
};

const createDefaultControls = (selector) => {
    const container = resolveContainer(selector);

    if (!container) {
        return undefined;
    }

    const bindingsAvailable = ["centerButton", "exportPNG", "exportSVG"].some((id) =>
        container.querySelector(`#${id}`)
    );

    if (!bindingsAvailable) {
        return undefined;
    }

    const bind = (id, handler) => {
        const element = container.querySelector(`#${id}`);

        if (element && typeof handler === "function") {
            element.addEventListener("click", handler);
        }
    };

    const controls = {
        onCenter: (handler) => bind("centerButton", handler),
        onExportPNG: (handler) => bind("exportPNG", handler),
        onExportSVG: (handler) => bind("exportSVG", handler),
    };

    return controls;
};

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
 * Create a fan chart renderer and wire host-provided controls to its actions.
 *
 * @param {import("./custom/fan-chart-options").FanChartOptions} options Fan chart configuration and control callbacks.
 * @returns {FanChartRenderer & { actions: ReturnType<typeof createRendererActions> }} Renderer exposing callable actions.
 */
export const createFanChart = (options = {}) => {
    const resolvedOptions = resolveFanChartOptions(options);
    const configuration   = createConfiguration(resolvedOptions);
    const renderer = new FanChartRenderer({
        ...resolvedOptions,
        configuration,
    });

    const actions = createRendererActions(renderer);
    const callbacks = resolvedOptions.controls ?? createDefaultControls(resolvedOptions.selector);

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

export { createDefaultFanChartOptions, FAN_CHART_DEFAULTS, resolveFanChartOptions } from "./custom/fan-chart-options";
export { FanChartRenderer };
export default FanChart;
