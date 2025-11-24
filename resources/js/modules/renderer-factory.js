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

const buildDependencies = ({ configuration, resolvedOptions, getContainer }) => createDefaultDependencies({
    configuration,
    cssFiles: resolvedOptions.cssFiles,
    overrides: {
        viewLayer: resolvedOptions.viewLayer,
        layoutEngine: resolvedOptions.layoutEngine,
        dataLoader: resolvedOptions.dataLoader,
        chartExporter: resolvedOptions.chartExporter,
        exportService: resolvedOptions.exportService,
        viewportService: resolvedOptions.viewportService,
        updateService: resolvedOptions.updateService,
        updateServiceFactory: resolvedOptions.updateServiceFactory,
    },
    getContainer,
});

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
 * Resolve configuration, options, and dependencies without instantiating the renderer.
 *
 * @param {FanChartOptions} [options] Fan chart configuration and controls.
 * @param {{ getContainer?: () => import("./lib/d3").Selection|null|undefined }} [hooks] Optional dependency hooks.
 * @returns {{ configuration: Configuration, resolvedOptions: ReturnType<typeof resolveFanChartOptions>, dependencies: ReturnType<typeof createDefaultDependencies> }}
 *     Renderer context with resolved configuration, options, and dependencies.
 */
export const buildRendererContext = (options = {}, hooks = {}) => {
    const resolvedOptions = resolveFanChartOptions(options);
    const configuration = createConfiguration(resolvedOptions);
    const dependencies = buildDependencies({
        configuration,
        resolvedOptions,
        getContainer: hooks.getContainer,
    });

    return { configuration, resolvedOptions, dependencies };
};

/**
 * Create a renderer instance from a prebuilt context.
 *
 * @param {{ configuration: Configuration, resolvedOptions: ReturnType<typeof resolveFanChartOptions>, dependencies: ReturnType<typeof createDefaultDependencies> }} context
 *     Renderer context containing configuration, resolved options, and dependencies.
 * @returns {FanChartRenderer} Renderer instance created from the provided context.
 */
export const instantiateRenderer = (context) => new FanChartRenderer({
    d3: context.resolvedOptions.d3,
    selector: context.resolvedOptions.selector,
    configuration: context.configuration,
    data: context.resolvedOptions.data,
    cssFiles: context.resolvedOptions.cssFiles,
    services: context.dependencies,
});

/**
 * Create a renderer instance along with configurable action adapters.
 *
 * @param {FanChartOptions} options Fan chart configuration and controls.
 * @param {RendererFactoryHooks} hooks Optional hooks for renderer creation.
 * @returns {{ renderer: FanChartRenderer, actions: RendererActions, resolvedOptions: ReturnType<typeof resolveFanChartOptions> }}
 */
export const createRenderer = (options = {}, hooks = {}) => {
    let renderer;
    const context = buildRendererContext(options, {
        getContainer: () => renderer?._parent ?? null,
    });
    renderer = instantiateRenderer(context);

    hooks.onCreated?.(renderer);

    const buildActions = hooks.createActions ?? createRendererActions;
    const actions = buildActions(renderer);

    return {
        renderer,
        actions,
        resolvedOptions: context.resolvedOptions,
    };
};
