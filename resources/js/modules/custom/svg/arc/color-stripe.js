/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../../lib/d3";
import Geometry from "./../geometry";
import Text from "./../text";
import {SEX_FEMALE, SEX_MALE} from "../../hierarchy";

/**
 * This class handles the creation the colored stripe for each arc.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class ColorStripe
{
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     */
    constructor(svg, configuration)
    {
        this._svg           = svg;
        this._configuration = configuration;
        this._geometry      = new Geometry(this._configuration);

        this.initArcGenerator();
        // this.init(person, children);
    }

    initArcGenerator()
    {
        // Create arc generator
        // Arc generator
        this._arcGenerator = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            // .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
            // .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
            .padAngle(this._configuration.padAngle)
            .padRadius(this._configuration.padRadius)
            .innerRadius(d => this._geometry.outerRadius(d.y0) - this._configuration.colorArcWidth)
            .outerRadius(d => this._geometry.outerRadius(d.y0) + 1);
        // .innerRadius(this._geometry.outerRadius(datum.depth) - this._configuration.colorArcWidth)
        // .outerRadius(this._geometry.outerRadius(datum.depth) + 1);
    }

    /**
     * Initialize the required elements.
     *
     * @param {Selection} person
     * @param {Object}    datum
     */
    init(person, datum)
    {
        // if (person.classed("new") && this._configuration.hideEmptySegments) {
        //     this.addArcToPerson(person, datum);
        // } else {
        //     if (!person.classed("new")
        //         && !person.classed("update")
        //         && !person.classed("remove")
        //         && ((datum.data.data.xref !== "") || !this._configuration.hideEmptySegments)
        //     ) {
        //         this.addArcToPerson(person, datum);
        //     }
        // }
        //
        // if (datum.data.data.xref !== "") {
        //     this.addTitleToPerson(person, datum.data.data.name);
        //
        //     const labelContainer = person
        //         .append("g")
        //         .attr("class", "wt-chart-box-name name")
        //         .style("font-size", this.getFontSize(datum) + "px");
        //
        //     // Append labels (initial hidden)
        //     this._text = new Text(this._svg, this._configuration);
        //     this._text
        //         .createLabels(labelContainer, datum);
        //
        //     this.addColorGroup(person, datum);
        //
        //     const that = this;
        //
        //     // Hovering
        //     person
        //         .on("contextmenu", (event, datum) => {
        //             if (this._svg.div.property("active")) {
        //                 this._svg.div
        //                     .transition()
        //                     .duration(200)
        //                     .style("opacity", 0);
        //
        //                 this._svg.div.property("active", false);
        //                 event.preventDefault();
        //             } else {
        //                 this._svg.div.property("active", true);
        //                 this.setTooltipHtml(datum);
        //
        //                 event.preventDefault();
        //             }
        //         })
        //         // Handles the event when a pointing device initially enters an element.
        //         .on("mouseenter", (event, datum) => {
        //             if (datum.data.data.xref === "") {
        //                 this._svg.div
        //                     .style("opacity", 0);
        //             }
        //
        //             this.setTooltipHtml(datum);
        //         })
        //         // Handles the event when a pointing device leaves an element.
        //         .on("mouseleave", (event, datum) => {
        //             if (datum.data.data.xref === "") {
        //                 this._svg.div
        //                     .style("opacity", 0);
        //             }
        //         })
        //         // Handles the event when a pointing device is moved around an element.
        //         .on("mousemove", (event, datum) => {
        //             this._svg.div
        //                 .style("left", (event.pageX) + "px")
        //                 .style("top", (event.pageY - 30) + "px");
        //         })
        //         // Handles the event when a pointing device is moved onto an element.
        //         .on("mouseover", function (event, datum) {
        //             const elements = person.nodes();
        //             const index    = elements.indexOf(this);
        //
        //             // Use raise() to move element to the top, as in SVG the last element is always the
        //             // one drawn on top of the others.
        //             d3.select(elements[index])
        //                 .classed("hover", true)
        //                 .raise();
        //         })
        //         // Handles the event when a pointing device is moved off an element.
        //         .on("mouseout", function (event, datum) {
        //             const elements = person.nodes();
        //             const index    = elements.indexOf(this);
        //
        //             d3.select(elements[index])
        //                 .classed("hover", false);
        //         });
        // }
    }

    /**
     * Adds a color overlay for each arc.
     *
     * @param {Selection} person
     * @param {Object}    datum  The D3 data object
     */
    createOverlay(person, datum)
    {
        let color = person
            .append("g")
            .attr("class", "color");

        let path = color
            .append("path")
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
            .attr("d", d => this._arcGenerator(d.current));

        if (!this._configuration.showColorGradients) {
            path.attr(
                "class",
                datum.data.data.sex === SEX_FEMALE ? "female" : (datum.data.data.sex === SEX_MALE ? "male" : "unknown")
            );
        }
    }

    arcVisible(d)
    {
        // return d.y1 > d.y0 && d.x1 > d.x0;
        return d.y1 <= this._configuration.generations && d.y0 >= 0 && d.x1 > d.x0;
    }

    /**
     *
     * @param {Transition} transition
     */
    tween(transition)
    {
        this._svg.visual
            .selectAll(".color path")
            .transition(transition)
            .tween("data", d => {
                const i = d3.interpolate(d.current, d.target);
                return transition => d.current = i(transition);
            })
            // .filter(function(d) {
            //     return +this.getAttribute("fill-opacity") || this.arcVisible(d.target);
            // })
            // .attr("fill-opacity", d => this.arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
            .attr("fill-opacity", d => this.arcVisible(d.target) ? 1 : 0)
            // .attr("pointer-events", d => this.arcVisible(d.target) ? "auto" : "none")
            .attrTween("d", d => () => this._arcGenerator(d.current));
    }
}
