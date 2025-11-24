/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Handles exporting charts.
 */
export default class ExportService
{
    /**
     * @param {string[]} cssFiles
     */
    constructor(cssFiles = [])
    {
        this._cssFiles = cssFiles;
    }

    /**
     * Exports the given SVG instance.
     *
     * @param {string} type
     * @param {Svg} svg
     */
    export(type, svg)
    {
        if (!svg) {
            return;
        }

        if (type === "png") {
            svg
                .export(type)
                .svgToImage(svg, "fan-chart.png");

            return;
        }

        svg
            .export(type)
            .svgToImage(
                svg,
                this._cssFiles,
                "webtrees-fan-chart-container",
                "fan-chart.svg"
            );
    }
}
