/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * Manages a semi-transparent <div class="overlay"> element placed over the chart
 * to display instructional hints (e.g. "use Ctrl+scroll to zoom"). The overlay
 * fades in when shown and fades out after a configurable delay.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Overlay {
    /**
     * @param {Selection} parent The D3 selection of the container element
     */
    constructor(parent) {
        // Create the tooltip overlay container
        this._element = parent
            .append("div")
            .attr("class", "overlay")
            .style("opacity", 1e-6);
    }

    /**
     * Replaces the overlay text and fades it in over the given duration.
     * Invokes callback (if provided) once the fade-in transition ends.
     *
     * @param {string}        text     The hint message to display
     * @param {number}        duration Fade-in duration in milliseconds (0 = immediate)
     * @param {Function|null} callback Called at the end of the fade-in transition
     */
    show(text, duration = 0, callback = null) {
        // Remove any previously added <p> element
        this._element
            .select("p")
            .remove();

        this._element
            .append("p")
            .attr("class", "tooltip")
            .text(text);

        this._element
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
     * Fades the overlay out after the given delay.
     *
     * @param {number} delay    Milliseconds to wait before starting the fade-out
     * @param {number} duration Fade-out duration in milliseconds (0 = immediate)
     */
    hide(delay = 0, duration = 0) {
        this._element
            .transition()
            .delay(delay)
            .duration(duration)
            .style("opacity", 1e-6);
    }

    /**
     * Returns the overlay <div> D3 selection.
     *
     * @return {Selection}
     */
    get() {
        return this._element;
    }
}
