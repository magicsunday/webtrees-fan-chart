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
import Geometry from "./svg/geometry";
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

        // In fullscreen mode, use the full available height
        // (buttonbar is now overlayed, so no offset needed)
        if (document.fullscreenElement) {
            // Set width/height attributes
            this.svg
                .attr("width", clientBoundingBox.width)
                .attr("height", clientBoundingBox.height);
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

        // Marriage arc layer (separate from persons so hover does not affect them)
        if (this._configuration.showParentMarriageDates) {
            this.drawMarriageArcs();
        }

        this.updateViewBox();
        this.bindClickEventListener();
    }

    /**
     * Draws marriage arcs in the gap between generations. Each arc spans the
     * angular range of a person who has parents shown in the chart. The arc
     * is always drawn (for visual consistency), and the marriage date text
     * is added when available.
     *
     * @private
     */
    drawMarriageArcs()
    {
        let geometry = new Geometry(this._configuration);
        let marriageGroup = this._svg.visual
            .append("g")
            .attr("class", "marriageGroup");

        // All nodes that have children (= parents shown) and are within display range
        const nodes = this._hierarchy.nodes.filter(
            datum => datum.children && datum.depth < 5
        );

        const arcPadding = 2;

        nodes.forEach(datum => {
            const innerR = geometry.outerRadius(datum.depth) + arcPadding;
            const outerR = geometry.innerRadius(datum.depth + 1) - arcPadding;

            if (outerR <= innerR) {
                return;
            }

            // For the center circle use calcAngle to respect the fan degree
            let startAngle = (datum.depth < 1)
                ? geometry.calcAngle(datum.x0)
                : geometry.startAngle(datum.depth, datum.x0);

            let endAngle = (datum.depth < 1)
                ? geometry.calcAngle(datum.x1)
                : geometry.endAngle(datum.depth, datum.x1);

            // Visual arc
            let arcGenerator = d3.arc()
                .startAngle(startAngle)
                .endAngle(endAngle)
                .innerRadius(innerR)
                .outerRadius(outerR)
                .padAngle(0)
                .padRadius(0)
                .cornerRadius(this._configuration.cornerRadius);

            let arcGroup = marriageGroup
                .append("g")
                .attr("class", "marriage-arc");

            arcGroup
                .append("path")
                .attr("d", arcGenerator);

            // Marriage date text (only if date is available)
            if (datum.data.data.marriageDateOfParents) {
                const midRadius = (innerR + outerR) / 2;

                // Text path at the midpoint of the gap
                let textPathGenerator = d3.arc()
                    .startAngle(startAngle)
                    .endAngle(endAngle)
                    .innerRadius(midRadius)
                    .outerRadius(midRadius);

                let pathId = "marriage-path-" + datum.id;

                this._svg.defs
                    .append("path")
                    .attr("id", pathId)
                    .attr("d", textPathGenerator);

                // Use the same font size calculation as person labels
                let fontSize = this._configuration.fontSize;

                if (datum.depth >= (this._configuration.numberOfInnerCircles + 1)) {
                    fontSize += 1;
                }

                fontSize = (fontSize - datum.depth) * this._configuration.fontScale / 100.0;

                arcGroup
                    .append("text")
                    .attr("text-anchor", "middle")
                    .attr("dominant-baseline", "central")
                    .style("font-size", fontSize + "px")
                    .append("textPath")
                    .attr("href", "#" + pathId)
                    .attr("startOffset", "25%")
                    .attr("class", "date")
                    .append("tspan")
                    .text("\u26AD " + datum.data.data.marriageDateOfParents);
            }
        });
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
