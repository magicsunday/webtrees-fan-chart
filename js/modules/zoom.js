/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import { config } from "./config";
import * as d3 from "./d3";

/**
 * Initialize the zoom and returns a new D3 zoom behavior.
 *
 * @return {Object} D3 zoom behavior
 *
 * @public
 */
export default function initZoom()
{
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 5.0;

    // Setup zoom and pan
    config.zoom = d3.zoom()
        .scaleExtent([MIN_ZOOM, MAX_ZOOM])
        .on("zoom", () => {
            // Abort any action if only one finger is used on "touchmove" events
            if (d3.event.sourceEvent
                && (d3.event.sourceEvent.type === "touchmove")
                && (d3.event.sourceEvent.touches.length < 2)
            ) {
                return;
            }

            config.zoomLevel = d3.event.transform.k;

            config.visual
                .attr("transform", d3.event.transform);
        });

    // Filter zoom
    config.zoom.filter(() => {
        // Allow "wheel" event only while control key is pressed
        if (d3.event.type === "wheel") {
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
        if (!d3.event.button && (d3.event.type === "touchmove")) {
            return d3.event.touches.length === 2;
        }

        return true;
    });

    return config.zoom;
}
