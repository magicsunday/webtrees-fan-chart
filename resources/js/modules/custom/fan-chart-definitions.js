/**
 * Shared fan chart contracts and defaults for factories, renderers, and services.
 *
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
 * @typedef {Object} FanChartBaseDefaults
 * @property {string} selector CSS selector targeting the chart container.
 * @property {ReadonlyArray<string>} cssFiles Default CSS files bundled with the chart.
 * @property {typeof import("../lib/d3")} d3 Default D3 dependency used by renderers and exporters.
 */

import * as defaultD3 from "../lib/d3";

/**
 * Keys used to normalize control callback bindings shared between factories and services.
 *
 * @type {ReadonlyArray<keyof FanChartControlCallbacks>}
 */
export const FAN_CHART_CONTROL_KEYS = Object.freeze([
    "onRender",
    "onResize",
    "onCenter",
    "onExport",
    "onExportPNG",
    "onExportSVG",
    "onUpdate",
]);

/**
 * Base defaults reused across option resolution, renderer initialization, and export services.
 *
 * @type {Readonly<FanChartBaseDefaults>}
 */
export const FAN_CHART_BASE_DEFAULTS = Object.freeze({
    selector: "",
    cssFiles: Object.freeze([]),
    d3: defaultD3,
});
