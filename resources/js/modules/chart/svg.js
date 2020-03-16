/**
 * See LICENSE.md file for further details.
 */

import * as d3 from "./../d3";
import Configuration from "./../configuration";
import Defs from "./svg/defs";
import Zoom from "./svg/zoom";
import Filter from "./svg/filter";

/**
 * SVG class
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Svg
{
    /**
     * Constructor.
     *
     * @param {Selection}     parent        The selected D3 parent element container
     * @param {Configuration} configuration The application configuration
     */
    constructor(parent, configuration)
    {
        // Create the <svg> element
        this._element       = parent.append("svg");
        this._defs          = new Defs(this._element);

        this._visual        = null;
        this._zoom          = null;
        this._configuration = configuration;

        this.init();
    }

    /**
     * Initialize the <svg> element.
     *
     * @private
     */
    init()
    {
        // Add SVG element
        this._element
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("text-rendering", "geometricPrecision")
            .attr("text-anchor", "middle");

        new Filter(this._defs.get());
    }

    /**
     * Initialiaze the <svg> element events.
     *
     * @param {Overlay} overlay
     */
    initEvents(overlay)
    {
        this._element
            .on("contextmenu", () => d3.event.preventDefault())
            .on("wheel", () => {
                if (!d3.event.ctrlKey) {
                    overlay.show(
                        this._configuration.labels.zoom,
                        300,
                        () => {
                            overlay.hide(700, 800);
                        }
                    );
                }
            })
            .on("touchend", () => {
                if (d3.event.touches.length < 2) {
                    overlay.hide(0, 800);
                }
            })
            .on("touchmove", () => {
                if (d3.event.touches.length >= 2) {
                    // Hide tooltip on more than 2 fingers
                    overlay.hide();
                } else {
                    // Show tooltip if less than 2 fingers are used
                    overlay.show(this._configuration.labels.move);
                }
            })
            .on("click", () => this.doStopPropagation(), true);

        if (this._configuration.rtl) {
            this._element.classed("rtl", true);
        }

        // Add group
        this._visual = this._element.append("g");

        this._visual
            .append("g")
            .attr("class", "personGroup");

        this._zoom = new Zoom(this._visual);
        this._element.call(this._zoom.get());
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
     * Returns the SVG definition instance.
     *
     * @return {Defs}
     */
    get defs()
    {
        return this._defs;
    }

    /**
     * Returns the SVG definition instance.
     *
     * @return {Zoom}
     */
    get zoom()
    {
        return this._zoom;
    }

    /**
     *
     *
     * @return {Selection}
     */
    get visual()
    {
        return this._visual;
    }

    /**
     * Returns the internal element.
     *
     * @return {Selection}
     */
    get()
    {
        return this._element;
    }
}
