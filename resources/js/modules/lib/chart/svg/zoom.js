/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import * as d3 from "./../../d3";

/**
 * Minimum allowed zoom scale factor.
 */
const MIN_ZOOM = 0.1;

/**
 * Maximum allowed zoom scale factor.
 */
const MAX_ZOOM = 20.0;

/**
 * Configures a D3 zoom behavior for the fan chart's visual group. Zoom is
 * restricted to Ctrl+wheel and two-finger pinch gestures so normal scrolling
 * is not captured. The wheel delta override removes D3's default 10× amplification
 * for Ctrl+wheel, giving a consistent zoom speed regardless of modifier key.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Zoom {
    /**
     * @param {Selection} parent The D3 selection of the visual group that receives the zoom transform
     */
    constructor(parent) {
        this._zoom = null;
        this._parent = parent;

        this.init();
    }

    /**
     * Creates the D3 zoom behavior with scale limits, a custom wheel-delta
     * function, and a filter that restricts zoom to Ctrl+wheel and two-finger
     * touch, then attaches the transform listener to the parent group.
     *
     * @private
     */
    init() {
        // Setup zoom and pan
        this._zoom = d3.zoom();

        this._zoom
            .scaleExtent([MIN_ZOOM, MAX_ZOOM])
            .on("zoom", (event) => {
                this._parent.attr("transform", event.transform);
            });

        // Adjust the wheel delta (see defaultWheelDelta() in zoom.js, which adds
        // a 10-times offset if ctrlKey is pressed)
        this._zoom.wheelDelta((event) => {
            return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
        });

        // Add zoom filter.
        // scaleExtent([MIN_ZOOM, MAX_ZOOM]) enforces zoom limits internally.
        // D3's zoom behavior calls preventDefault on consumed wheel events,
        // so browser page zoom is suppressed when the filter returns true.
        this._zoom.filter((event) => {
            // Allow "wheel" event only while the control key is pressed
            if (event.type === "wheel") {
                return event.ctrlKey;
            }

            // Allow touch events only with two fingers
            if (!event.button && (event.type === "touchstart")) {
                return event.touches.length === 2;
            }

            return (!event.ctrlKey || (event.type === "wheel")) && !event.button;
        });
    }

    /**
     * Returns the configured d3-zoom behavior, ready to be passed to
     * selection.call() or zoom.transform().
     *
     * @return {d3.ZoomBehavior}
     */
    get() {
        return this._zoom;
    }
}
