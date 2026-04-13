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
 * Handles the animated transition when the chart re-centers on a new individual.
 * Fetches new hierarchy data via AJAX, classifies each person and marriage element
 * as "new", "update", or "remove", then runs a cross-fade transition that fades
 * out stale arcs and labels while fading in replacements. Cleans up orphaned
 * path and clip-path definitions after the transition completes.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Update {
    /**
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Hierarchy}     hierarchy
     */
    constructor(svg, configuration, hierarchy) {
        this._svg = svg;
        this._configuration = configuration;
        this._hierarchy = hierarchy;
    }

    /**
     * Loads new hierarchy data from the given URL, classifies DOM elements,
     * runs the cross-fade transition, and invokes callbacks when done. The
     * redrawOverlays callback is called mid-transition to swap separator lines;
     * the callback is called after all transitions settle and cleanup is complete.
     *
     * @param {string}   url            The JSON endpoint for the new center individual
     * @param {Function} redrawOverlays Called before transition ends to redraw separator lines
     * @param {Function} callback       Called after all transitions finish and DOM is cleaned up
     */
    update(url, redrawOverlays, callback) {
        this._svg
            .selectAll("g.person")
            .classed("hover", false)
            .on("click", null)
            .on("mouseover", null)
            .on("mouseout", null);

        // Guard callback to prevent double-invocation from endAll + catch race
        let callbackFired = false;
        const onceCallback = () => {
            if (!callbackFired) {
                callbackFired = true;
                this.updateDone(callback);
            }
        };

        d3.json(
            url,
        ).then((data) => {
            // Update the page title if provided in response
            if (data.title) {
                // Update the page header with HTML content
                const pageTitle = document.querySelector(".wt-page-title");

                if (pageTitle) {
                    pageTitle.innerHTML = data.title;
                }

                // Update the browser tab title with text only (strip HTML tags)
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = data.title;
                document.title = tempDiv.textContent || tempDiv.innerText || "";
            }

            // Initialize the new loaded data
            this._hierarchy.init(data.data);

            // Compute family colors for all hierarchy nodes upfront
            // (must happen before person/marriage loops since marriage
            // arcs reference their children's familyColor)
            const familyColor = new FamilyColor(this._configuration);
            familyColor.setPartnerMidpoints(this._hierarchy.nodes);

            if (this._configuration.showFamilyColors) {
                this._hierarchy.nodes.forEach(
                    (datum) => datum.data.data.familyColor = familyColor.getColor(datum),
                );
            }

            // Alias for D3 .each(function() {}) callbacks that need both
            // the class instance (that) and the DOM element (this)
            const that = this;

            // Note: descendant marriage arcs are handled in drawDescendantMarriageArcs()
            // via redrawOverlayLayers(), using the same enter/exit/update pattern.

            // Flag all person elements which are subject to change.
            // Descendant person elements participate in the same data-join
            // as ancestors: matched desc elements become "update", unmatched
            // old ones become "remove", new ones get appended via enter().
            const personJoin = this._svg
                .select("g.personGroup")
                .selectAll("g.person")
                .data(this._hierarchy.nodes, (datum) => datum.id);

            // Process matched (update) elements
            personJoin
                .each(function (datum) {
                    const empty = datum.data.data.xref === "";
                    const person = d3.select(this);
                    const isDescendant = datum.depth < 0;

                    // Descendants are always treated as "new" because their
                    // arc geometry changes on every re-center (unlike ancestors
                    // whose partition positions are stable). Mark old content
                    // for fade-out including the arc itself.
                    // Empty partner arcs (unknown spouse) are kept, not removed.
                    if (isDescendant) {
                        person.selectAll("g.arc, g.name, g.color, g.image, title")
                            .classed("old", true);

                        const removeDescendant = empty && (datum.depth !== -1);

                        person.classed("remove", removeDescendant)
                            .classed("update", false)
                            .classed("new", !removeDescendant);
                    } else {
                        person.classed("remove", empty)
                            .classed("update", !empty && person.classed("available"))
                            .classed("new", !empty && !person.classed("available"));
                    }

                    if (!person.classed("new")) {
                        person.selectAll("g.name, g.color, g.image, title")
                            .classed("old", true);
                    }

                    new Person(that._svg, that._configuration, person, datum);
                });

            // Mark unmatched old elements for removal and flag ALL their
            // children (including arc) as "old" for fade-out
            personJoin.exit()
                .classed("remove", true)
                .selectAll("g.arc, g.name, g.color, g.image, title")
                .classed("old", true);

            // Create new person elements via enter() -- descendants always,
            // and ancestors that didn't have a DOM element before (e.g. when
            // hideEmptySegments filtered them out on the previous center person).
            personJoin.enter()
                .filter(
                    (datum) => (datum.data.data.xref !== "")
                        || !this._configuration.hideEmptySegments
                        || (datum.depth < 0),
                )
                .append("g")
                .attr("class", "person new")
                .attr("id", (datum) => "person-" + datum.id)
                .each(function (datum) {
                    const person = d3.select(this);

                    new Person(that._svg, that._configuration, person, datum);
                });

            // Flag all marriage elements which are subject to change (same pattern as persons)
            if (this._configuration.showParentMarriageDates) {
                const marriageNodes = this._hierarchy.nodes.filter(
                    datum => datum.children
                        && (datum.depth < (this._configuration.generations - 1)),
                );

                this._svg
                    .selectAll("g.marriage:not(.descendant)")
                    .data(marriageNodes, (datum) => datum.id)
                    .each(function (datum) {
                        const hasChildren = datum.children
                            && datum.children.some(child => child.data.data.xref !== "");

                        const empty = !hasChildren;
                        const marriage = d3.select(this);

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
                .selectAll("g.name:not(.old), g.color:not(.old), g.image:not(.old)")
                .style("opacity", 1e-6);

            this._svg
                .selectAll("g.marriage:not(.remove)")
                .selectAll("g.name:not(.old)")
                .style("opacity", 1e-6);

            this._svg
                .selectAll("g.separatorGroup line:not(.old)")
                .style("opacity", 1e-6);

            // Create transition instance
            const transition = d3.transition()
                .duration(this._configuration.updateDuration)
                .call(this.endAll, onceCallback);

            // Fade out removed arcs (person + marriage)
            this.fadeOutRemovedArcs(transition, "g.person.remove");
            this.fadeOutRemovedArcs(transition, "g.marriage.remove");

            // Fade in new arcs with family colors
            this.fadeInNewArcs(transition, "g.person", (datum) =>
                datum?.data?.data?.familyColor || null);
            this.fadeInNewArcs(transition, "g.marriage", (datum) =>
                FamilyColor.getMarriageColor(datum));

            // Transition family colors on updated arcs
            this.transitionUpdatedArcs(transition, "g.person", (datum) =>
                datum?.data?.data?.familyColor || null);
            this.transitionUpdatedArcs(transition, "g.marriage", (datum) =>
                FamilyColor.getMarriageColor(datum));

            // Fade out all old elements (including old descendant arcs)
            this._svg
                .selectAll("g.person.update, g.person.remove, g.person.new")
                .selectAll("g.arc.old, g.name.old, g.color.old, g.image.old")
                .transition(transition)
                .style("opacity", 1e-6);

            this._svg
                .selectAll("g.marriage.update, g.marriage.remove, g.marriage.new")
                .selectAll("g.arc.old, g.name.old")
                .transition(transition)
                .style("opacity", 1e-6);

            this._svg
                .selectAll("g.separatorGroup line.old")
                .transition(transition)
                .style("opacity", 1e-6);

            // Fade in all new elements (including new descendants)
            this._svg
                .selectAll("g.person:not(.remove)")
                .selectAll("g.name:not(.old), g.color:not(.old), g.image:not(.old)")
                .transition(transition)
                .style("opacity", 1);

            this._svg
                .selectAll("g.marriage:not(.remove)")
                .selectAll("g.name:not(.old)")
                .transition(transition)
                .style("opacity", 1);



            this._svg
                .selectAll("g.separatorGroup line:not(.old)")
                .transition(transition)
                .style("opacity", 1);
        }).catch((error) => {
            console.error("Fan chart update failed:", error);

            // Clean up stale CSS classes left by a partial update
            this._svg
                .selectAll("g.person, g.marriage")
                .classed("new", false)
                .classed("update", false)
                .classed("remove", false);

            // Restore interactivity via the once-guarded callback
            onceCallback();
        });
    }

    /**
     * Post-transition cleanup: removes empty arc paths (when hideEmptySegments
     * is set), strips inline transition styles, restores CSS-class-based family
     * colors, removes update/new/remove class flags, purges orphaned path and
     * clipPath definitions from SVG defs, and finally invokes the callback.
     *
     * @param {Function} callback Called after all cleanup is finished
     *
     * @private
     */
    updateDone(callback) {
        // Reset tooltip pinned state so mouseleave works on newly rendered arcs
        this._svg.div.property("active", false);

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
        d3.timeout(() => {
            this._svg.selectAll("g.person g.arc path").attr("style", null);
            this._svg.selectAll("g.marriage g.arc path").attr("style", null);

            this.restoreFamilyColors("g.person", (datum) =>
                datum?.data?.data?.familyColor || null);
            this.restoreFamilyColors("g.marriage", (datum) =>
                FamilyColor.getMarriageColor(datum));

            this._svg.selectAll("g.person g.name, g.person g.color, g.person g.image").style("opacity", null);
            this._svg.selectAll("g.marriage g.name").style("opacity", null);

        }, 10);

        this._svg
            .selectAll("g.person.new, g.person.update, g.person.remove")
            .classed("new", false)
            .classed("update", false)
            .classed("remove", false)
            .selectAll("g.arc.old, g.name.old, g.color.old, g.image.old, title.old")
            .remove();

        this._svg
            .selectAll("g.marriage.new, g.marriage.update, g.marriage.remove")
            .classed("new", false)
            .classed("update", false)
            .classed("remove", false)
            .selectAll("g.arc.old, g.name.old")
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

        // Remove orphaned clip paths from old images.
        // Build a Set of active clip IDs from visible images, then remove any
        // clipPath not in the set. Avoids O(n*m) document.querySelector per clipPath.
        const activeClipIds = new Set();

        this._svg
            .selectAll("image[clip-path]")
            .each(function () {
                const match = this.getAttribute("clip-path").match(/url\(#(.+)\)/);

                if (match) {
                    activeClipIds.add(match[1]);
                }
            });

        this._svg.defs.get()
            .selectAll("clipPath[id^='clip-image-']")
            .each(function () {
                if (!activeClipIds.has(this.id)) {
                    this.remove();
                }
            });

        // Remove completely empty person shells (no arc, no name).
        // These accumulate from exit elements whose content was removed.
        this._svg
            .select("g.personGroup")
            .selectAll("g.person")
            .filter(function () {
                const el = d3.select(this);

                return el.select("g.arc").empty()
                    && el.select("g.name").empty();
            })
            .remove();

        // Execute callback function after everything is done
        callback();
    }

    /**
     * Re-applies family colors on arc paths after clearing transition styles.
     *
     * @param {string}   groupSelector The group type selector (e.g. "g.person")
     * @param {Function} getColor      Extracts the color from a datum
     *
     * @private
     */
    restoreFamilyColors(groupSelector, getColor) {
        if (!this._configuration.showFamilyColors) {
            return;
        }

        this._svg
            .selectAll(groupSelector)
            .each(function () {
                const datum = d3.select(this).datum();

                if (!datum) {
                    return;
                }

                const color = getColor(datum);

                if (color) {
                    d3.select(this)
                        .select("g.arc path")
                        .style("fill", color);
                }
            });
    }

    /**
     * Fades out removed arc paths with a transition.
     *
     * @param {Transition} transition
     * @param {string}     selector   The group selector (e.g. "g.person.remove")
     *
     * @private
     */
    fadeOutRemovedArcs(transition, selector) {
        this._svg
            .selectAll(`${selector} g.arc path`)
            .transition(transition)
            .style("fill", () => this._configuration.hideEmptySegments ? null : "rgb(235, 235, 235)")
            .style("opacity", () => this._configuration.hideEmptySegments ? 1e-6 : null);
    }

    /**
     * Fades in new arc paths with their family color.
     *
     * @param {Transition} transition
     * @param {string}     groupSelector The group type selector (e.g. "g.person")
     * @param {Function}   getColor      Extracts the color from a datum
     *
     * @private
     */
    fadeInNewArcs(transition, groupSelector, getColor) {
        const config = this._configuration;

        this._svg
            .selectAll(`${groupSelector}.new g.arc path`)
            .each(function () {
                const datum = d3.select(this.closest(groupSelector)).datum();
                const color = config.showFamilyColors ? getColor(datum) : null;
                const target = color || "rgb(250, 250, 250)";

                d3.select(this)
                    .transition(transition)
                    .style("fill", target)
                    .style("opacity", () => config.hideEmptySegments ? 1 : null);
            });
    }

    /**
     * Transitions family colors on updated (existing) arc paths.
     *
     * @param {Transition} transition
     * @param {string}     groupSelector The group type selector (e.g. "g.person")
     * @param {Function}   getColor      Extracts the color from a datum
     *
     * @private
     */
    transitionUpdatedArcs(transition, groupSelector, getColor) {
        if (!this._configuration.showFamilyColors) {
            return;
        }

        this._svg
            .selectAll(`${groupSelector}.update g.arc path`)
            .each(function () {
                const datum = d3.select(this.closest(groupSelector)).datum();
                const color = getColor(datum);

                if (color) {
                    d3.select(this)
                        .transition(transition)
                        .style("fill", color);
                }
            });
    }

    /**
     * Calls callback once after every pending transition in the selection has
     * either ended or been interrupted. If no transitions were scheduled (empty
     * selection), the callback fires asynchronously on the next event-loop tick
     * so callers can always assume async delivery.
     *
     * @param {Transition} transition The D3 transition to monitor
     * @param {Function}   callback   Invoked with the transition as `this` when all transitions settle
     *
     * @private
     */
    endAll(transition, callback) {
        let activeCount = 0;
        let started = false;

        const onComplete = () => {
            if (!--activeCount) {
                callback.apply(transition);
            }
        };

        transition
            .on("start", () => {
                started = true;
                ++activeCount;
            })
            .on("end", onComplete)
            .on("interrupt", onComplete);

        // Fire callback if no transitions were started (empty selection).
        // setTimeout defers to after the current event-loop tick so D3
        // has had a chance to schedule any transitions first.
        setTimeout(() => {
            if (!started) {
                callback.apply(transition);
            }
        }, 0);
    }
}
