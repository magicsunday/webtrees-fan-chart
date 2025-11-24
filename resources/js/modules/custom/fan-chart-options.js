/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as defaultD3 from "../lib/d3";

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
 * @property {string} [selector] CSS selector targeting the chart container.
 * @property {Object} [data] Hierarchy data object for the fan chart.
 * @property {Array<string>} [labels] Label texts for the chart UI.
 * @property {number} [generations] Number of generations to render.
 * @property {number} [fanDegree] Degree span of the chart.
 * @property {number} [fontScale] Font scaling factor.
 * @property {boolean} [hideEmptySegments] Flag to hide empty chart segments.
 * @property {boolean} [showColorGradients] Flag to display color gradients instead of gender colors.
 * @property {boolean} [showParentMarriageDates] Flag to show parent marriage dates.
 * @property {boolean} [showImages] Flag to render images when available.
 * @property {boolean} [showSilhouettes] Flag to render silhouettes for missing images.
 * @property {boolean} [rtl] Flag to switch text to right-to-left rendering.
 * @property {number} [innerArcs] Number of inner arcs reserved for the root person.
 * @property {Array<string>} [cssFiles] Additional CSS files to load.
 * @property {FanChartControlCallbacks} [controls] Callback map for integrating host-provided controls.
 * @property {import("./configuration").default} [configuration] Optional configuration instance.
 * @property {typeof import("../lib/d3")} [d3] D3 instance for rendering.
 * @property {import("./service-contracts").FanChartViewLayer} [viewLayer] Optional view layer implementation.
 * @property {import("./service-contracts").FanChartLayoutEngine} [layoutEngine] Optional layout engine implementation.
 * @property {import("./service-contracts").FanChartDataLoader} [dataLoader] Optional data loader implementation.
 * @property {import("./service-contracts").FanChartExportService} [exportService] Optional export service implementation.
 * @property {(handler: () => void) => void} [onRender] Legacy inline control registration.
 * @property {(handler: () => void) => void} [onResize] Legacy inline control registration.
 * @property {(handler: () => void) => void} [onCenter] Legacy inline control registration.
 * @property {(handler: (type: string) => void) => void} [onExport] Legacy inline control registration.
 * @property {(handler: () => void) => void} [onExportPNG] Legacy inline control registration.
 * @property {(handler: () => void) => void} [onExportSVG] Legacy inline control registration.
 * @property {(handler: (url: string) => void) => void} [onUpdate] Legacy inline control registration.
 */

/**
 * @typedef {Object} ResolvedFanChartOptions
 * @property {string} selector
 * @property {Object} [data]
 * @property {Array<string>} labels
 * @property {number} generations
 * @property {number} fanDegree
 * @property {number} fontScale
 * @property {boolean} hideEmptySegments
 * @property {boolean} showColorGradients
 * @property {boolean} showParentMarriageDates
 * @property {boolean} showImages
 * @property {boolean} showSilhouettes
 * @property {boolean} rtl
 * @property {number} innerArcs
 * @property {Array<string>} cssFiles
 * @property {FanChartControlCallbacks|undefined} controls
 * @property {import("./configuration").default|undefined} configuration
 * @property {typeof import("../lib/d3")} d3
 * @property {import("./service-contracts").FanChartViewLayer|undefined} viewLayer
 * @property {import("./service-contracts").FanChartLayoutEngine|undefined} layoutEngine
 * @property {import("./service-contracts").FanChartDataLoader|undefined} dataLoader
 * @property {import("./service-contracts").FanChartExportService|undefined} exportService
 */

const toStringArray = (value = []) => Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [];

const toFiniteNumber = (value, fallback) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);

        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
};

const toBoolean = (value, fallback) => typeof value === "boolean"
    ? value
    : fallback;

const callbackKeys = [
    "onRender",
    "onResize",
    "onCenter",
    "onExport",
    "onExportPNG",
    "onExportSVG",
    "onUpdate",
];

const normalizeControls = (controls) => {
    if (!controls || typeof controls !== "object") {
        return undefined;
    }

    const normalized = callbackKeys.reduce((map, key) => {
        if (typeof controls[key] === "function") {
            map[key] = controls[key];
        }

        return map;
    }, {});

    return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const extractInlineControls = (options) => {
    const inlineControls = callbackKeys.reduce((map, key) => {
        if (typeof options[key] === "function") {
            map[key] = options[key];
        }

        return map;
    }, {});

    return Object.keys(inlineControls).length > 0 ? inlineControls : undefined;
};

export const FAN_CHART_DEFAULTS = Object.freeze({
    selector: "",
    data: null,
    labels: [],
    generations: 6,
    fanDegree: 210,
    fontScale: 100,
    hideEmptySegments: false,
    showColorGradients: false,
    showParentMarriageDates: false,
    showImages: false,
    showSilhouettes: false,
    rtl: false,
    innerArcs: 4,
    cssFiles: [],
    controls: undefined,
    configuration: undefined,
    d3: defaultD3,
    viewLayer: undefined,
    layoutEngine: undefined,
    dataLoader: undefined,
    exportService: undefined,
});

/**
 * Returns a new instance of the default fan chart options.
 *
 * @returns {ResolvedFanChartOptions}
 */
export const createDefaultFanChartOptions = () => ({
    ...FAN_CHART_DEFAULTS,
    labels: [...FAN_CHART_DEFAULTS.labels],
    cssFiles: [...FAN_CHART_DEFAULTS.cssFiles],
});

/**
 * Normalizes the user-provided options and injects defaults where necessary.
 *
 * @param {FanChartOptions} options
 *
 * @returns {ResolvedFanChartOptions}
 */
export const resolveFanChartOptions = (options = {}) => {
    const defaults    = createDefaultFanChartOptions();
    const inlineControls = extractInlineControls(options);
    const validatedControls = normalizeControls(options.controls ?? inlineControls);

    return {
        ...defaults,
        selector: typeof options.selector === "string" ? options.selector : defaults.selector,
        data: options.data ?? defaults.data,
        labels: toStringArray(options.labels ?? defaults.labels),
        generations: toFiniteNumber(options.generations, defaults.generations),
        fanDegree: toFiniteNumber(options.fanDegree, defaults.fanDegree),
        fontScale: toFiniteNumber(options.fontScale, defaults.fontScale),
        hideEmptySegments: toBoolean(options.hideEmptySegments, defaults.hideEmptySegments),
        showColorGradients: toBoolean(options.showColorGradients, defaults.showColorGradients),
        showParentMarriageDates: toBoolean(options.showParentMarriageDates, defaults.showParentMarriageDates),
        showImages: toBoolean(options.showImages, defaults.showImages),
        showSilhouettes: toBoolean(options.showSilhouettes, defaults.showSilhouettes),
        rtl: toBoolean(options.rtl, defaults.rtl),
        innerArcs: toFiniteNumber(options.innerArcs, defaults.innerArcs),
        cssFiles: toStringArray(options.cssFiles ?? defaults.cssFiles),
        controls: validatedControls,
        configuration: options.configuration,
        d3: options.d3 ?? defaults.d3,
        viewLayer: options.viewLayer ?? defaults.viewLayer,
        layoutEngine: options.layoutEngine ?? defaults.layoutEngine,
        dataLoader: options.dataLoader ?? defaults.dataLoader,
        exportService: options.exportService ?? defaults.exportService,
    };
};
