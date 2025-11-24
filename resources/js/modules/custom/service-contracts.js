/**
 * Contracts for fan chart services to allow sharing across visualizations.
 */

/**
 * @typedef {import("../lib/d3")} FanChartD3
 */

/**
 * @typedef {object} FanChartViewLayer
 * @property {(callback: (url: string) => void) => void} onUpdate Register an update callback.
 * @property {(parent: import("../lib/d3").Selection, layoutEngine: FanChartLayoutEngine) => void} render Render the view layer.
 * @property {() => void} updateViewBox Recalculate the view box after layout changes.
 * @property {() => void} center Reset zoom and center the chart.
 * @property {() => void} bindClickEventListener Bind click handlers to rendered nodes.
 * @property {import("./svg").default|null} svg SVG wrapper instance.
 */

/**
 * @typedef {object} FanChartLayoutEngine
 * @property {(data: object) => void} initializeHierarchy Prepare the layout hierarchy.
 * @property {import("./hierarchy").default} hierarchy Hierarchy helper.
 * @property {import("./svg/geometry").default} geometry Geometry helper.
 * @property {import("./svg/segments/arc-factory").default} arcFactory Arc factory helper.
 */

/**
 * @typedef {object} FanChartDataLoader
 * @property {(url: string) => Promise<object>} fetchHierarchy Load hierarchy data from a remote source.
 */

/**
 * @typedef {object} FanChartExportService
 * @property {(type: string, svg: import("./svg").default|null) => void} export Export the given SVG.
 */

export {};
