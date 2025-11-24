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
 * @typedef {ReturnType<typeof buildFanChartHandle>} FanChartPublicApi
 */

/**
 * Create a fan chart renderer and wire host-provided controls to its actions.
 *
 * @param {import("./custom/fan-chart-options").FanChartOptions} options Fan chart configuration and control callbacks.
 * @returns {FanChartPublicApi} Renderer-backed public API exposing callable actions.
 */
export const createFanChart = (options = {}) => {
    return buildFanChartHandle(createFanChartApi(options));
};

/**
 * Create an immutable, chainable API for interacting with the fan chart.
 *
 * @param {FanChartApiAdapter} adapter Renderer adapter containing stateful instances and actions.
 * @returns {FanChartPublicApi} Chainable API exposing the renderer, actions, and control registration helpers.
 */
const buildFanChartHandle = ({ renderer, actions }) => {
    const handle = {
        renderer,
        actions,
        render: () => {
            actions.render();

            return handle;
        },
        resize: () => {
            actions.resize();

            return handle;
        },
        center: () => {
            actions.center();

            return handle;
        },
        export: (type) => {
            actions.export(type);

            return handle;
        },
        update: (url) => {
            actions.update(url);

            return handle;
        },
        registerControls: (callbacks) => {
            registerCallbacks(callbacks, actions);

            return handle;
        },
    };

    return handle;
};

/**
 * Factory exporting a chainable FanChart API.
 *
 * @param {string} selector CSS selector resolving the chart container.
 * @param {import("./custom/fan-chart-options").FanChartOptions} [options] Optional fan chart configuration.
 * @returns {FanChartPublicApi} Public API wrapper around the renderer and its actions.
 */
export function FanChart(selector, options = {})
{
    return createFanChart({
        ...options,
        selector,
    });
}

export default FanChart;
