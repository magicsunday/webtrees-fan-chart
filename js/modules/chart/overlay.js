/**
 * See LICENSE.md file for further details.
 */

/**
 * This class handles the tooltip overlay.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
export default class Overlay
{
    /**
     * Constructor.
     *
     * @param {Config} config
     */
    constructor(config)
    {
        // Create the tooltip overlay container
        this._overlay = config.parent
            .append("div")
            .attr("class", "overlay")
            .style("opacity", 1e-6);
    }

    /**
     * Stop any pending transition and hide overlay immediately.
     *
     * @param {String}   text     Text to display in overlay
     * @param {Number}   duration Duration of transition in msec
     * @param {Function} callback Callback method to execute on end of transition
     *
     * @public
     */
    show(text, duration = 0, callback = null)
    {
        this._overlay
            .select("p")
            .remove();

        this._overlay
            .append("p")
            .attr("class", "tooltip")
            .text(text);

        this._overlay
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
     * @public
     */
    hide(delay = 0, duration = 0)
    {
        this._overlay
            .transition()
            .delay(delay)
            .duration(duration)
            .style("opacity", 1e-6);
    }
}
