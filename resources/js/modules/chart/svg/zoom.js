/**
 * See LICENSE.md file for further details.
 */

import * as d3 from "./../../d3";

/**
 * Constants
 *
 * @type {number}
 */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

/**
 * This class handles the zoom.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Zoom
{
    /**
     * Constructor.
     *
     * @param {Selection} parent The selected D3 parent element container
     */
    constructor(parent)
    {
        this._zoom   = null;
        this._parent = parent;

        this.init();
    }

    /**
     * Initializes a new D3 zoom behavior.
     *
     * @private
     */
    init()
    {
        let zoomLevel = null;

        // Setup zoom and pan
        this._zoom = d3.zoom()
            .scaleExtent([MIN_ZOOM, MAX_ZOOM])
            .on("zoom", (event) => {
                // Abort any action if only one finger is used on "touchmove" events
                if (event.sourceEvent
                    && (event.sourceEvent.type === "touchmove")
                    && (event.sourceEvent.touches.length < 2)
                ) {
                    return;
                }

                zoomLevel = event.transform.k;

                this._parent.attr("transform", event.transform);
            });

        // Add zoom filter
        this._zoom.filter((event) => {
            // Allow "wheel" event only while control key is pressed
            if (event.type === "wheel") {
                if (zoomLevel && event.ctrlKey) {
                    // Prevent zooming below lowest level
                    if ((zoomLevel <= MIN_ZOOM) && (event.deltaY > 0)) {
                        event.preventDefault();
                        return false;
                    }

                    // Prevent zooming above highest level
                    if ((zoomLevel >= MAX_ZOOM) && (event.deltaY < 0)) {
                        event.preventDefault();
                        return false;
                    }
                }

                return event.ctrlKey;
            }

            // Allow "touchmove" event only with two fingers
            if (!event.button && (event.type === "touchmove")) {
                return event.touches.length === 2;
            }

            return true;
        });
    }

    /**
     * Returns the internal d3 zoom behaviour.
     *
     * @return {zoom}
     */
    get()
    {
        return this._zoom;
    }
}
