import { config } from "./config";
import * as d3 from './d3'

/**
 * Initialize the chart.
 *
 * @private
 */
export function initChart() {
    let that = this;

    config.zoom = d3.zoom()
        .scaleExtent([0.5, 5.0])
        .on('zoom', doZoom);

    config.zoom.filter(function () {
        // Allow "wheel" event only while control key is pressed
        if (d3.event.type === 'wheel') {
            if (config.zoomLevel && d3.event.ctrlKey) {
                // Prevent zooming below lowest level
                if ((config.zoomLevel <= 0.5) && (d3.event.deltaY > 0)) {
                    d3.event.preventDefault();
                    return false;
                }

                // Prevent zooming above highest level
                if ((config.zoomLevel >= 5.0) && (d3.event.deltaY < 0)) {
                    d3.event.preventDefault();
                    return false;
                }
            }

            return d3.event.ctrlKey;
        }

        // Allow "touchmove" event only with two fingers
        if (!d3.event.button && (d3.event.type === 'touchmove')) {
            return d3.event.touches.length === 2;
        }

        return true;
    });

    // Parent container
    config.parent = d3
        .select('#fan_chart');

    // Add SVG element
    config.svg = config.parent
        .append('svg')
        .attr('version', '1.1')
        .attr('xmlns', 'http://www.w3.org/2000/svg')
        .attr('xmlns:xlink', 'http://www.w3.org/1999/xlink')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('text-rendering', 'geometricPrecision')
        .attr('text-anchor', 'middle')
        .on('contextmenu', function () {
            d3.event.preventDefault();
        })
        .on('wheel', function () {
            if (!d3.event.ctrlKey) {
                showTooltipOverlay(rso.options.labels.zoom, 300, function () {
                    hideTooltipOverlay(700, 800);
                });
            }
        })
        .on('touchend', function () {
            if (d3.event.touches.length < 2) {
                hideTooltipOverlay(0, 800);
            }
        })
        .on('touchmove', function () {
            if (d3.event.touches.length >= 2) {
                // Hide tooltip on more than 2 fingers
                hideTooltipOverlay();
            } else {
                // Show tooltip if less than 2 fingers are used
                showTooltipOverlay(rso.options.labels.move);
            }
        })
        .on('click', doStopPropagation, true);

    if (rso.options.rtl) {
        config.svg.classed('rtl', true);
    }

    if (rso.options.showColorGradients) {
        // Create the svg:defs element
        config.svgDefs = config.svg
            .append('defs');
    }

    // Add an overlay with tooltip
    config.overlay = config.parent
        .append('div')
        .attr('class', 'overlay')
        .style('opacity', 0);

    // Add rectangle element
    config.svg
        .append('rect')
        .attr('class', 'background')
        .attr('width', '100%')
        .attr('height', '100%');

    // Bind click event on reset button
    d3.select('#resetButton')
        .on('click', doReset);

    // Add group
    config.visual = config.svg
        .append('g');

    config.visual
        .append('g')
        .attr('class', 'personGroup');

    config.svg.call(config.zoom);
}

/**
 * Zoom chart.
 *
 * @private
 */
export function doZoom() {
    // Abort any action if only one finger is used on "touchmove" events
    if (d3.event.sourceEvent
        && (d3.event.sourceEvent.type === 'touchmove')
        && (d3.event.sourceEvent.touches.length < 2)
    ) {
        return;
    }

    config.zoomLevel = d3.event.transform.k;

    config.visual.attr(
        'transform',
        d3.event.transform
    );
}

/**
 * Stop any pending transition and hide overlay immediately.
 *
 * @param {string}   text     Text to display in overlay
 * @param {int}      duration Duration of transition in msec
 * @param {callback} callback Callback method to execute on end of transition
 *
 * @private
 */
export function showTooltipOverlay(text, duration, callback) {
    duration = duration || 0;

    config.overlay
        .select('p')
        .remove();

    config.overlay
        .append('p')
        .attr('class', 'tooltip')
        .text(text);

    config.overlay
        .transition()
        .duration(duration)
        .style('opacity', 1)
        .on('end', function() {
            if (callback) {
                callback();
            }
        });
}

/**
 * Stop any pending transition and hide overlay immediately.
 *
 * @param {int} delay    Delay in msec to wait before transition should start
 * @param {int} duration Duration of transition in msec
 *
 * @private
 */
export function hideTooltipOverlay(delay, duration) {
    delay    = delay    || 0;
    duration = duration || 0;

    config.overlay
        .transition()
        .delay(delay)
        .duration(duration)
        .style('opacity', 0);
}

/**
 * Prevent default click and stop propagation.
 *
 * @private
 */
export function doStopPropagation() {
    if (d3.event.defaultPrevented) {
        d3.event.stopPropagation();
    }
}

/**
 * Reset chart to initial zoom level and position.
 *
 * @private
 */
export function doReset() {
    config.svg
        .transition()
        .duration(750)
        .call(config.zoom.transform, d3.zoomIdentity);
}
