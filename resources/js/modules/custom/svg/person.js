/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";
import Geometry from "./geometry";
import Text from "./text";
import {SEX_FEMALE, SEX_MALE} from "../hierarchy";

/**
 * This class handles the creation of the person elements of the chart.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Person
{
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Selection}     person
     * @param {Object}        children
     */
    constructor(svg, configuration, person, children)
    {
        this._svg           = svg;
        this._configuration = configuration;
        this._geometry      = new Geometry(this._configuration);

        this.init(person, children);
    }

    /**
     * Initialize the required elements.
     *
     * @param {Selection} person
     * @param {Object}    datum
     */
    init(person, datum)
    {
        if (person.classed("new") && this._configuration.hideEmptySegments) {
            this.addArcToPerson(person, datum);
        } else {
            if (!person.classed("new")
                && !person.classed("update")
                && !person.classed("remove")
                && ((datum.data.data.xref !== "") || !this._configuration.hideEmptySegments)
            ) {
                this.addArcToPerson(person, datum);
            }
        }

        if (datum.data.data.xref !== "") {
            this.addTitleToPerson(person, datum.data.data.name);

            // Append labels (initial hidden)
            let text  = new Text(this._svg, this._configuration);
            let label = this.addLabelToPerson(person, datum);

            text.createLabels(label, datum);
            this.addColorGroup(person, datum);

            const that = this;

            // Hovering
            person
                .on("contextmenu", (event, datum) => {
                    if (this._svg.div.property("active")) {
                        this._svg.div
                            .transition()
                            .duration(200)
                            .style("opacity", 0);

                        this._svg.div.property("active", false);
                        event.preventDefault();
                    } else {
                        this._svg.div.property("active", true);
                        this.setTooltipHtml(datum);

                        event.preventDefault();
                    }
                })
                // Handles the event when a pointing device initially enters an element.
                .on("mouseenter", (event, datum) => {
                    if (datum.data.data.xref === "") {
                        this._svg.div
                            .style("opacity", 0);
                    }

                    this.setTooltipHtml(datum);
                })
                // Handles the event when a pointing device leaves an element.
                .on("mouseleave", (event, datum) => {
                    if (datum.data.data.xref === "") {
                        this._svg.div
                            .style("opacity", 0);
                    }
                })
                // Handles the event when a pointing device is moved around an element.
                .on("mousemove", (event, datum) => {
                    this._svg.div
                        .style("left", (event.pageX) + "px")
                        .style("top", (event.pageY - 30) + "px");
                })
                // Handles the event when a pointing device is moved onto an element.
                .on("mouseover", function (event, datum) {
                    const elements = person.nodes();
                    const index    = elements.indexOf(this);

                    // Use raise() to move element to the top, as in SVG the last element is always the
                    // one drawn on top of the others.
                    d3.select(elements[index])
                        .classed("hover", true)
                        .raise();
                })
                // Handles the event when a pointing device is moved off an element.
                .on("mouseout", function (event, datum) {
                    const elements = person.nodes();
                    const index    = elements.indexOf(this);

                    d3.select(elements[index])
                        .classed("hover", false);
                });
        }
    }

    /**
     *
     * @param {Object} datum The D3 data object
     */
    setTooltipHtml(datum)
    {
        // Ignore empty elements
        if (datum.data.data.xref === "") {
            return;
        }

        let image = "";

        // Show individual image or silhouette (depending on tree configuration)
        if (this._configuration.showImages) {
            if (datum.data.data.thumbnail) {
                image = "<div class=\"image\">";
                image += "<img src=\"" + datum.data.data.thumbnail + "\" alt=\"\" />";
                image += "</div>";
            } else {
                if (this._configuration.showSilhouettes) {
                    image = "<div class=\"image\">";
                    image += "<i class=\"icon-silhouette icon-silhouette-" + datum.data.data.sex.toLowerCase() + " wt-icon-flip-rtl\" ></i>";
                    image += "</div>";
                }
            }
        }

        const dates = datum.data.data.birth || datum.data.data.marriageDate || datum.data.data.death;

        this._svg.div
            .html(
                image
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
                + "</div>"
            )
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY - 30) + "px");

        if (this._svg.div.property("active")) {
            this._svg.div
                .transition()
                .duration(200)
                .style("opacity", 1);
        }
    }

    /**
     * Adds a color overlay for each arc.
     *
     * @param {Selection} person
     * @param {Object}    data   The D3 data object
     */
    addColorGroup(person, datum)
    {
        // Arc generator
        let arcGenerator = d3.arc()
            .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
            .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
            .innerRadius(this._geometry.outerRadius(datum.depth) - this._configuration.colorArcWidth)
            .outerRadius(this._geometry.outerRadius(datum.depth) + 1);
        // .innerRadius((data) => this._geometry.outerRadius(data.depth) - this._configuration.colorArcWidth - 2)
        // .outerRadius((data) => this._geometry.outerRadius(data.depth) - 1);

        arcGenerator.padAngle(this._configuration.padAngle)
            .padRadius(this._configuration.padRadius)
        //     .cornerRadius(this._configuration.cornerRadius - 2)
            ;

        let color = person
            .append("g")
            .attr("class", "color");

        let path = color.append("path")
            .attr("fill", () => {
                if (this._configuration.showColorGradients) {
                    // Innermost circle (first generation)
                    if (!datum.depth) {
                        return "rgb(225, 225, 225)";
                    }

                    return "url(#grad-" + datum.id + ")";
                }

                return null;
            })
            .attr("d", arcGenerator);

        if (!this._configuration.showColorGradients) {
            path.attr(
                "class",
                datum.data.data.sex === SEX_FEMALE ? "female" : (datum.data.data.sex === SEX_MALE ? "male" : "unknown")
            );
        }
    }

    /**
     * Appends the arc element to the person element.
     *
     * @param {Selection} person The parent element used to append the arc too
     * @param {Object}    datum  The D3 data object
     *
     * @private
     */
    addArcToPerson(person, datum)
    {
        // Create arc generator
        let arcGenerator = d3.arc()
            .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
            .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
            .innerRadius(this._geometry.innerRadius(datum.depth))
            .outerRadius(this._geometry.outerRadius(datum.depth));

        arcGenerator.padAngle(this._configuration.padAngle)
            .padRadius(this._configuration.padRadius)
            .cornerRadius(this._configuration.cornerRadius);

        // Append arc
        let arcGroup = person
            .append("g")
            .attr("class", "arc");

        let path = arcGroup
            .append("path")
            .attr("d", arcGenerator);

        // Hide arc initially if its new during chart update
        if (person.classed("new")) {
            path.style("opacity", 1e-6);
        }
    }

    /**
     * Add title element to the person element containing the full name of the individual.
     *
     * @param {Selection} person The parent element used to append the title too
     * @param {string}    value  The value to assign to the title
     *
     * @private
     */
    addTitleToPerson(person, value)
    {
        person
            .insert("title", ":first-child")
            .text(value);
    }

    /**
     * Append labels (initial hidden).
     *
     * @param {Selection} parent The parent element used to append the label element too
     * @param {Object}    datum  The D3 data object
     *
     * @return {Selection} Newly added label element
     *
     * @private
     */
    addLabelToPerson(parent, children)
    {
        return parent
            .append("g")
            .attr("class", "wt-chart-box-name name")
            .style("font-size", this.getFontSize(children) + "px");
    }

    /**
     * Get the scaled font size.
     *
     * @param {Object} children The The D3 data object
     *
     * @return {number}
     */
    getFontSize(children)
    {
        let fontSize = this._configuration.fontSize;

        if (children.depth >= (this._configuration.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        return ((fontSize - children.depth) * this._configuration.fontScale / 100.0);
    }
}
