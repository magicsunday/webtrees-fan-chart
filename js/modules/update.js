/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "./d3";
import {Gradient} from "./gradient";
import {Hierarchy} from "./hierarchy";
import {Options} from "./options";
import Click from "./arc/click";
import {Person} from "./person";

/**
 * Class handling the update of all text and path elements.
 */
export default class Update
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

        this.svg       = this.config.svg;
        this.gradient  = new Gradient(this.config, this.options);
    }

    /**
     * Update the chart with data loaded from AJAX.
     *
     * @param {Object} d D3 data object
     *
     * @public
     */
    update(d)
    {
        let that = this;

        this.svg
            .selectAll("g.person")
            .on("click", null);

        d3.json(
            this.options.updateUrl + d.data.xref
        ).then((data) => {
            // Initialize the new loaded data
            this.hierarchy.init(data);

            // Flag all elements which are subject to change
            this.svg
                .selectAll("g.person")
                .data(this.hierarchy.getNodes())
                .each(function (entry) {
                    let empty  = entry.data.xref === "";
                    let person = d3.select(this);

                    person.classed("remove", empty)
                        .classed("update", !empty && person.classed("available"))
                        .classed("new", !empty && !person.classed("available"));

                    if (!person.classed("new")) {
                        person.selectAll("g.label, title")
                            .classed("old", true);
                    }

                    let p = new Person(that.config, that.options, that.hierarchy);
                    p.addPersonData(person, entry);
                });

            // Hide all new labels of not removed elements
            this.svg
                .selectAll("g.person:not(.remove)")
                .selectAll("g.label:not(.old)")
                .style("opacity", 0);

            this.gradient.addColorGroup(this.hierarchy)
                .classed("new", true);

            // Create transition instance
            let t = d3.transition()
                .duration(this.options.updateDuration)
                .call(this.endall, () => this.updateDone());

            // Fade out old arc
            this.svg
                .selectAll("g.person.remove g.arc path")
                .transition(t)
                .style("fill", () => this.options.hideEmptySegments ? null : "rgb(240, 240, 240)")
                .style("opacity", () => this.options.hideEmptySegments ? 0 : null);

            // Fade in new arcs
            this.svg
                .selectAll("g.person.new g.arc path")
                .transition(t)
                .style("fill", "rgb(250, 250, 250)")
                .style("opacity", () => this.options.hideEmptySegments ? 1 : null);

            // Fade out all old labels and color group
            this.svg
                .selectAll("g.person.update g.label.old, g.person.remove g.label.old, g.colorGroup:not(.new)")
                .transition(t)
                .style("opacity", 0);

            // Fade in all new labels and color group
            this.svg
                .selectAll("g.person:not(.remove) g.label:not(.old), g.colorGroup.new")
                .transition(t)
                .style("opacity", 1);
        });
    }

    /**
     * Function is executed as callback after all transitions are done in update method.
     *
     * @private
     */
    updateDone()
    {
        // Remove arc if segments should be hidden
        if (this.options.hideEmptySegments) {
            this.svg
                .selectAll("g.person.remove")
                .selectAll("g.arc")
                .remove();
        }

        // Remove styles so CSS classes may work correct, Uses a small timer as animation seems not
        // to be done already if the point is reached
        let t = d3.timer(() => {
            this.svg
                .selectAll("g.person g.arc path")
                .attr("style", null);

            this.svg
                .selectAll("g.person g.label")
                .style("opacity", null);

            t.stop();
        }, 10);

        this.svg
            .selectAll("g.person.new, g.person.update, g.person.remove")
            .classed("new", false)
            .classed("update", false)
            .classed("remove", false)
            .selectAll("g.label.old, title.old")
            .remove();

        this.svg
            .selectAll("g.colorGroup:not(.new)")
            .remove();

        this.svg
            .selectAll("g.colorGroup.new")
            .classed("new", false);

        this.svg
            .selectAll("g.person.available")
            .classed("available", false);

        // Add click handler after all transitions are done
        let click = new Click(this.config, this.options, this.hierarchy);
        click.bindClickEventListener();
    }

    /**
     * Helper method to execute callback method after all transitions are done of a selection.
     *
     * @param {Object}   transition D3 transition object
     * @param {Function} callback   Callback method
     *
     * @private
     */
    endall(transition, callback)
    {
        let n = 0;

        transition
            .on("start", () => ++n)
            .on("end", () => {
                if (!--n) {
                    callback.apply(transition);
                }
            });
    }
}
