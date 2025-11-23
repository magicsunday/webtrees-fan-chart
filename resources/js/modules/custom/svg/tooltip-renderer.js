/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";

/**
 * Handles tooltip rendering and mouse interactions for a person node.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class TooltipRenderer
{
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Geometry}      geometry      Geometry helper instance
     */
    constructor(svg, configuration, geometry)
    {
        this._svg           = svg;
        this._configuration = configuration;
        this._geometry      = geometry;
    }

    /**
     * Bind all tooltip-related events to the given selection.
     *
     * @param {Selection} person The person selection to attach events to
     * @param {Object}    datum  The D3 data object
     */
    bind(person, datum)
    {
        person
            .on("contextmenu", (event, data) => this.handleContextMenu(event, data))
            .on("mouseenter", (event, data) => this.showTooltip(event, data))
            .on("mouseleave", (event, data) => this.handleMouseLeave(data))
            .on("mousemove", (event) => this.positionTooltip(event))
            .on("mouseover", (event) => this.highlightPerson(person, event, true))
            .on("mouseout", (event) => this.highlightPerson(person, event, false));
    }

    /**
     * Handle toggling the tooltip via context menu interaction.
     *
     * @param {Event}  event The current event
     * @param {Object} datum The D3 data object
     */
    handleContextMenu(event, datum)
    {
        if (this._svg.div.property("active")) {
            this._svg.div
                .transition()
                .duration(200)
                .style("opacity", 0);

            this._svg.div.property("active", false);
        } else {
            this._svg.div.property("active", true);
            this.showTooltip(event, datum);
        }

        event.preventDefault();
    }

    /**
     * Hide the tooltip when leaving an empty node.
     *
     * @param {Object} datum The D3 data object
     */
    handleMouseLeave(datum)
    {
        if (datum.data.data.xref === "") {
            this._svg.div
                .style("opacity", 0);
        }
    }

    /**
     * Render tooltip contents and position on screen.
     *
     * @param {Event}  event The current event
     * @param {Object} datum The D3 data object
     */
    showTooltip(event, datum)
    {
        if (datum.data.data.xref === "") {
            return;
        }

        this._svg.div
            .html(this.buildTooltipHtml(datum))
            .style("left", `${event.pageX}px`)
            .style("top", `${event.pageY - 30}px`);

        if (this._svg.div.property("active")) {
            this._svg.div
                .transition()
                .duration(200)
                .style("opacity", 1);
        }
    }

    /**
     * Position tooltip relative to the current mouse position.
     *
     * @param {Event} event The current event
     */
    positionTooltip(event)
    {
        this._svg.div
            .style("left", `${event.pageX}px`)
            .style("top", `${event.pageY - 30}px`);
    }

    /**
     * Highlight the hovered element for better stacking order and feedback.
     *
     * @param {Selection} person    The person selection
     * @param {Event}     event     The current event
     * @param {boolean}   isHovered Whether the element is hovered
     */
    highlightPerson(person, event, isHovered)
    {
        const elements = person.nodes();
        const target = event.currentTarget || event.target;
        const index = elements.indexOf(target);

        if (index === -1) {
            return;
        }

        const element = elements[index];

        const selection = d3.select(element)
            .classed("hover", isHovered);

        if (isHovered) {
            selection.raise();
        }
    }

    /**
     * Build the HTML for the tooltip contents.
     *
     * @param {Object} datum The D3 data object
     *
     * @return {string}
     */
    buildTooltipHtml(datum)
    {
        if (datum.data.data.xref === "") {
            return "";
        }

        let image = "";

        if (this._configuration.showImages) {
            if (datum.data.data.thumbnail) {
                image = "<div class=\"image\">";
                image += "<img src=\"" + datum.data.data.thumbnail + "\" alt=\"\" />";
                image += "</div>";
            } else if (this._configuration.showSilhouettes) {
                image = "<div class=\"image\">";
                image += "<i class=\"icon-silhouette icon-silhouette-" + datum.data.data.sex.toLowerCase() + " wt-icon-flip-rtl\" ></i>";
                image += "</div>";
            }
        }

        const dates = datum.data.data.birth || datum.data.data.marriageDate || datum.data.data.death;

        return image
            + "<div class=\"text\">"
                + "<div class=\"name\">" + datum.data.data.name + "</div>"
                + (dates
                    ? "<table>"
                        + (datum.data.data.birth
                        ? ("<tr class=\"date\"><th>\u2605</th><td>" + datum.data.data.birth + "</td></tr>")
                        : "")
                        + (datum.data.data.marriageDate
                        ? ("<tr class=\"date\"><th>\u26AD</th><td>" + datum.data.data.marriageDate + "</td></tr>")
                        : "")
                        + (datum.data.data.death
                        ? ("<tr class=\"date\"><th>\u2020</th><td>" + datum.data.data.death + "</td></tr>")
                        : "")
                    + "</table>"
                : "")
            + "</div>";
    }
}
