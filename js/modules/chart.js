/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "./d3";
import initZoom from "./zoom";
import updateViewBox from "./view-box";
import {Hierarchy} from "./hierarchy";
import {Arc} from "./arc";

export default class Chart
{
    constructor(selector, options, config)
    {
        this.options = options;
        this.config  = config;

        // Parent container
        this.config.parent = d3.select(selector);

        this.createSvg()
        this.init();
    }

    /**
     * @private
     */
    createSvg()
    {
        // Add SVG element
        this.config.svg = this.config.parent
            .append("svg")
            .attr("version", "1.1")
            .attr("xmlns", "http://www.w3.org/2000/svg")
            .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("text-rendering", "geometricPrecision")
            .attr("text-anchor", "middle")
            .on("contextmenu", () => {
                d3.event.preventDefault();
            })
            .on("wheel", () => {
                if (!d3.event.ctrlKey) {
                    this.showTooltipOverlay(
                        this.options.labels.zoom,
                        300,
                        () => {
                            this.hideTooltipOverlay(700, 800);
                        }
                    );
                }
            })
            .on("touchend", () => {
                if (d3.event.touches.length < 2) {
                    this.hideTooltipOverlay(0, 800);
                }
            })
            .on("touchmove", () => {
                if (d3.event.touches.length >= 2) {
                    // Hide tooltip on more than 2 fingers
                    this.hideTooltipOverlay();
                } else {
                    // Show tooltip if less than 2 fingers are used
                    this.showTooltipOverlay(this.options.labels.move);
                }
            })
            .on("click", () => this.doStopPropagation(), true);
    }

    /**
     * @private
     */
    init()
    {
        if (this.options.rtl) {
            this.config.svg.classed("rtl", true);
        }

        if (this.options.showColorGradients) {
            // Create the svg:defs element
            this.config.svgDefs = this.config.svg
                .append("defs");
        }

        // Add an overlay with tooltip
        this.config.overlay = this.config.parent
            .append("div")
            .attr("class", "overlay")
            .style("opacity", 0);

        // Add rectangle element
        this.config.svg
            .append("rect")
            .attr("class", "background")
            .attr("width", "100%")
            .attr("height", "100%");

        // Bind click event on reset button
        d3.select("#resetButton")
            .on("click", () => this.doReset());

        // Add group
        this.config.visual = this.config.svg
            .append("g");

        this.config.visual
            .append("g")
            .attr("class", "personGroup");

        this.config.zoom = initZoom(this.config);
        this.config.svg.call(this.config.zoom);

        // Create hierarchical data
        let hierarchy = new Hierarchy(this.options);
        hierarchy.init(this.options.data);

        let arc = new Arc(this.config, this.options, hierarchy);
        arc.createArcElements();

        updateViewBox(this.config);
    }

    /**
     * Stop any pending transition and hide overlay immediately.
     *
     * @param {String}   text     Text to display in overlay
     * @param {Number}   duration Duration of transition in msec
     * @param {Function} callback Callback method to execute on end of transition
     *
     * @private
     */
    showTooltipOverlay(text, duration = 0, callback = null)
    {
        this.config.overlay
            .select("p")
            .remove();

        this.config.overlay
            .append("p")
            .attr("class", "tooltip")
            .text(text);

        this.config.overlay
            .transition()
            .duration(duration)
            .style("opacity", 1)
            .on("end", () => {
                if (typeof callback === "function") {
                    callback();
                }
            });
    }

    /**
     * Stop any pending transition and hide overlay immediately.
     *
     * @param {Number} delay    Delay in milliseconds to wait before transition should start
     * @param {Number} duration Duration of transition in milliseconds
     *
     * @private
     */
    hideTooltipOverlay(delay = 0, duration = 0)
    {
        this.config.overlay
            .transition()
            .delay(delay)
            .duration(duration)
            .style("opacity", 0);
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
        this.config.svg
            .transition()
            .duration(750)
            .call(this.config.zoom.transform, d3.zoomIdentity);
    }
}
