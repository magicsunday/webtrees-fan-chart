/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Configuration from "./custom/configuration";
import { createDefaultDependencies } from "./custom/dependencies";
import { resolveFanChartOptions } from "./custom/fan-chart-options";
import FanChartRenderer from "./fan-chart-renderer";

/**
 * @typedef {import("./custom/fan-chart-options").FanChartOptions} FanChartOptions
 * @typedef {ReturnType<typeof createRendererActions>} RendererActions
 * @typedef {(renderer: FanChartRenderer) => RendererActions} ActionsFactory
 * @typedef {object} RendererFactoryHooks
 * @property {ActionsFactory} [createActions] Optional factory for creating action adapters.
 * @property {(renderer: FanChartRenderer) => void} [onCreated] Hook executed after the renderer instance has been constructed.
 */

const createConfiguration = (options) => options.configuration instanceof Configuration
    ? options.configuration
    : new Configuration(options);

/**
 * Map renderer methods to callable actions consumable by host controls.
 *
 * @param {FanChartRenderer} renderer Fan chart renderer instance.
 * @returns {{ render: () => void, resize: () => void, center: () => void, export: (type: string) => void, exportPNG: () => void, exportSVG: () => void, update: (url: string) => void }}
 */
export const createRendererActions = (renderer) => ({
    render: () => renderer.render(),
    resize: () => renderer.resize(),
    center: () => renderer.resetZoom(),
    export: (type) => renderer.export(type),
    exportPNG: () => renderer.export("png"),
    exportSVG: () => renderer.export("svg"),
    update: (url) => renderer.update(url),
});

/**
 * Create a renderer instance along with configurable action adapters.
 *
 * @param {FanChartOptions} options Fan chart configuration and controls.
 * @param {RendererFactoryHooks} hooks Optional hooks for renderer creation.
 * @returns {{ renderer: FanChartRenderer, actions: RendererActions, resolvedOptions: ReturnType<typeof resolveFanChartOptions> }}
 */
export const createRenderer = (options = {}, hooks = {}) => {
    const resolvedOptions = resolveFanChartOptions(options);
    const configuration   = createConfiguration(resolvedOptions);
    let renderer;
    const services = createDefaultDependencies({
        configuration,
        cssFiles: resolvedOptions.cssFiles,
        overrides: {
            viewLayer: resolvedOptions.viewLayer,
            layoutEngine: resolvedOptions.layoutEngine,
            dataLoader: resolvedOptions.dataLoader,
            chartExporter: resolvedOptions.chartExporter,
            exportService: resolvedOptions.exportService,
            viewportService: resolvedOptions.viewportService,
        },
        getContainer: () => renderer?._parent ?? null,
    });
    renderer = new FanChartRenderer({
        d3: resolvedOptions.d3,
        selector: resolvedOptions.selector,
        configuration,
        data: resolvedOptions.data,
        cssFiles: resolvedOptions.cssFiles,
        services,
    });

    hooks.onCreated?.(renderer);

    const buildActions = hooks.createActions ?? createRendererActions;
    const actions = buildActions(renderer);

    return {
        renderer,
        actions,
        resolvedOptions,
    };
};
