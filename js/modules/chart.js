/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import { config } from "./config";
import * as d3 from "./d3";
import initZoom from "./zoom";
import updateViewBox from "./view-box";
import { Hierarchy } from "./hierarchy";
import {Arc} from "./arc";

/**
 * Initialize the chart.
 *
 * @public
 */
export function initChart(options)
{
    // Parent container
    config.parent = d3
        .select("#fan_chart");

    // Add SVG element
    config.svg = config.parent
        .append("svg")
        .attr("version", "1.1")
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .attr("xmlns:xlink", "http://www.w3.org/1999/xlink")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("text-rendering", "geometricPrecision")
        .attr("text-anchor", "middle")
        .on("contextmenu", function () {
            d3.event.preventDefault();
        })
        .on("wheel", function () {
            if (!d3.event.ctrlKey) {
                showTooltipOverlay(
                    options.labels.zoom,
                    300,
                    function () {
                        hideTooltipOverlay(700, 800);
                    }
                );
            }
        })
        .on("touchend", function () {
            if (d3.event.touches.length < 2) {
                hideTooltipOverlay(0, 800);
            }
        })
        .on("touchmove", function () {
            if (d3.event.touches.length >= 2) {
                // Hide tooltip on more than 2 fingers
                hideTooltipOverlay();
            } else {
                // Show tooltip if less than 2 fingers are used
                showTooltipOverlay(options.labels.move);
            }
        })
        .on("click", doStopPropagation, true);

    if (options.rtl) {
        config.svg.classed("rtl", true);
    }

    if (options.showColorGradients) {
        // Create the svg:defs element
        config.svgDefs = config.svg
            .append("defs");
    }

    // Add an overlay with tooltip
    config.overlay = config.parent
        .append("div")
        .attr("class", "overlay")
        .style("opacity", 0);

    // Add rectangle element
    config.svg
        .append("rect")
        .attr("class", "background")
        .attr("width", "100%")
        .attr("height", "100%");

    // Bind click event on reset button
    d3.select("#resetButton")
        .on("click", doReset);

    // Add group
    config.visual = config.svg
        .append("g");

    config.visual
        .append("g")
        .attr("class", "personGroup");

    config.zoom = initZoom(config);
    config.svg.call(config.zoom);

    // Create hierarchical data
    let hierarchy = new Hierarchy(options);
    hierarchy.init(options.data);

    let arc = new Arc(config, options, hierarchy);
    arc.createArcElements();

    updateViewBox(config);
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
function showTooltipOverlay(text, duration = 0, callback = null)
{
    config.overlay
        .select("p")
        .remove();

    config.overlay
        .append("p")
        .attr("class", "tooltip")
        .text(text);

    config.overlay
        .transition()
        .duration(duration)
        .style("opacity", 1)
        .on("end", function() {
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
function hideTooltipOverlay(delay = 0, duration = 0)
{
    config.overlay
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
function doStopPropagation()
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
function doReset()
{
    config.svg
        .transition()
        .duration(750)
        .call(config.zoom.transform, d3.zoomIdentity);
}
