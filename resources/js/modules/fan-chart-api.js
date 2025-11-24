/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import { buildRendererContext, createRendererActions, instantiateRenderer } from "./renderer-factory";
import { wireRendererToControls } from "./ui-wiring";

/**
 * @typedef {ReturnType<typeof import("./renderer-factory").createRendererActions>} RendererActions
 * @typedef {import("./fan-chart-renderer").default} FanChartRenderer
 * @typedef {import("./custom/fan-chart-options").FanChartOptions} FanChartOptions
 * @typedef {ReturnType<typeof import("./renderer-factory").buildRendererContext>} RendererContext
 */

/**
 * Build a stable adapter exposing the renderer instance alongside its callable actions.
 * The adapter keeps renderer state untouched while wiring control callbacks.
 *
 * @param {FanChartOptions} [options] Fan chart configuration and host callbacks.
 * @param {RendererContext|undefined} [context] Optional prebuilt renderer context to reuse dependencies and resolved options.
 * @returns {{ renderer: FanChartRenderer, actions: RendererActions }} Public adapter containing the renderer and bound actions.
 */
export const createFanChartApi = (options = {}, context) => {
    let renderer;
    const rendererContext = context ?? buildRendererContext(options, {
        getContainer: () => renderer?._parent ?? null,
    });

    renderer = instantiateRenderer(rendererContext);

    const actions = createRendererActions(renderer);

    wireRendererToControls(actions, rendererContext.resolvedOptions);

    return { renderer, actions };
};

export default createFanChartApi;
