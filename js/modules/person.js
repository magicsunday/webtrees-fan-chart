/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import {Hierarchy} from "./hierarchy";
import {Options} from "./options";
import * as d3 from "./d3";
import {Geometry, MATH_PI2} from "./geometry";
import {default as Text} from "./arc/text";

/**
 *
 */
export class Person
{
    /**
     * Constructor.
     *
     * @param {Config}    config
     * @param {Options}   options
     * @param {Hierarchy} hierarchy
     */
    constructor(config, options, hierarchy)
    {
        this.config    = config;
        this.options   = options;
        this.hierarchy = hierarchy;
        this.geometry  = new Geometry(options);
    }

    /**
     *
     * @param person
     * @param d
     *
     * @public
     */
    addPersonData(person, d)
    {
        if (person.classed("new") && this.options.hideEmptySegments) {
            this.addArcToPerson(person, d);
        } else {
            if (!person.classed("new")
                && !person.classed("update")
                && !person.classed("remove")
                && ((d.data.xref !== "") || !this.options.hideEmptySegments)
            ) {
                this.addArcToPerson(person, d);
            }
        }

        if (d.data.xref !== "") {
            this.addTitleToPerson(person, d);

            // Append labels (initial hidden)
            let label = this.addLabelToPerson(person);

            let text = new Text(this.config, this.options);
            text.addLabel(label, d);
        }

        // Hovering
        person
            .on("mouseover", function () {
                d3.select(this).classed("hover", true);
            })
            .on("mouseout", function () {
                d3.select(this).classed("hover", false);
            });
    }

    /**
     * Add title element to the person element containing the full name of the individual.
     *
     * @param {Object} person Parent element used to append the title too
     * @param {Object} data   The D3 data object
     *
     * @private
     */
    addTitleToPerson(person, data)
    {
        person
            .insert("title", ":first-child")
            .text(data.data.name);
    }

    /**
     * Append labels (initial hidden).
     *
     * @param {Object} parent The parent element used to append the label element too
     *
     * @return {Object} Newly added label element
     *
     * @private
     */
    addLabelToPerson(parent)
    {
        return parent
            .append("g")
            .attr("class", "label")
            .style("fill", this.options.fontColor);
    }

    /**
     * Appends the arc element to the person element.
     *
     * @param {Object} person The parent element used to append the arc too
     * @param {Object} data   The D3 data object
     *
     * @private
     */
    addArcToPerson(person, data)
    {
        // Arc generator
        let arcGen = d3.arc()
            .startAngle(() => (data.depth === 0) ? 0 : this.geometry.startAngle(data))
            .endAngle(() => (data.depth === 0) ? MATH_PI2 : this.geometry.endAngle(data))
            .innerRadius(this.geometry.innerRadius(data))
            .outerRadius(this.geometry.outerRadius(data));

        // Append arc
        let arcGroup = person
            .append("g")
            .attr("class", "arc");

        let path = arcGroup
            .append("path")
            .attr("d", arcGen);

        // Hide arc initially if its new during chart update
        if (person.classed("new")) {
            path.style("opacity", 0);
        }
    }
}
