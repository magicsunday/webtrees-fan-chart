/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "../d3";

/**
 * Constants
 *
 * @type {Number}
 */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5.0;

/**
 * This class handles the zoom.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
export default class Zoom
{
    /**
     * Constructor.
     *
     * @param {Config} config
     */
    constructor(config)
    {
        this._zoom   = null;
        this._config = config;

        this.init();
    }

    /**
     * Initialize the zoom and returns a new D3 zoom behavior.
     *
     * @param {Config} config The configuration
     *
     * @return {Object} D3 zoom behavior
     *
     * @private
     */
    init()
    {
        let zoomLevel = null;

        // Setup zoom and pan
        this._zoom = d3.zoom()
            .scaleExtent([MIN_ZOOM, MAX_ZOOM])
            .on("zoom", () => {
                // Abort any action if only one finger is used on "touchmove" events
                if (d3.event.sourceEvent
                    && (d3.event.sourceEvent.type === "touchmove")
                    && (d3.event.sourceEvent.touches.length < 2)
                ) {
                    return;
                }

                zoomLevel = d3.event.transform.k;

                this._config.visual
                    .attr("transform", d3.event.transform);
            });

        // Add zoom filter
        this._zoom.filter(() => {
            // Allow "wheel" event only while control key is pressed
            if (d3.event.type === "wheel") {
                if (zoomLevel && d3.event.ctrlKey) {
                    // Prevent zooming below lowest level
                    if ((zoomLevel <= MIN_ZOOM) && (d3.event.deltaY > 0)) {
                        d3.event.preventDefault();
                        return false;
                    }

                    // Prevent zooming above highest level
                    if ((zoomLevel >= MAX_ZOOM) && (d3.event.deltaY < 0)) {
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
    }

    /**
     * Returns the internal d3 zoom behaviour.
     *
     * @returns {Object}
     *
     * @public
     */
    get()
    {
        return this._zoom;
    }
}
