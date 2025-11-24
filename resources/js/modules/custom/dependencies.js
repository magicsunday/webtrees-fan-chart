/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import DataLoader from "./data-loader";
import D3ChartExporter from "./export/d3-chart-exporter";
import LayoutEngine from "./layout-engine";
import ViewLayer from "./view-layer";
import ViewportEventService from "./viewport-event-service";

/**
 * @typedef {import("./service-contracts").FanChartDependencies} FanChartDependencies
 */

/**
 * Build the default dependency bundle for the fan chart renderer.
 *
 * @param {object} options Dependency construction options.
 * @param {import("./configuration").default} options.configuration Resolved fan chart configuration.
 * @param {Array<string>} options.cssFiles CSS files to include in exports.
 * @param {(Partial<FanChartDependencies> & { exportService?: import("./service-contracts").FanChartExportService })} [options.overrides]
 *     Optional overrides for dependency instances.
 * @param {() => import("../lib/d3").Selection|null|undefined} [options.getContainer] Provider for the chart container selection.
 * @returns {FanChartDependencies} Instantiated dependencies for the fan chart renderer.
 */
export const createDefaultDependencies = ({ configuration, cssFiles, overrides = {}, getContainer }) => {
    const viewLayer = overrides.viewLayer ?? new ViewLayer(configuration);
    const layoutEngine = overrides.layoutEngine ?? new LayoutEngine(configuration);
    const dataLoader = overrides.dataLoader ?? new DataLoader();
    const chartExporter = overrides.chartExporter ?? overrides.exportService ?? new D3ChartExporter(cssFiles ?? []);
    const viewportService = overrides.viewportService ?? new ViewportEventService({
        getContainer,
        onUpdateViewBox: () => viewLayer.updateViewBox(),
        onCenter: () => viewLayer.center(),
    });

    return {
        viewLayer,
        layoutEngine,
        dataLoader,
        chartExporter,
        viewportService,
    };
};

export default createDefaultDependencies;
