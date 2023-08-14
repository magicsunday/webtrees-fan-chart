/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../lib/d3";
import Hierarchy from "./hierarchy";
import Overlay from "../lib/chart/overlay";
import Svg from "./svg";
import Person from "./svg/person";
import Gradient from "./gradient";
import Update from "./update";

const MIN_HEIGHT  = 500;
const MIN_PADDING = 1;   // Minimum padding around view box in "rem"

/**
 * This class handles the overall chart creation.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Chart
{
    /**
     * Constructor.
     *
     * @param {Selection}     parent        The selected D3 parent element container
     * @param {Configuration} configuration The application configuration
     */
    constructor(parent, configuration)
    {
        this._configuration = configuration;
        this._parent        = parent;
        this._hierarchy     = new Hierarchy(this._configuration);
        this._data          = {};
    }

    /**
     * Returns the SVG instance.
     *
     * @returns {Svg}
     */
    get svg()
    {
        return this._svg;
    }

    /**
     * Returns the parent container.
     *
     * @returns {Selection}
     */
    get parent()
    {
        return this._parent;
    }

    /**
     * Returns the chart data.
     *
     * @returns {Object}
     */
    get data()
    {
        return this._data;
    }

    /**
     * Sets the chart data.
     *
     * @param {Object} value The chart data
     */
    set data(value)
    {
        this._data = value;

        // Create the hierarchical data structure
        this._hierarchy.init(this._data);
    }

    /**
     * Convert relative root element's font-size into pixel size.
     *
     * @param {number} rem The relative size
     *
     * @returns {number}
     */
    convertRemToPixels(rem)
    {
        return rem * parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    }

    /**
     * Update/Calculate the viewBox attribute of the SVG element.
     */
    updateViewBox()
    {
        // Set width/height attributes
        this.svg
            .attr("width", "100%")
            .attr("height", "100%");

        const padding = this.convertRemToPixels(MIN_PADDING);

        // Get bounding boxes
        let svgBoundingBox    = this.svg.visual.node().getBBox();
        let clientBoundingBox = this.parent.node().getBoundingClientRect();

        // View box should have at least the same width/height as the parent element
        let viewBoxWidth  = Math.max(clientBoundingBox.width, svgBoundingBox.width);
        let viewBoxHeight = Math.max(clientBoundingBox.height, svgBoundingBox.height);

        // View box should have at least the same width/height as the parent element
        if (document.fullscreenElement) {
            viewBoxWidth = Math.max(svgBoundingBox.width, Math.min(clientBoundingBox.width, svgBoundingBox.width));
            viewBoxHeight = Math.max(svgBoundingBox.height, Math.min(clientBoundingBox.height, svgBoundingBox.height));
        }

        // Calculate offset to center chart inside svg
        let offsetX = (viewBoxWidth - svgBoundingBox.width) >> 1;
        let offsetY = (viewBoxHeight - svgBoundingBox.height) >> 1;

        // Adjust view box dimensions by padding and offset
        let viewBoxLeft = Math.ceil(svgBoundingBox.x - offsetX - padding);
        let viewBoxTop  = Math.ceil(svgBoundingBox.y - offsetY - padding);

        // Add additional padding in the fullscreen view coming from the button bar
        if (document.fullscreenElement) {
            const buttonBarHeight = 32;
            const buttonBarOffset = (buttonBarHeight + this.convertRemToPixels(2));

            viewBoxTop += buttonBarHeight - (padding << 1);

            // Set width/height attributes
            this.svg
                .attr("width", clientBoundingBox.width)
                .attr("height", clientBoundingBox.height - buttonBarOffset);
        }

        // Final width/height of view box
        viewBoxWidth  = Math.ceil(viewBoxWidth + (padding << 1));
        viewBoxHeight = Math.ceil(viewBoxHeight + (padding << 1));

        // Set view box attribute
        this.svg
            .attr(
                "viewBox",
                [
                    viewBoxLeft,
                    viewBoxTop,
                    viewBoxWidth,
                    viewBoxHeight
                ]
            );
    }

    /**
     * Resets the chart to initial zoom level and position.
     */
    center()
    {
        this.svg
            .transition()
            .duration(750)
            .call(this.svg.zoom.get().transform, d3.zoomIdentity);
    }

    /**
     * This method draws the chart.
     */
    draw()
    {
        // Remove previously created content
        this._parent.html("");

        // Create the <svg> element
        this._svg = new Svg(this._parent, this._configuration);

        // Overlay must be placed after the <svg> element
        this._overlay = new Overlay(this._parent);

        // Init the <svg> events
        this._svg.initEvents(this._overlay);

        let personGroup = this._svg.select("g.personGroup");
        let gradient = new Gradient(this._svg, this._configuration);
        let that = this;

         personGroup
            .selectAll("g.person")
            .data(this._hierarchy.nodes, (datum) => datum.id)
            .enter()
            .filter(
                (datum) => {
                    // Filter out all empty records, but only if we hide empty segments
                    // otherwise the arcs won't be drawn correctly
                    return (datum.data.data.xref !== "")
                         || !this._configuration.hideEmptySegments
                }
            )
            .append("g")
            .attr("class", "person")
            .attr("id", (datum) => "person-" + datum.id);

        // Create a new selection in order to leave the previous enter() selection
        personGroup
            .selectAll("g.person")
            .each(function (d) {
                let person = d3.select(this);

                if (that._configuration.showColorGradients) {
                    gradient.init(d);
                }

                new Person(that._svg, that._configuration, person, d);
            });

        this.updateViewBox();
        this.bindClickEventListener();
    }

    /**
     * This method binds a "click" event listeners to a "person" element.
     */
    bindClickEventListener()
    {
        let persons = this._svg
            .select("g.personGroup")
            .selectAll("g.person")
            .filter((datum) => datum.data.data.xref !== "")
            .classed("available", true);

        // Trigger method on click
        persons.on("click", this.personClick.bind(this));
    }

    /**
     * Method triggers either the "update" or "individual" method on the click on an person.
     *
     * @param {Event}  event The current event
     * @param {Object} datum The D3 data object
     *
     * @private
     */
    personClick(event, datum)
    {
        // Trigger either "update" or "redirectToIndividual" method on click depending on person in chart
        (datum.depth === 0) ? this.redirectToIndividual(datum.data.data.url) : this.update(datum.data.data.updateUrl);
    }

    /**
     * Redirects to the individual page.
     *
     * @param {string} url The individual URL
     *
     * @private
     */
    redirectToIndividual(url)
    {
        window.open(url, "_blank");
    }

    /**
     * Updates the chart with the data of the selected individual.
     *
     * @param {string} url The update URL
     */
    update(url)
    {
        let update = new Update(this._svg, this._configuration, this._hierarchy);

        update.update(url, () => this.bindClickEventListener());
    }
}
