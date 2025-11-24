/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import { createRenderer } from "./renderer-factory";
import { wireRendererToControls } from "./ui-wiring";

/**
 * @typedef {ReturnType<typeof import("./renderer-factory").createRendererActions>} RendererActions
 * @typedef {import("./fan-chart-renderer").default} FanChartRenderer
 * @typedef {import("./custom/fan-chart-options").FanChartOptions} FanChartOptions
 */

/**
 * Build a stable adapter exposing the renderer instance alongside its callable actions.
 * The adapter keeps renderer state untouched while wiring control callbacks.
 *
 * @param {FanChartOptions} [options] Fan chart configuration and host callbacks.
 * @returns {{ renderer: FanChartRenderer, actions: RendererActions }} Public adapter containing the renderer and bound actions.
 */
export const createFanChartApi = (options = {}) => {
    const { renderer, actions, resolvedOptions } = createRenderer(options);

    wireRendererToControls(actions, resolvedOptions);

    return { renderer, actions };
};

export default createFanChartApi;
