/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "./d3";
import {Gradient} from "./gradient";
import {Hierarchy} from "./hierarchy";
import {Click} from "./arc/click";

/**
 * Class handling all the text and path elements.
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

        // super(config, options, hierarchy);

        this.svg       = this.config.svg;
        this.gradient  = new Gradient(this.config, this.options);
    }

    /**
     * Update the chart with data loaded from AJAX.
     *
     * @param {Object} d D3 data object
     */
    update(d)
    {
        let self = this;

        this.svg
            .selectAll("g.person")
            .on("click", null);

        d3.json(
            this.options.updateUrl + d.data.xref
        ).then(function (data) {
            // Initialize the new loaded data
            // initData(data);
            // let hierarchy = new Hierarchy(rso.options);
            self.hierarchy.init(data);

            // Flag all elements which are subject to change
            self.svg
                .selectAll("g.person")
                .data(self.hierarchy.getNodes())
                .each(function (entry) {
                    let person = d3.select(this);

                    person.classed("remove", entry.data.xref === "")
                        .classed("update", (entry.data.xref !== "") && person.classed("available"))
                        .classed("new", (entry.data.xref !== "") && !person.classed("available"));

                    if (!person.classed("new")) {
                        person.selectAll("g.label, title")
                            .classed("old", true);
                    }

                    self.addPersonData(person, entry);
                });

            // Hide all new labels of not removed elements
            self.svg
                .selectAll("g.person:not(.remove)")
                .selectAll("g.label:not(.old)")
                .style("opacity", 0);

            self.gradient.addColorGroup(self.hierarchy)
                .classed("new", true);

            // Create transition instance
            let t = d3.transition()
                .duration(self.options.updateDuration)
                .call(self.endall, function () {
                    self.updateDone();
                });

            // Fade out old arc
            self.svg
                .selectAll("g.person.remove g.arc path")
                .transition(t)
                .style("fill", function () {
                    return self.options.hideEmptySegments ? null : "rgb(240, 240, 240)";
                })
                .style("opacity", function () {
                    return self.options.hideEmptySegments ? 0 : null;
                });

            // Fade in new arcs
            self.svg
                .selectAll("g.person.new g.arc path")
                .transition(t)
                .style("fill", "rgb(250, 250, 250)")
                .style("opacity", function () {
                    return self.options.hideEmptySegments ? 1 : null;
                });

            // Fade out all old labels and color group
            self.svg
                .selectAll("g.person.update g.label.old, g.person.remove g.label.old, g.colorGroup:not(.new)")
                .transition(t)
                .style("opacity", 0);

            // Fade in all new labels and color group
            self.svg
                .selectAll("g.person:not(.remove) g.label:not(.old), g.colorGroup.new")
                .transition(t)
                .style("opacity", 1);
        });
    }

    /**
     * Function is executed as callback after all transitions are done in update method.
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
        let t = d3.timer(function () {
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
        // self.bindClickEventListener();

        let click = new Click(this.config, this.options, this.hierarchy);
        click.bindClickEventListener();
    }

    /**
     * Helper method to execute callback method after all transitions are done
     * of a selection.
     *
     * @param {Object}   transition D3 transition object
     * @param {Function} callback   Callback method
     */
    endall(transition, callback)
    {
        let n = 0;

        transition
            .on("start", function () {
                ++n;
            })
            .on("end", function () {
                if (!--n) {
                    callback.apply(transition);
                }
            });
    }
}
