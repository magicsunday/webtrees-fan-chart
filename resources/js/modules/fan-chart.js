/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import { createRenderer } from "./renderer-factory";
import { registerCallbacks, wireRendererToControls } from "./ui-wiring";

/**
 * Create a fan chart renderer and wire host-provided controls to its actions.
 *
 * @param {import("./custom/fan-chart-options").FanChartOptions} options Fan chart configuration and control callbacks.
 * @returns {import("./fan-chart-renderer").default & { actions: ReturnType<typeof import("./renderer-factory").createRendererActions> }} Renderer exposing callable actions.
 */
export const createFanChart = (options = {}) => {
    const { renderer, actions, resolvedOptions } = createRenderer(options);

    wireRendererToControls(actions, resolvedOptions);

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

export default FanChart;
