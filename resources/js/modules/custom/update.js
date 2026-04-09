/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../lib/d3";
import Person from "./svg/person";
import Marriage from "./svg/marriage";
import FamilyColor from "./svg/family-color";

/**
 * This class handles the visual update of all text and path elements.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Update
{
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Hierarchy}     hierarchy
     */
    constructor(svg, configuration, hierarchy)
    {
        this._svg           = svg;
        this._configuration = configuration;
        this._hierarchy     = hierarchy;
    }

    /**
     * Update the chart with data loaded from AJAX.
     *
     * @param {string}   url      The update URL
     * @param {Function} callback The callback method to execute after the update
     *
     * @public
     */
    update(url, redrawOverlays, callback)
    {
        let that = this;

        this._svg
            .selectAll("g.person")
            .classed("hover", false)
            .on("click", null)
            .on("mouseover", null)
            .on("mouseout", null);

        d3.json(
            url
        ).then((data) => {
            // Update the page title if provided in response
            if (data.title) {
                // Update the page header with HTML content
                const pageTitle = document.querySelector('.wt-page-title');

                if (pageTitle) {
                    pageTitle.innerHTML = data.title;
                }

                // Update the browser tab title with text only (strip HTML tags)
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.title;
                document.title = tempDiv.textContent || tempDiv.innerText || '';
            }

            // Initialize the new loaded data
            this._hierarchy.init(data.data);

            // Compute family colors for all hierarchy nodes upfront
            // (must happen before person/marriage loops since marriage
            // arcs reference their children's familyColor)
            let familyColor = new FamilyColor(this._configuration);

            if (this._configuration.showFamilyColors) {
                this._hierarchy.nodes.forEach(
                    (datum) => datum.data.data.familyColor = familyColor.getColor(datum)
                );
            }

            // Flag all person elements which are subject to change
            this._svg
                .selectAll("g.person")
                .data(this._hierarchy.nodes, (datum) => datum.id)
                .each(function (datum) {
                    let empty  = datum.data.data.xref === "";
                    let person = d3.select(this);

                    person.classed("remove", empty)
                        .classed("update", !empty && person.classed("available"))
                        .classed("new", !empty && !person.classed("available"));

                    if (!person.classed("new")) {
                        person.selectAll("g.name, g.color, title")
                            .classed("old", true);
                    }

                    new Person(that._svg, that._configuration, person, datum);
                });

            // Flag all marriage elements which are subject to change (same pattern as persons)
            if (this._configuration.showParentMarriageDates) {
                let marriageNodes = this._hierarchy.nodes.filter(
                    datum => datum.children
                        && datum.depth < this._configuration.generations - 1
                );

                this._svg
                    .selectAll("g.marriage")
                    .data(marriageNodes, (datum) => datum.id)
                    .each(function (datum) {
                        let hasChildren = datum.children
                            && datum.children.some(child => child.data.data.xref !== "");

                        let empty = !hasChildren;
                        let marriage = d3.select(this);

                        marriage.classed("remove", empty)
                            .classed("update", !empty && marriage.classed("available"))
                            .classed("new", !empty && !marriage.classed("available"));

                        if (!marriage.classed("new")) {
                            marriage.selectAll("g.name")
                                .classed("old", true);
                        }

                        new Marriage(that._svg, that._configuration, marriage, datum);
                    });
            }

            // Mark old separator lines + draw new ones
            redrawOverlays();

            // Hide all new elements
            this._svg
                .selectAll("g.person:not(.remove)")
                .selectAll("g.name:not(.old), g.color:not(.old)")
                .style("opacity", 1e-6);

            this._svg
                .selectAll("g.marriage:not(.remove)")
                .selectAll("g.name:not(.old)")
                .style("opacity", 1e-6);

            this._svg
                .selectAll("g.separatorGroup line:not(.old)")
                .style("opacity", 1e-6);

            // Create transition instance
            let t = d3.transition()
                .duration(this._configuration.updateDuration)
                .call(this.endAll, () => this.updateDone(callback));

            // Fade out removed person arcs
            this._svg
                .selectAll("g.person.remove g.arc path")
                .transition(t)
                .style("fill", () => this._configuration.hideEmptySegments ? null : "rgb(235, 235, 235)")
                .style("opacity", () => this._configuration.hideEmptySegments ? 1e-6 : null);

            this._svg
                .selectAll("g.marriage.remove g.arc path")
                .transition(t)
                .style("fill", () => this._configuration.hideEmptySegments ? null : "rgb(235, 235, 235)")
                .style("opacity", () => this._configuration.hideEmptySegments ? 1e-6 : null);

            // Fade in new person arcs (fill + opacity in one transition
            // so D3 does not replace a prior transition on the same element)
            this._svg
                .selectAll("g.person.new g.arc path")
                .each(function () {
                    let person = d3.select(this.closest("g.person"));
                    let datum  = person.datum();
                    let target = (that._configuration.showFamilyColors && datum && datum.data.data.familyColor)
                        ? datum.data.data.familyColor
                        : "rgb(250, 250, 250)";

                    d3.select(this)
                        .transition(t)
                        .style("fill", target)
                        .style("opacity", () => that._configuration.hideEmptySegments ? 1 : null);
                });

            // Transition family colors on updated (existing) arcs
            if (this._configuration.showFamilyColors) {
                this._svg
                    .selectAll("g.person.update g.arc path")
                    .each(function () {
                        let datum = d3.select(this.closest("g.person")).datum();

                        if (datum && datum.data.data.familyColor) {
                            d3.select(this)
                                .transition(t)
                                .style("fill", datum.data.data.familyColor);
                        }
                    });
            }

            // Fade in new marriage arcs
            this._svg
                .selectAll("g.marriage.new g.arc path")
                .each(function () {
                    let datum  = d3.select(this.closest("g.marriage")).datum();
                    let color  = that._configuration.showFamilyColors
                        ? FamilyColor.getMarriageColor(datum)
                        : null;
                    let target = color || "rgb(250, 250, 250)";

                    d3.select(this)
                        .transition(t)
                        .style("fill", target)
                        .style("opacity", () => that._configuration.hideEmptySegments ? 1 : null);
                });

            // Transition family colors on updated marriage arcs
            if (this._configuration.showFamilyColors) {
                this._svg
                    .selectAll("g.marriage.update g.arc path")
                    .each(function () {
                        let datum = d3.select(this.closest("g.marriage")).datum();
                        let color = FamilyColor.getMarriageColor(datum);

                        if (color) {
                            d3.select(this)
                                .transition(t)
                                .style("fill", color);
                        }
                    });
            }

            // Fade out all old elements
            this._svg
                .selectAll("g.person.update, g.person.remove")
                .selectAll("g.name.old, g.color.old")
                .transition(t)
                .style("opacity", 1e-6);

            this._svg
                .selectAll("g.marriage.update, g.marriage.remove")
                .selectAll("g.name.old")
                .transition(t)
                .style("opacity", 1e-6);

            this._svg
                .selectAll("g.separatorGroup line.old")
                .transition(t)
                .style("opacity", 1e-6);

            // Fade in all new elements
            this._svg
                .selectAll("g.person:not(.remove)")
                .selectAll("g.name:not(.old), g.color:not(.old)")
                .transition(t)
                .style("opacity", 1);

            this._svg
                .selectAll("g.marriage:not(.remove)")
                .selectAll("g.name:not(.old)")
                .transition(t)
                .style("opacity", 1);

            this._svg
                .selectAll("g.separatorGroup line:not(.old)")
                .transition(t)
                .style("opacity", 1);
        });
    }

    /**
     * Function is executed as callback after all transitions are done in update method.
     *
     * @param {Function} callback The callback method to execute after the update
     *
     * @private
     */
    updateDone(callback)
    {
        // Remove arc if segments should be hidden
        if (this._configuration.hideEmptySegments) {
            this._svg
                .selectAll("g.person.remove")
                .selectAll("g.arc")
                .remove();

            this._svg
                .selectAll("g.marriage.remove")
                .selectAll("g.arc")
                .remove();
        }

        // Remove styles so CSS classes may work correct, Uses a small timer as animation seems not
        // to be done already if the point is reached
        let t = d3.timer(() => {
            this._svg
                .selectAll("g.person g.arc path")
                .attr("style", null);

            // Re-apply family-branch colors after clearing transition styles
            if (this._configuration.showFamilyColors) {
                this._svg
                    .selectAll("g.person")
                    .each(function () {
                        let datum = d3.select(this).datum();

                        if (datum && datum.data.data.familyColor) {
                            d3.select(this)
                                .select("g.arc path")
                                .style("fill", datum.data.data.familyColor);
                        }
                    });
            }

            this._svg
                .selectAll("g.person g.name, g.person g.color")
                .style("opacity", null);

            this._svg
                .selectAll("g.marriage g.arc path")
                .attr("style", null);

            // Re-apply parents' family colors on marriage arcs
            if (this._configuration.showFamilyColors) {
                this._svg
                    .selectAll("g.marriage")
                    .each(function () {
                        let datum = d3.select(this).datum();
                        let color = FamilyColor.getMarriageColor(datum);

                        if (color) {
                            d3.select(this)
                                .select("g.arc path")
                                .style("fill", color);
                        }
                    });
            }

            this._svg
                .selectAll("g.marriage g.name")
                .style("opacity", null);

            t.stop();
        }, 10);

        this._svg
            .selectAll("g.person.new, g.person.update, g.person.remove")
            .classed("new", false)
            .classed("update", false)
            .classed("remove", false)
            .selectAll("g.name.old, g.color.old, title.old")
            .remove();

        this._svg
            .selectAll("g.marriage.new, g.marriage.update, g.marriage.remove")
            .classed("new", false)
            .classed("update", false)
            .classed("remove", false)
            .selectAll("g.name.old")
            .remove();

        this._svg
            .selectAll("g.person.available")
            .classed("available", false);

        this._svg
            .selectAll("g.marriage.available")
            .classed("available", false);

        this._svg
            .selectAll("g.marriage.empty")
            .classed("empty", false);

        this._svg
            .selectAll("g.separatorGroup line.old")
            .remove();

        this._svg
            .selectAll("g.separatorGroup line")
            .style("opacity", null);

        // Remove orphaned path definitions (both person and marriage paths)
        this._svg.defs.get()
            .selectAll("path[id^='path-person-'], path[id^='path-marriage-']")
            .each(function () {
                if (!document.querySelector("textPath[href='#" + this.id + "']")) {
                    this.remove();
                }
            });

        // Execute callback function after everything is done
        callback();
    }

    /**
     * Helper method to execute callback method after all transitions are done of a selection.
     *
     * @param {Transition} transition D3 transition object
     * @param {Function}   callback   Callback method
     *
     * @private
     */
    endAll(transition, callback)
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
