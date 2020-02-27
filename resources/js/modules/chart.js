/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "./d3";
import Arc from "./arc";
import Config from "./config";
import Hierarchy from "./hierarchy";
import Overlay from "./chart/overlay";
import Zoom from "./chart/zoom";

const MIN_HEIGHT  = 500;
const MIN_PADDING = 10;   // Minimum padding around view box

/**
 * This class handles the overall chart creation.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Chart
{
    /**
     * Constructor.
     *
     * @param {String}  selector
     * @param {Options} options
     */
    constructor(selector, options)
    {
        this._options = options;
        this._config  = new Config();
        this._overlay = null;
        this._zoom    = null;

        // Parent container
        this._config.parent = d3.select(selector);

        this.createSvg();
        this.init();
    }

    /**
     * @private
     */
    createSvg()
    {
        // Add SVG element
        this._config.svg = this._config.parent
            .append("svg")
            .attr("version", "1.1")
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("text-rendering", "geometricPrecision")
            .attr("text-anchor", "middle")
            .on("contextmenu", () => d3.event.preventDefault())
            .on("wheel", () => {
                if (!d3.event.ctrlKey) {
                    this.overlay.show(
                        this._options.labels.zoom,
                        300,
                        () => {
                            this.overlay.hide(700, 800);
                        }
                    );
                }
            })
            .on("touchend", () => {
                if (d3.event.touches.length < 2) {
                    this.overlay.hide(0, 800);
                }
            })
            .on("touchmove", () => {
                if (d3.event.touches.length >= 2) {
                    // Hide tooltip on more than 2 fingers
                    this.overlay.hide();
                } else {
                    // Show tooltip if less than 2 fingers are used
                    this.overlay.show(this._options.labels.move);
                }
            })
            .on("click", () => this.doStopPropagation(), true);
    }

    /**
     * @private
     */
    init()
    {
        if (this._options.rtl) {
            this._config.svg.classed("rtl", true);
        }

        // Create the svg:defs element
        this._config.svgDefs = this._config.svg
            .append("defs");

        this.overlay = new Overlay(this._config);

        // Bind click event on reset button
        d3.select("#resetButton")
            .on("click", () => this.doReset());

        // Add group
        this._config.visual = this._config.svg
            .append("g");

        this._config.visual
            .append("g")
            .attr("class", "personGroup");

        this._zoom = new Zoom(this._config);
        this._config.svg.call(this._zoom.get());

        // Create hierarchical data
        let hierarchy = new Hierarchy(this._options.data, this._options);
        let arc       = new Arc(this._config, this._options, hierarchy);

        this.updateViewBox();
    }

    /**
     * Update/Calculate the viewBox attribute of the SVG element.
     *
     * @private
     */
    updateViewBox()
    {
        // Get bounding boxes
        let svgBoundingBox    = this._config.visual.node().getBBox();
        let clientBoundingBox = this._config.parent.node().getBoundingClientRect();

        // View box should have at least the same width/height as the parent element
        let viewBoxWidth  = Math.max(clientBoundingBox.width, svgBoundingBox.width);
        let viewBoxHeight = Math.max(clientBoundingBox.height, svgBoundingBox.height, MIN_HEIGHT);

        // Calculate offset to center chart inside svg
        let offsetX = (viewBoxWidth - svgBoundingBox.width) / 2;
        let offsetY = (viewBoxHeight - svgBoundingBox.height) / 2;

        // Adjust view box dimensions by padding and offset
        let viewBoxLeft = Math.ceil(svgBoundingBox.x - offsetX - MIN_PADDING);
        let viewBoxTop  = Math.ceil(svgBoundingBox.y - offsetY - MIN_PADDING);

        // Final width/height of view box
        viewBoxWidth  = Math.ceil(viewBoxWidth + (MIN_PADDING * 2));
        viewBoxHeight = Math.ceil(viewBoxHeight + (MIN_PADDING * 2));

        // Set view box attribute
        this._config.svg
            .attr("viewBox", [
                viewBoxLeft,
                viewBoxTop,
                viewBoxWidth,
                viewBoxHeight
            ]);

        // Add rectangle element
        // this._config.svg
        //     .insert("rect", ":first-child")
        //     .attr("class", "background")
        //     .attr("width", "100%")
        //     .attr("height", "100%");
        //
        // // Adjust rectangle position
        // this._config.svg
        //     .select("rect")
        //     .attr("x", viewBoxLeft)
        //     .attr("y", viewBoxTop);
    }

    /**
     * Returns the overlay container.
     *
     * @return {Overlay}
     */
    get overlay()
    {
        return this._overlay;
    }

    /**
     * Sets parent overlay container.
     *
     * @param {Overlay} value The overlay container
     */
    set overlay(value)
    {
        this._overlay = value;
    }

    /**
     * Prevent default click and stop propagation.
     *
     * @private
     */
    doStopPropagation()
    {
        if (d3.event.defaultPrevented) {
            d3.event.stopPropagation();
        }
    }

    /**
     * Reset chart to initial zoom level and position.
     *
     * @private
     */
    doReset()
    {
        this._config.svg
            .transition()
            .duration(750)
            .call(this._zoom.get().transform, d3.zoomIdentity);
    }
}
