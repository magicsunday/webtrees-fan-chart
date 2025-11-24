/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import createFanChartApi from "./fan-chart-api";
import { registerCallbacks } from "./ui-wiring";

/**
 * @typedef {ReturnType<typeof import("./fan-chart-api").default>} FanChartApiAdapter
 * @typedef {FanChartHandle} FanChartPublicApi
 */

/**
 * Chainable public API handle for interacting with a fan chart instance.
 */
export class FanChartHandle {
    /**
     * @param {FanChartApiAdapter} adapter Renderer adapter containing stateful instances and actions.
     */
    constructor({ renderer, actions }) {
        /** @type {FanChartApiAdapter["renderer"]} */
        this.renderer = renderer;
        /** @type {FanChartApiAdapter["actions"]} */
        this.actions = actions;
    }

    /**
     * Render the current chart view.
     *
     * @returns {this}
     */
    render() {
        this.actions.render();

        return this;
    }

    /**
     * Resize the chart to match its container.
     *
     * @returns {this}
     */
    resize() {
        this.actions.resize();

        return this;
    }

    /**
     * Center the chart on the currently selected individual.
     *
     * @returns {this}
     */
    center() {
        this.actions.center();

        return this;
    }

    /**
     * Export the chart using the configured renderer.
     *
     * @param {string|undefined} type Export type identifier.
     * @returns {this}
     */
    export(type) {
        this.actions.export(type);

        return this;
    }

    /**
     * Update the chart data from the provided endpoint.
     *
     * @param {string} url Endpoint providing updated chart data.
     * @returns {this}
     */
    update(url) {
        this.actions.update(url);

        return this;
    }

    /**
     * Wire custom control callbacks to renderer actions.
     *
     * @param {import("./custom/fan-chart-definitions").FanChartControlCallbacks|undefined} callbacks Control callback bindings.
     * @returns {this}
     */
    registerControls(callbacks) {
        registerCallbacks(callbacks, this.actions);

        return this;
    }
}

/**
 * Create a fan chart renderer and wire host-provided controls to its actions.
 *
 * @param {import("./custom/fan-chart-options").FanChartOptions} options Fan chart configuration and control callbacks.
 * @returns {FanChartPublicApi} Renderer-backed public API exposing callable actions.
 */
export const createFanChart = (options = {}) => new FanChartHandle(createFanChartApi(options));

/**
 * Factory exporting a chainable FanChart API.
 *
 * @param {string} selector CSS selector resolving the chart container.
 * @param {import("./custom/fan-chart-options").FanChartOptions} [options] Optional fan chart configuration.
 * @returns {FanChartPublicApi} Public API wrapper around the renderer and its actions.
 */
export function FanChart(selector, options = {}) {
    return createFanChart({
        ...options,
        selector,
    });
}

export default FanChart;
