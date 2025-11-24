/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../lib/d3";
import Overlay from "../lib/chart/overlay";
import Svg from "./svg";
import Person from "./svg/person";
import Gradient from "./gradient";

const MIN_PADDING = 1;

/**
 * Creates and manages the SVG view layer.
 */
export default class ViewLayer
{
    /**
     * @param {Configuration} configuration
     */
    constructor(configuration)
    {
        this._configuration = configuration;
        this._parent        = null;
        this._svg           = null;
        this._overlay       = null;
        this._gradient      = null;
    }

    /**
     * @returns {Svg|null}
     */
    get svg()
    {
        return this._svg;
    }

    /**
     * Prepares the SVG, overlay, and person elements.
     *
     * @param {Selection} parent
     * @param {LayoutEngine} layoutEngine
     */
    render(parent, layoutEngine)
    {
        this._parent   = parent;
        this._svg      = new Svg(this._parent, this._configuration);
        this._overlay  = new Overlay(this._parent);
        this._gradient = new Gradient(this._svg, this._configuration);

        this._svg.initEvents(this._overlay);

        this.renderPersons(layoutEngine);
        this.updateViewBox();
        this.bindClickEventListener();
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
        if (!this._svg) {
            return;
        }

        this._svg
            .attr("width", "100%")
            .attr("height", "100%");

        const fullscreenElement = document.fullscreenElement;
        const isFullscreen      = fullscreenElement !== null && fullscreenElement !== undefined;
        const padding           = this.convertRemToPixels(MIN_PADDING);

        let svgBoundingBox          = this._svg.visual.node().getBBox();
        let clientBoundingBox       = this._parent.node().getBoundingClientRect();
        const fullscreenBoundingBox = isFullscreen ? fullscreenElement.getBoundingClientRect?.() : undefined;
        const containerBoundingBox  = fullscreenBoundingBox ?? clientBoundingBox;

        let viewBoxWidth  = Math.max(containerBoundingBox.width, svgBoundingBox.width);
        let viewBoxHeight = Math.max(containerBoundingBox.height, svgBoundingBox.height);

        if (isFullscreen) {
            viewBoxWidth  = svgBoundingBox.width;
            viewBoxHeight = svgBoundingBox.height;
        }

        let offsetX = (viewBoxWidth - svgBoundingBox.width) >> 1;
        let offsetY = (viewBoxHeight - svgBoundingBox.height) >> 1;

        let viewBoxLeft = Math.ceil(svgBoundingBox.x - offsetX - padding);
        let viewBoxTop  = Math.ceil(svgBoundingBox.y - offsetY - padding);

        if (isFullscreen) {
            this._svg
                .attr("width", containerBoundingBox.width)
                .attr("height", containerBoundingBox.height);
        }

        viewBoxWidth  = Math.ceil(viewBoxWidth + (padding << 1));
        viewBoxHeight = Math.ceil(viewBoxHeight + (padding << 1));

        this._svg
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
        if (!this._svg) {
            return;
        }

        this._svg
            .transition()
            .duration(750)
            .call(this._svg.zoom.get().transform, d3.zoomIdentity);
    }

    /**
     * Binds click listeners to person elements.
     */
    bindClickEventListener()
    {
        this._svg
            .select("g.personGroup")
            .selectAll("g.person")
            .filter((datum) => datum.data.data.xref !== "")
            .classed("available", true)
            .on("click", this.personClick.bind(this));
    }

    /**
     * @param {Event} event
     * @param {Object} datum
     *
     * @private
     */
    personClick(event, datum)
    {
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
     * Hooks update handling for external listeners.
     *
     * @param {Function} callback
     */
    onUpdate(callback)
    {
        this.update = callback;
    }

    /**
     * Renders all person nodes.
     *
     * @param {LayoutEngine} layoutEngine
     */
    renderPersons(layoutEngine)
    {
        if (!this._svg) {
            return;
        }

        const personGroup = this._svg.select("g.personGroup");
        const nodes       = layoutEngine.hierarchy.nodes;

        personGroup
            .selectAll("g.person")
            .data(nodes, (datum) => datum.id)
            .enter()
            .filter((datum) => (datum.data.data.xref !== "") || !this._configuration.hideEmptySegments)
            .append("g")
            .attr("class", "person")
            .attr("id", (datum) => "person-" + datum.id);

        personGroup
            .selectAll("g.person")
            .each((datum, index, nodesList) => {
                const person = d3.select(nodesList[index]);

                if (this._configuration.showColorGradients) {
                    this._gradient.init(datum);
                }

                new Person(this._svg, this._configuration, layoutEngine.arcFactory, layoutEngine.geometry, person, datum);
            });
    }
}
