/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */

import {Hierarchy} from "./hierarchy";
import {Options} from "./options";
import {config} from "./config";
import {Gradient} from "./gradient";
import * as d3 from "./d3";
import {Geometry, MATH_PI2} from "./geometry";
import {default as Text} from "./arc/text";
import {Click} from "./arc/click";

/**
 *
 */
export class Arc
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
     * Create the arc elements for each individual in the data list.
     *
     * @return {void}
     *
     * @public
     */
    createArcElements()
    {
        let self        = this;
        let personGroup = this.config.svg.select("g.personGroup");

        let gradient    = new Gradient(this.config, this.options);

        personGroup.selectAll("g.person")
            .data(this.hierarchy.getNodes())
            .enter()
            .each(entry => {
                let person = personGroup
                    .append("g")
                    .attr("class", "person")
                    .attr("id", "person-" + entry.data.id)
                    .on("click", null);

                self.addPersonData(person, entry);

                if (self.options.showColorGradients) {
                    gradient.init(entry);
                }
            });

        let click = new Click(this.config, this.options, this.hierarchy);
        click.bindClickEventListener();
        // this.bindClickEventListener();

        gradient.addColorGroup(this.hierarchy)
            .style("opacity", 1);
    }

    /**
     *
     * @param person
     * @param d
     *
     * @private
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
     * @public
     */
    addArcToPerson(person, data)
    {
        let self = this;

        // Arc generator
        let arcGen = d3.arc()
            .startAngle(function () {
                return (data.depth === 0) ? 0 : self.geometry.startAngle(data);
            })
            .endAngle(function () {
                return (data.depth === 0) ? MATH_PI2 : self.geometry.endAngle(data);
            })
            .innerRadius(self.geometry.innerRadius(data))
            .outerRadius(self.geometry.outerRadius(data));

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

    // /**
    //  * This method bind the "click" event listeners to a "person" element.
    //  */
    // bindClickEventListener()
    // {
    //     let self = this;
    //
    //     let personGroup = this.config.svg
    //         .select("g.personGroup")
    //         .selectAll("g.person")
    //         .data(this.hierarchy.getNodes())
    //         .filter((d) => (d.data.xref !== ""))
    //         .classed("available", true);
    //
    //     // Trigger method on click
    //     personGroup.on("click", self.personClick.bind(this));
    // }
    //
    // /**
    //  * Method triggers either the "update" or "individual" method on the click on an person.
    //  *
    //  * @param {Object} data The D3 data object
    //  */
    // personClick(data)
    // {
    //     // Trigger either "update" or "individual" method on click depending on person in chart
    //     (data.depth === 0) ? individual(data) : this.update(data);
    // }
    //
    // /**
    //  * Redirect the current page the the individual page.
    //  *
    //  * @param {Object} d D3 data object
    //  */
    // individual(d)
    // {
    //     window.location = this.options.individualUrl + d.data.xref;
    // }
    //
    // /**
    //  * Redirect the current page the the individual page.
    //  *
    //  * @param {Object} d D3 data object
    //  */
    // update(d)
    // {
    //     let update = new Update(this.config, this.options, this.hierarchy);
    //     update.update(d);
    // }
}
