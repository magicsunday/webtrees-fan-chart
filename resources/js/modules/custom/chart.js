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
import Marriage from "./svg/marriage";
import Geometry from "./svg/geometry";
import FamilyColor from "./svg/family-color";
import Update from "./update";

const MIN_PADDING = 1; // Minimum padding around view box in "rem"

/**
 * Orchestrates the full fan chart lifecycle: builds the SVG, populates person
 * and marriage arc groups from hierarchical data, draws separator lines between
 * family branches, and delegates AJAX-driven updates with animated transitions.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Chart {
    /**
     * @param {Selection}     parent        The selected D3 parent element container
     * @param {Configuration} configuration The application configuration
     */
    constructor(parent, configuration) {
        this._configuration = configuration;
        this._parent = parent;
        this._hierarchy = new Hierarchy(this._configuration);
        this._data = {};
    }

    /**
     * @return {Svg}
     */
    get svg() {
        return this._svg;
    }

    /**
     * @return {Selection}
     */
    get parent() {
        return this._parent;
    }

    /**
     * @return {Object}
     */
    get data() {
        return this._data;
    }

    /**
     * Assigns new chart data and rebuilds the D3 hierarchy from it.
     *
     * @param {Object} value The raw JSON data object from the server
     */
    set data(value) {
        this._data = value;

        // Create the hierarchical data structure
        this._hierarchy.init(this._data);
    }

    /**
     * Converts a rem value to pixels using the document root font size.
     *
     * @param {number} rem The value in rem units
     *
     * @return {number}
     *
     * @private
     */
    convertRemToPixels(rem) {
        return rem * parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    }

    /**
     * Recalculates and sets the SVG viewBox so the chart fills its container
     * with a minimum 1 rem padding on every side. In fullscreen mode the SVG
     * dimensions are set to the full client area.
     *
     * @private
     */
    updateViewBox() {
        // Set width/height attributes
        this.svg
            .attr("width", "100%")
            .attr("height", "100%");

        const padding = this.convertRemToPixels(MIN_PADDING);

        // Get bounding boxes
        const svgBoundingBox = this.svg.visual.node().getBBox();
        const clientBoundingBox = this.parent.node().getBoundingClientRect();

        // View box should have at least the same width/height as the parent element
        let viewBoxWidth = Math.max(clientBoundingBox.width, svgBoundingBox.width);
        let viewBoxHeight = Math.max(clientBoundingBox.height, svgBoundingBox.height);

        // Calculate offset to center chart inside svg
        const offsetX = (viewBoxWidth - svgBoundingBox.width) >> 1;
        const offsetY = (viewBoxHeight - svgBoundingBox.height) >> 1;

        // Adjust view box dimensions by padding and offset
        const viewBoxLeft = Math.ceil(svgBoundingBox.x - offsetX - padding);
        const viewBoxTop = Math.ceil(svgBoundingBox.y - offsetY - padding);

        // In fullscreen mode, use the full available height
        // (buttonbar is now overlayed, so no offset needed)
        if (document.fullscreenElement) {
            // Set width/height attributes
            this.svg
                .attr("width", clientBoundingBox.width)
                .attr("height", clientBoundingBox.height);
        }

        // Final width/height of view box
        viewBoxWidth = Math.ceil(viewBoxWidth + (padding << 1));
        viewBoxHeight = Math.ceil(viewBoxHeight + (padding << 1));

        // Set view box attribute
        this.svg
            .attr(
                "viewBox",
                [
                    viewBoxLeft,
                    viewBoxTop,
                    viewBoxWidth,
                    viewBoxHeight,
                ],
            );
    }

    /**
     * Animates the chart back to its initial zoom level and pan position (identity transform).
     */
    center() {
        this.svg
            .transition()
            .duration(750)
            .call(this.svg.zoom.get().transform, d3.zoomIdentity);
    }

    /**
     * Performs the full initial render: creates the SVG and overlay, draws all
     * person arcs, marriage arcs, and family separator lines, then binds click
     * event listeners.
     */
    draw() {
        // Remove previously created content
        this._parent.html("");

        // Create the <svg> element
        this._svg = new Svg(this._parent, this._configuration);

        // Overlay must be placed after the <svg> element
        this._overlay = new Overlay(this._parent);

        // Init the <svg> events
        this._svg.initEvents(this._overlay);

        const personGroup = this._svg.select("g.personGroup");
        const familyColor = new FamilyColor(this._configuration);
        const that = this;

        personGroup
            .selectAll("g.person")
            .data(this._hierarchy.nodes, (datum) => datum.id)
            .enter()
            .filter(
                (datum) => {
                    // Filter out all empty records, but only if we hide empty segments
                    // otherwise the arcs won't be drawn correctly
                    return (datum.data.data.xref !== "")
                         || !this._configuration.hideEmptySegments;
                },
            )
            .append("g")
            .attr("class", "person")
            .attr("id", (datum) => "person-" + datum.id);

        // Create a new selection in order to leave the previous enter() selection
        personGroup
            .selectAll("g.person")
            .each(function (datum) {
                const person = d3.select(this);

                if (that._configuration.showFamilyColors) {
                    datum.data.data.familyColor = familyColor.getColor(datum);
                }

                new Person(that._svg, that._configuration, person, datum);
            });

        // Marriage arc layer (separate from persons so hover does not affect them)
        if (this._configuration.showParentMarriageDates) {
            this.drawMarriageArcs();
        }

        // Radial separator lines between family branches
        this.drawFamilySeparators();

        this.updateViewBox();
        this.bindClickEventListener();
    }

    /**
     * Draws radial separator lines between different family branches at
     * each generation level. Lines are drawn only between non-spouse
     * segments (where the parent differs).
     *
     * @private
     */
    drawFamilySeparators() {
        const geometry = new Geometry(this._configuration);
        let separatorGroup = this._svg.visual.select("g.separatorGroup");

        if (separatorGroup.empty()) {
            separatorGroup = this._svg.visual.append("g").attr("class", "separatorGroup");
        }

        const maxDepth = !this._configuration.showNames
            ? Math.min(this._configuration.generations, this._configuration.numberOfInnerCircles)
            : this._configuration.generations;

        for (let depth = 1; depth <= maxDepth; depth++) {
            const nodesAtDepth = this._hierarchy.nodes
                .filter(datum => (datum.depth === depth) && (datum.data.data.xref !== ""))
                .sort((left, right) => left.x0 - right.x0);

            for (let i = 0; i < (nodesAtDepth.length - 1); i++) {
                const current = nodesAtDepth[i];
                const next = nodesAtDepth[i + 1];

                // Only draw separator between different families
                if (current.parent !== next.parent) {
                    const angle = geometry.calcAngle(current.x1);

                    // Marriage arc below: between depth-1 and depth
                    const marriageBelow = this._configuration.showParentMarriageDates
                        && (depth > 1)
                        && ((depth - 1) < (this._configuration.generations - 1))
                        && (this._configuration.showNames || ((depth - 1) < this._configuration.numberOfInnerCircles));

                    // With marriage below: start at the marriage arc inner edge
                    // Without: start at the person arc inner edge
                    const innerR = marriageBelow
                        ? geometry.outerRadius(depth - 1)
                        : geometry.innerRadius(depth);

                    const outerR = geometry.outerRadius(depth);

                    separatorGroup
                        .append("line")
                        .attr("x1", innerR * Math.sin(angle))
                        .attr("y1", -innerR * Math.cos(angle))
                        .attr("x2", outerR * Math.sin(angle))
                        .attr("y2", -outerR * Math.cos(angle));
                }
            }
        }
    }

    /**
     * Draws marriage arcs in the gap between generations. Each arc spans the
     * angular range of a person who has parents shown in the chart. The arc
     * is always drawn (for visual consistency), and the marriage date text
     * is added when available.
     *
     * @private
     */
    drawMarriageArcs() {
        const that = this;

        let marriageGroup = this._svg.visual.select("g.marriageGroup");

        if (marriageGroup.empty()) {
            marriageGroup = this._svg.visual.append("g").attr("class", "marriageGroup");
        }

        // All nodes that have children and are within display range
        const nodes = this._hierarchy.nodes.filter(
            datum => datum.children
                && (datum.depth < (this._configuration.generations - 1)),
        );

        // D3 data join: same pattern as person elements
        marriageGroup
            .selectAll("g.marriage")
            .data(nodes, (datum) => datum.id)
            .enter()
            .append("g")
            .attr("class", "marriage")
            .attr("id", (datum) => "marriage-" + datum.id);

        // Create a new selection in order to leave the previous enter() selection
        marriageGroup
            .selectAll("g.marriage")
            .each(function (datum) {
                const marriage = d3.select(this);
                new Marriage(that._svg, that._configuration, marriage, datum);
            });
    }

    /**
     * Marks all persons with a non-empty xref as "available" (enabling hover
     * styles) and binds the click handler. Also marks marriage arcs that have
     * a date as "available" and empty ones as "empty" for CSS styling.
     *
     * @private
     */
    bindClickEventListener() {
        const persons = this._svg
            .select("g.personGroup")
            .selectAll("g.person")
            .filter((datum) => datum.data.data.xref !== "")
            .classed("available", true);

        // Trigger method on click/touch
        persons.on("click", this.personClick.bind(this));

        // Set available on marriage arcs that have content
        this._svg
            .select("g.marriageGroup")
            .selectAll("g.marriage")
            .filter((datum) => !!datum.data.data.marriageDateOfParents)
            .classed("available", true);

        // Mark empty marriage arcs (no parents shown) for CSS styling
        this._svg
            .select("g.marriageGroup")
            .selectAll("g.marriage")
            .each(function (datum) {
                const hasChildren = datum.children
                    && datum.children.some(child => child.data.data.xref !== "");

                d3.select(this).classed("empty", !hasChildren);
            });
    }

    /**
     * Handles a click on a person arc. Redirects to the individual page for
     * the center node (depth 0); triggers a chart update for all other nodes.
     *
     * @param {Event}  event The current event
     * @param {Object} datum The D3 data object
     *
     * @private
     */
    personClick(event, datum) {
        // Trigger either "update" or "redirectToIndividual" method on click depending on person in chart
        (datum.depth === 0) ? this.redirectToIndividual(datum.data.data.url) : this.update(datum.data.data.updateUrl);
    }

    /**
     * Opens the webtrees individual page in a new tab.
     *
     * @param {string} url The individual page URL
     *
     * @private
     */
    redirectToIndividual(url) {
        window.open(url, "_blank");
    }

    /**
     * Fetches new hierarchy data for the given individual URL and animates
     * the chart transition, then redraws overlay layers and rebinds events.
     *
     * @param {string} url The update URL for the new center individual
     */
    update(url) {
        const update = new Update(this._svg, this._configuration, this._hierarchy);

        update.update(
            url,
            () => this.redrawOverlayLayers(),
            () => this.bindClickEventListener(),
        );
    }

    /**
     * Marks existing separator lines as "old" (for fade-out) and draws the
     * separator lines for the incoming hierarchy. Called from Update.update()
     * before the transition starts so old and new lines can cross-fade.
     *
     * @private
     */
    redrawOverlayLayers() {
        // Separators: mark old, draw new
        this._svg.visual.selectAll("g.separatorGroup line")
            .classed("old", true);

        this.drawFamilySeparators();

    }
}
