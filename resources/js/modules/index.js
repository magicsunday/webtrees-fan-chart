/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Configuration from "./custom/configuration";
import FanChartRenderer from "./fan-chart-renderer";

const createConfiguration = (options) => options.configuration instanceof Configuration
    ? options.configuration
    : new Configuration(
        options.labels,
        options.generations,
        options.fanDegree,
        options.fontScale,
        options.hideEmptySegments,
        options.showColorGradients,
        options.showParentMarriageDates,
        options.showImages,
        options.showSilhouettes,
        options.rtl,
        options.innerArcs,
    );

const forwardCallback = (callback, handler) => {
    if (typeof callback === "function") {
        callback(handler);
    }
};

export const createFanChart = (options = {}) => {
    const configuration = createConfiguration(options);
    const renderer      = new FanChartRenderer({
        selector: options.selector,
        configuration,
        hierarchyData: options.data,
        cssFiles: options.cssFiles || [],
        d3: options.d3,
    });

    forwardCallback(options.onRender, () => renderer.render());
    forwardCallback(options.onResize, () => renderer.resize());
    forwardCallback(options.onCenter, () => renderer.resetZoom());
    forwardCallback(options.onExport, (type) => renderer.export(type));

    if (!options.onRender) {
        renderer.render();
    }

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

        this._bindDefaultControls();
    }

    _bindDefaultControls()
    {
        const centerButton = document.querySelector("#centerButton");
        const exportPng    = document.querySelector("#exportPNG");
        const exportSvg    = document.querySelector("#exportSVG");

        if (centerButton) {
            centerButton.addEventListener("click", () => this.center());
        }

        if (exportPng) {
            exportPng.addEventListener("click", () => this.export("png"));
        }

        if (exportSvg) {
            exportSvg.addEventListener("click", () => this.export("svg"));
        }
    }

    render()
    {
        this.renderer.render();

        return this;
    }

    resize()
    {
        this.renderer.resize();

        return this;
    }

    center()
    {
        this.renderer.resetZoom();

        return this;
    }

    export(type)
    {
        this.renderer.export(type);

        return this;
    }

    update(url)
    {
        this.renderer.update(url);

        return this;
    }
}

export { FanChartRenderer };
export default FanChart;
