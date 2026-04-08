/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";
import Geometry from "./geometry";
import TooltipRenderer from "./tooltip-renderer";
import LabelRenderer from "./label-renderer";
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

            // Append labels with text content
            let labelRenderer = new LabelRenderer(this._svg, this._configuration);
            labelRenderer.addLabel(person, datum);

            this.addColorGroup(person, datum);

            // Bind tooltip and hover events
            let tooltipRenderer = new TooltipRenderer(this._svg, this._configuration);
            tooltipRenderer.bindEvents(person, datum);
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

        arcGenerator.padAngle(this.getArcPadAngle(datum))
            .padRadius(this._configuration.padRadius)
        //     .cornerRadius(this._configuration.cornerRadius - 2)
            ;

        let color = person
            .append("g")
            .attr("class", "color");

        // Hide immediately during updates to prevent visual flash
        if (person.classed("update")) {
            color.style("opacity", 1e-6);
        }

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

        arcGenerator.padAngle(this.getArcPadAngle(datum))
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
     * Returns the pad angle for a person's arc. When marriage arcs are shown,
     * spouse segments (sharing the same parent) use no padding so they appear
     * as a single joined block.
     *
     * @param {Object} datum The D3 data object
     *
     * @return {number}
     *
     * @private
     */
    getArcPadAngle(datum)
    {
        if (this._configuration.showParentMarriageDates && datum.parent) {
            return 0;
        }

        return this._configuration.padAngle;
    }
}
