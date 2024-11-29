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
import ColorStripe from "./arc/color-stripe.js";

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

        this.initArcGenerator();
        this.init(person, children);
    }

    initArcGenerator()
    {
        // Create arc generator
        this._arcGenerator = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            // .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
            // .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
            .padAngle(this._configuration.padAngle)
            .padRadius(this._configuration.padRadius)
            // .innerRadius(this._geometry.innerRadius(datum.depth))
            // .outerRadius(this._geometry.outerRadius(datum.depth))
            .innerRadius(d => this._geometry.innerRadius(d.y0))
            .outerRadius(d => this._geometry.outerRadius(d.y0))
            .cornerRadius(this._configuration.cornerRadius);
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

            const labelContainer = person
                .append("g")
                .attr("class", "wt-chart-box-name name")
                .style("font-size", this.getFontSize(datum) + "px");

            // Append labels (initial hidden)
            this._text = new Text(this._svg, this._configuration);
            this._text
                .createLabels(labelContainer, datum);

            // this.addColorGroup(person, datum);
            this._colorStripe = new ColorStripe(this._svg, this._configuration);
            this._colorStripe
                .createOverlay(person, datum);

            // const that = this;

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
     * Appends the arc element to the person element.
     *
     * @param {Selection} person The parent element used to append the arc too
     * @param {Object}    datum  The D3 data object
     *
     * @private
     */
    addArcToPerson(person, datum)
    {
console.log('addArcToPerson', datum);
// console.log(this._geometry.startAngle(datum.depth, datum.x0));
// console.log(this._geometry.endAngle(datum.depth, datum.x1));
// console.log(this._geometry.innerRadius(datum.y0));
// console.log(this._geometry.outerRadius(datum.y0));

        datum.x0 = this._geometry.startAngle(datum.depth, datum.x0);
        datum.x1 = this._geometry.endAngle(datum.depth, datum.x1);
        // datum.y0 = datum.depth;
        // datum.y1 = datum.depth + 1;

        datum.current = {
            x0: datum.x0,
            x1: datum.x1,
            y0: datum.y0,
            y1: datum.y1
        }

        // Create arc generator
        // let arcGenerator = d3.arc()
        //     .startAngle(datum.x0)
        //     .endAngle(datum.x1)
        //     // .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
        //     // .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
        //     .padAngle(this._configuration.padAngle)
        //     .padRadius(this._configuration.padRadius)
        //     // .innerRadius(this._geometry.innerRadius(datum.depth))
        //     // .outerRadius(this._geometry.outerRadius(datum.depth))
        //     .innerRadius(this._geometry.innerRadius(datum.y0))
        //     .outerRadius(this._geometry.outerRadius(datum.y0))
        //     .cornerRadius(this._configuration.cornerRadius)
        // ;

        // Append arc
        let arcGroup = person
            .append("g")
            .attr("class", "arc");

        let path = arcGroup
            .append("path")
            .attr("d", d => this._arcGenerator(d.current));

        // Hide arc initially if it's new during chart update
        if (person.classed("new")) {
            path.style("opacity", 1e-6);
        }
    }

    arcVisible(d)
    {
// console.log('arcVisible', d);
        // return d.y1 > d.y0 && d.x1 > d.x0;

        return d.y1 <= this._configuration.generations && d.y0 >= 1 && d.x1 > d.x0;
    }

    /**
     *
     * @param {Transition} transition
     */
    tween(transition)
    {
        const that = this;

        // Transition the data on all arcs, even the ones that aren’t visible,
        // so that if this transition is interrupted, entering arcs will start
        // the next transition from the desired position.
        this._svg.visual
            .selectAll(".arc path")
            .transition(transition)
            .tween("data", d => {
                const i = d3.interpolate(d.current, d.target);
                return transition => d.current = i(transition);
            })
            .filter(function (d) {
console.log('filter', this.parentNode.parentNode.getAttribute("fill-opacity"), this);
                return +this.parentNode.parentNode.getAttribute("fill-opacity") || that.arcVisible(d.target);
//                 return that.arcVisible(d.target);
//                 return true;
            })
//             .call((d) => {
// console.log('call', d);
//                 return this.arcVisible(d.target) ? 1 : 0;
//             })
            .attr("fill-opacity", d => this.arcVisible(d.target) ? 1 : 0)
            .attr("stroke-opacity", d => this.arcVisible(d.target) ? 1 : 0)
            // .attr("fill-opacity", d => this.arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
            .attr("pointer-events", d => this.arcVisible(d.target) ? "auto" : "none")
            .attrTween("d", d => () => this._arcGenerator(d.current))
        // .on("end", () => {
        //     this.svg.visual
        //         .selectAll(".person")
        //         .attr("pointer-events", d => this.arcVisible(d.target) ? "auto" : "none")
        //         // .attr("fill-opacity", d => this.arcVisible(d.target) ? 1 : 0)
        // })
        ;

        this._text
            .tween(transition);

        this._colorStripe
            .tween(transition);
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
    addLabelToPerson(parent, datum)
    {
        return parent
            .append("g")
            .attr("class", "wt-chart-box-name name")
            .style("font-size", this.getFontSize(datum) + "px");
    }

    /**
     * Get the scaled font size.
     *
     * @param {Object} datum The The D3 data object
     *
     * @return {number}
     */
    getFontSize(datum)
    {
        let fontSize = this._configuration.fontSize;

        if (datum.depth >= (this._configuration.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        return ((fontSize - datum.depth) * this._configuration.fontScale / 100.0);
    }
}
