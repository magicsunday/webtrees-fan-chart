/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import { createRendererActions } from "./renderer-factory";

/**
 * @typedef {ReturnType<typeof createRendererActions>} RendererActions
 * @typedef {import("./custom/fan-chart-definitions").FanChartControlCallbacks} ControlCallbacks
 * @typedef {import("./custom/fan-chart-options").FanChartOptions} FanChartOptions
 */

const forwardCallback = (callback, handler) => {
    if (typeof callback === "function") {
        callback(handler);
    }
};

/**
 * Register callbacks so controls can trigger renderer actions.
 *
 * @param {ControlCallbacks|undefined} callbacks Control callback bindings.
 * @param {RendererActions} actions Renderer actions to wire.
 * @returns {void}
 */
export const registerCallbacks = (callbacks, actions) => {
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
 * Resolve the container used to locate default controls.
 *
 * @param {string|undefined} selector CSS selector used to resolve the chart container.
 * @returns {Document|Element|undefined}
 */
export const resolveContainer = (selector) => {
    if (typeof document === "undefined") {
        return undefined;
    }

    if (!selector) {
        return document;
    }

    const chartElement = document.querySelector(selector);

    if (!chartElement) {
        return document;
    }

    const fullscreenContainer = chartElement.closest(".webtrees-fan-fullscreen-container");

    if (fullscreenContainer) {
        return fullscreenContainer;
    }

    return chartElement.closest(".webtrees-fan-chart-container") ?? chartElement;
};

/**
 * Build default control bindings inside the resolved chart container.
 *
 * @param {string|undefined} selector Selector pointing to the chart element.
 * @returns {ControlCallbacks|undefined}
 */
export const createDefaultControls = (selector) => {
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

/**
 * Wire renderer actions to provided or default controls, invoking an immediate render unless handled externally.
 *
 * @param {RendererActions} actions Renderer actions created for the current chart instance.
 * @param {FanChartOptions} options Fan chart options including callbacks and selectors.
 * @returns {ControlCallbacks|undefined}
 */
export const wireRendererToControls = (actions, options = {}) => {
    const callbacks = options.controls ?? createDefaultControls(options.selector);

    registerCallbacks(callbacks, actions);

    if (!callbacks || !callbacks.onRender) {
        actions.render();
    }

    return callbacks;
};
