/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "./d3.js";
import Hierarchy from "./hierarchy.js";
import { PanelSelection } from "@magicsunday/webtrees-chart-lib/chart-core";
import { ChartOverlay } from "@magicsunday/webtrees-chart-lib/infra";
import Svg from "./svg.js";
import Person from "./svg/person.js";
import Marriage from "./svg/marriage.js";
import Geometry from "./svg/geometry.js";
import { applyFamilyColorMode, isDrawnPerson, isMarriageParent } from "./draw-rules.js";
import ChartUpdater from "./chart-updater.js";
import { motionDuration } from "./motion.js";

/**
 * @import { Selection } from "d3-selection"
 * @import Configuration from "./configuration.js"
 * @import { HierarchyNode, NodeDatum } from "./hierarchy.js"
 * @import { DetailPanel, PanelPerson } from "@magicsunday/webtrees-chart-lib/chart-core"
 */

const MIN_PADDING = 1; // Minimum padding around view box in "rem"

/**
 * Returns the text that a person arc shows, one line per text element. The tspans carry the
 * visible text, a title next to them is only the tooltip of the same text.
 *
 * @param {unknown} node The person element
 *
 * @return {string} The visible lines joined by a space, empty if the arc shows no text
 */
function visibleText(node) {
    if (!(node instanceof Element)) {
        return "";
    }

    return Array.from(node.querySelectorAll("text"))
        .map((text) =>
            Array.from(text.querySelectorAll("tspan"))
                .map((tspan) => tspan.textContent ?? "")
                .join(" ")
                .trim(),
        )
        .filter((line) => line !== "")
        .join(" ");
}

/**
 * Orchestrates the full fan chart lifecycle: builds the SVG, populates person
 * and marriage arc groups from hierarchical data, draws separator lines between
 * family branches, and delegates AJAX-driven updates with animated transitions.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Chart {
    /**
     * @param {Selection<any, any, any, any>} parent        The selected D3 parent element container
     * @param {Configuration}                 configuration The application configuration
     */
    constructor(parent, configuration) {
        this._configuration = configuration;
        this._parent = parent;
        this._hierarchy = new Hierarchy(this._configuration);
        /** @type {NodeDatum|null} */
        this._data = null;
        /** @type {Svg|null} */
        this._svg = null;
        /** @type {ChartOverlay|null} */
        this._overlay = null;
        /** @type {DetailPanel|null} */
        this._detailPanel = null;
        /** @type {PanelSelection<any>} */
        this._selection = new PanelSelection(() => this._svg?.visual);
        /** @type {string|null} */
        this._selectedXref = null;

        // The panel can be closed while an update animates. The arcs hold no stable person then,
        // so what the closing asks for waits until the chart is bound again.
        this._runningUpdates = 0;
        this._focusPending = false;
        this._clearPending = false;
        /** @type {string|null} */
        this._keyboardFocusXref = null;
        /** @type {Element|null} */
        this._keyboardFocusSource = null;
    }

    /**
     * Sets the detail panel that shows the selected person.
     *
     * @param {DetailPanel|null} panel The detail panel
     */
    set detailPanel(panel) {
        this._detailPanel = panel;
    }

    /**
     * Returns the chart's SVG. Only available once render() has run.
     *
     * @return {Svg}
     */
    get svg() {
        if (this._svg === null) {
            throw new Error("Chart.svg is not available before render() has been called");
        }

        return this._svg;
    }

    /**
     * @return {Selection<any, any, any, any>}
     */
    get parent() {
        return this._parent;
    }

    /**
     * @return {NodeDatum|null}
     */
    get data() {
        return this._data;
    }

    /**
     * Assigns new chart data and rebuilds the D3 hierarchy from it.
     *
     * @param {NodeDatum} value The raw JSON data object from the server
     */
    set data(value) {
        this._data = value;

        // Create the hierarchical data structure
        this._hierarchy.init(this._data);
    }

    /**
     * Converts a rem value to pixels using the document root font size.
     *
     * @param {number} rem The value in rem units
     *
     * @return {number}
     *
     * @private
     */
    convertRemToPixels(rem) {
        return rem * parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    }

    /**
     * Computes viewBox coordinates from padding and bounding boxes.
     *
     * @param {number}  padding            Padding in pixels
     * @param {DOMRect} svgBoundingBox     Bounding box of the SVG visual group
     * @param {DOMRect} clientBoundingBox  Bounding box of the parent container
     *
     * @return {{ left: number, top: number, width: number, height: number }}
     *
     * @private
     */
    _computeViewBox(padding, svgBoundingBox, clientBoundingBox) {
        const viewBoxWidth = Math.max(clientBoundingBox.width, svgBoundingBox.width);
        const viewBoxHeight = Math.max(clientBoundingBox.height, svgBoundingBox.height);

        const offsetX = (viewBoxWidth - svgBoundingBox.width) / 2;
        const offsetY = (viewBoxHeight - svgBoundingBox.height) / 2;

        return {
            left: Math.ceil(svgBoundingBox.x - offsetX - padding),
            top: Math.ceil(svgBoundingBox.y - offsetY - padding),
            width: Math.ceil(viewBoxWidth + padding * 2),
            height: Math.ceil(viewBoxHeight + padding * 2),
        };
    }

    /**
     * Recalculates and sets the SVG viewBox so the chart fills its container
     * with a minimum 1 rem padding on every side. In fullscreen mode the SVG
     * dimensions are set to the full client area.
     */
    updateViewBox() {
        // Set width/height attributes
        this.svg.attr("width", "100%").attr("height", "100%");

        const padding = this.convertRemToPixels(MIN_PADDING);
        // Both selections hold exactly one element once render() has run
        const svgBoundingBox = /** @type {SVGGElement} */ (this.svg.visual.node()).getBBox();
        const clientBoundingBox = /** @type {HTMLElement} */ (
            this.parent.node()
        ).getBoundingClientRect();

        // In fullscreen mode, use the full available height
        if (document.fullscreenElement) {
            this.svg
                .attr("width", clientBoundingBox.width)
                .attr("height", clientBoundingBox.height);
        }

        const viewBox = this._computeViewBox(padding, svgBoundingBox, clientBoundingBox);

        // Set view box attribute
        this.svg.attr("viewBox", [viewBox.left, viewBox.top, viewBox.width, viewBox.height]);
    }

    /**
     * Smoothly transitions the SVG viewBox to fit the final chart content.
     * Temporarily hides elements marked for removal so getBBox() reflects only
     * the incoming content, then restores them for the fade-out transition.
     *
     * @private
     */
    transitionViewBox() {
        const padding = this.convertRemToPixels(MIN_PADDING);
        const clientBoundingBox = /** @type {HTMLElement} */ (
            this.parent.node()
        ).getBoundingClientRect();

        // Hide all outgoing content with display:none so getBBox measures
        // only the incoming chart. This includes:
        // - Top-level elements marked for removal (.remove)
        // - Old sub-elements within updating elements (.old)
        // - Old separator lines
        const outgoing = this.svg.visual.selectAll("g.person.remove, g.marriage.remove, .old");
        outgoing.style("display", "none");

        const svgBoundingBox = /** @type {SVGGElement} */ (this.svg.visual.node()).getBBox();

        // Restore for the fade-out transition
        outgoing.style("display", null);

        const viewBox = this._computeViewBox(padding, svgBoundingBox, clientBoundingBox);
        const newViewBox = [viewBox.left, viewBox.top, viewBox.width, viewBox.height].join(" ");

        /** @type {any} */ (this.svg)
            .transition("viewBox")
            .duration(motionDuration(this._configuration.updateDuration))
            .attr("viewBox", newViewBox);
    }

    /**
     * Animates the chart back to its initial zoom level and pan position
     * (identity transform).
     */
    center() {
        this.svg
            .transition()
            .duration(motionDuration(750))
            .call(this.svg.zoom.get().transform, d3.zoomIdentity);
    }

    /**
     * Performs the full initial render: creates the SVG and overlay, draws all
     * person arcs, marriage arcs, and family separator lines, then binds click
     * event listeners.
     */
    render() {
        // Remove previously created content
        this._parent.html("");

        // Create the <svg> element
        this._svg = new Svg(this._parent, this._configuration);

        // Overlay must be placed after the <svg> element
        this._overlay = new ChartOverlay(this._parent);

        // Init the <svg> events
        this.svg.initEvents(this._overlay);

        const personGroup = this.svg.select("g.personGroup");
        const geometry = new Geometry(this._configuration, this._hierarchy.descendantLayout);

        // Family colors are computed before the arcs are drawn, because the
        // marriage arcs reference the colors of their children.
        applyFamilyColorMode(this._hierarchy, this.svg.visual, this._configuration);

        personGroup
            .selectAll("g.person")
            .data(this._hierarchy.nodes, (datum) => datum.id)
            .enter()
            .filter((datum) => isDrawnPerson(datum, this._configuration))
            .append("g")
            .attr("class", "person")
            .attr("id", (datum) => `person-${datum.id}`);

        const svg = this.svg;
        const configuration = this._configuration;

        // Create a new selection in order to leave the previous enter() selection
        personGroup.selectAll("g.person").each((datum, i, nodes) => {
            const person = d3.select(/** @type {SVGGElement} */ (nodes[i]));

            new Person(svg, configuration, geometry, person, datum);
        });

        // Marriage arc layer (separate from persons so hover does not affect them)
        if (this._configuration.showParentMarriageDates) {
            this.drawMarriageArcs();
            this.drawDescendantMarriageArcs();
        }

        // Radial separator lines between family branches
        this.drawFamilySeparators();

        this.updateViewBox();
        this.bindClickEventListener();
    }

    /**
     * Draws radial separator lines between different family branches at each
     * generation level. Lines are drawn only between non-spouse segments (where
     * the parent differs).
     *
     * @private
     */
    drawFamilySeparators() {
        const geometry = new Geometry(this._configuration, this._hierarchy.descendantLayout);
        /** @type {Selection<SVGGElement, unknown, HTMLElement, unknown>} */
        let separatorGroup = this.svg.visual.select("g.separatorGroup");

        if (separatorGroup.empty()) {
            separatorGroup = this.svg.visual.append("g").attr("class", "separatorGroup");
        }

        const maxDepth = this._configuration.showNames
            ? this._configuration.generations
            : Math.min(this._configuration.generations, this._configuration.numberOfInnerCircles);

        this.drawDescendantSeparators(geometry, separatorGroup);

        for (let depth = 1; depth <= maxDepth; depth++) {
            const nodesAtDepth = this._hierarchy.nodes
                .filter((datum) => datum.depth === depth && datum.data.data.xref !== "")
                .sort((left, right) => left.x0 - right.x0);

            for (let i = 0; i < nodesAtDepth.length - 1; i++) {
                const current = nodesAtDepth[i];
                const next = nodesAtDepth[i + 1];

                if (current === undefined || next === undefined) {
                    continue;
                }

                // Only draw separator between different families
                if (current.parent !== next.parent) {
                    const angle = geometry.calcAngle(current.x1);

                    // Marriage arc below: between depth-1 and depth
                    const marriageBelow =
                        this._configuration.showParentMarriageDates &&
                        depth > 1 &&
                        depth - 1 < this._configuration.generations - 1 &&
                        (this._configuration.showNames ||
                            depth - 1 < this._configuration.numberOfInnerCircles);

                    // With marriage below: start at the marriage arc inner edge
                    // Without: start at the person arc inner edge
                    const innerR = marriageBelow
                        ? geometry.outerRadius(depth - 1)
                        : geometry.innerRadius(depth);

                    const outerR = geometry.outerRadius(depth);

                    separatorGroup
                        .append("line")
                        .attr("x1", innerR * Math.sin(angle))
                        .attr("y1", -innerR * Math.cos(angle))
                        .attr("x2", outerR * Math.sin(angle))
                        .attr("y2", -outerR * Math.cos(angle));
                }
            }
        }
    }

    /**
     * Draws separator lines between partner families in the descendant section.
     * Lines run from the marriage arc gap through the partner and children
     * rings.
     *
     * @param {Geometry}                      geometry
     * @param {Selection<any, any, any, any>} separatorGroup
     *
     * @private
     */
    drawDescendantSeparators(geometry, separatorGroup) {
        const childScale = geometry.childScale;

        if (!this._configuration.showDescendants || !childScale) {
            return;
        }

        const partnerNodes = this._hierarchy.nodes
            .filter((datum) => datum.depth === -1)
            .sort((left, right) => left.x0 - right.x0);

        const childNodes = this._hierarchy.nodes.filter((datum) => datum.depth === -2);

        for (let i = 0; i < partnerNodes.length - 1; i++) {
            const current = partnerNodes[i];
            const next = partnerNodes[i + 1];

            if (current === undefined || next === undefined) {
                continue;
            }

            const angle = childScale(current.x1);

            // Check whether the adjacent partners have children
            const currentHasChildren = childNodes.some((c) => c.syntheticParentId === current.id);
            const nextHasChildren = childNodes.some((c) => c.syntheticParentId === next.id);

            // Start at the marriage arc inner edge (outerRadius of center)
            const hasMarriage = this._configuration.showParentMarriageDates;
            const innerR = hasMarriage ? geometry.outerRadius(0) : geometry.innerRadius(-1);

            // Extend to children ring only if at least one adjacent partner has children,
            // otherwise stop at the partner ring outer edge
            const outerR =
                currentHasChildren || nextHasChildren
                    ? geometry.outerRadius(-2)
                    : geometry.outerRadius(-1);

            separatorGroup
                .append("line")
                .attr("x1", innerR * Math.sin(angle))
                .attr("y1", -innerR * Math.cos(angle))
                .attr("x2", outerR * Math.sin(angle))
                .attr("y2", -outerR * Math.cos(angle));
        }
    }

    /**
     * Draws marriage arcs in the gap between generations. Each arc spans the
     * angular range of a person who has parents shown in the chart. The arc is
     * always drawn (for visual consistency), and the marriage date text is
     * added when available.
     *
     * @private
     */
    drawMarriageArcs() {
        /** @type {Selection<SVGGElement, unknown, HTMLElement, unknown>} */
        let marriageGroup = this.svg.visual.select("g.marriageGroup");

        if (marriageGroup.empty()) {
            marriageGroup = this.svg.visual.append("g").attr("class", "marriageGroup");
        }

        // All nodes that have children and are within display range
        const nodes = this._hierarchy.nodes.filter((datum) =>
            isMarriageParent(datum, this._configuration),
        );

        // D3 data join: same pattern as person elements
        marriageGroup
            .selectAll("g.marriage")
            .data(nodes, (datum) => datum.id)
            .enter()
            .append("g")
            .attr("class", "marriage")
            .attr("id", (datum) => `marriage-${datum.id}`);

        const svg = this.svg;
        const configuration = this._configuration;
        const geometry = new Geometry(configuration, this._hierarchy.descendantLayout);

        // Create a new selection in order to leave the previous enter() selection
        marriageGroup.selectAll("g.marriage").each((datum, i, nodes) => {
            const marriage = d3.select(/** @type {SVGGElement} */ (nodes[i]));
            new Marriage(svg, configuration, geometry, marriage, datum);
        });
    }

    /**
     * Draws marriage arcs for descendant partners in the gap between the center
     * circle and the partner ring. Each partner gets an arc showing the
     * marriage date from the family record. Uses the childScale for angular
     * positioning.
     *
     * @private
     */
    drawDescendantMarriageArcs() {
        /** @type {Selection<SVGGElement, unknown, HTMLElement, unknown>} */
        let marriageGroup = this.svg.visual.select("g.marriageGroup");

        if (marriageGroup.empty()) {
            marriageGroup = this.svg.visual.append("g").attr("class", "marriageGroup");
        }

        // Empty array when descendants are disabled or no partners exist,
        // so the data-join still handles exit for old elements.
        const partnerNodes =
            this._configuration.showDescendants && this._hierarchy.descendantLayout.childScale
                ? this._hierarchy.nodes.filter((datum) => datum.depth === -1)
                : [];

        const marriageJoin = marriageGroup
            .selectAll("g.marriage.descendant")
            .data(partnerNodes, (datum) => datum.id);

        const svg = this.svg;
        const configuration = this._configuration;
        const geometry = new Geometry(configuration, this._hierarchy.descendantLayout);

        // Matched (update): mark old content for fade-out, create new content
        // (geometry changes on re-center so arcs must be rebuilt)
        marriageJoin.each((datum, i, nodes) => {
            const marriage = d3.select(/** @type {SVGGElement} */ (nodes[i]));

            marriage.selectAll("g.content").classed("old", true);

            marriage.classed("update", false).classed("new", true);

            new Marriage(svg, configuration, geometry, marriage, datum);
        });

        // Exiting: mark for removal
        marriageJoin.exit().classed("remove", true).selectAll("g.content").classed("old", true);

        // Entering: create new elements
        marriageJoin
            .enter()
            .append("g")
            .attr("class", "marriage descendant")
            .attr("id", (datum) => `marriage-${datum.id}`)
            .each((datum, i, nodes) => {
                const marriage = d3.select(/** @type {SVGGElement} */ (nodes[i]));
                new Marriage(svg, configuration, geometry, marriage, datum);
            });
    }

    /**
     * Marks all persons with a non-empty xref as "available" (enabling hover
     * styles) and binds the click handler. Also marks marriage arcs that have a
     * date as "available" and empty ones as "empty" for CSS styling.
     *
     * @private
     */
    bindClickEventListener() {
        // An update reuses the arcs, and an arc can turn into an empty placeholder, so the
        // keyboard bindings of the person it showed before are taken away from every arc first
        this.svg
            .select("g.personGroup")
            .selectAll("g.person")
            .attr("tabindex", null)
            .attr("role", null)
            .attr("aria-label", null)
            .on("keydown", null);

        const persons = this.svg
            .select("g.personGroup")
            .selectAll("g.person")
            .filter((datum) => datum?.data?.data?.xref !== "")
            .classed("available", true);

        // Persons that are not drawn have nothing to focus or to activate
        const drawn = persons.filter((datum) => this._configuration.isDrawn(datum.depth));

        // Trigger method on click/touch
        persons.on("click", this.personClick.bind(this));

        // A person is reached with the Tab key and activated with Enter or Space like a click,
        // with the detail panel as well as without it
        const that = this;

        drawn.each(function (/** @type {HierarchyNode} */ datum) {
            that._selection.makeOperable(d3.select(this), datum, (_data, byKeyboard) =>
                that.personClick(null, datum, byKeyboard),
            );

            // The library names the arc with the bare name, but the accessible name has to
            // contain the text that the arc shows (WCAG 2.5.3)
            const label = visibleText(this);

            if (label !== "") {
                d3.select(this).attr("aria-label", label);
            }
        });

        // Set available on marriage arcs that have content
        this.svg
            .select("g.marriageGroup")
            .selectAll("g.marriage")
            .filter(
                (datum) =>
                    datum?.data?.data?.marriageDateOfParents || datum?.data?.data?.marriageDate,
            )
            .classed("available", true);

        // Mark empty marriage arcs (no parents shown) for CSS styling
        this.svg
            .select("g.marriageGroup")
            .selectAll("g.marriage")
            .each(function (/** @type {HierarchyNode|undefined} */ datum) {
                if (!datum?.children) {
                    return;
                }

                const hasChildren = datum.children.some((child) => child.data.data.xref !== "");

                d3.select(this).classed("empty", !hasChildren);
            });

        // An update binds new hierarchy objects to the person elements, whether it draws them anew
        // or keeps them. The selection keeps the person it was made with, so the new object
        // of that person is handed to it, which keeps the mark and the focus return working.
        const selected =
            this._selectedXref === null
                ? undefined
                : persons.filter((datum) => datum.data.data.xref === this._selectedXref).data()[0];

        if (selected === undefined) {
            this._selection.apply();
        } else {
            this._selection.select(selected.data);
        }

        this._runningUpdates = Math.max(0, this._runningUpdates - 1);

        if (this._runningUpdates > 0) {
            return;
        }

        if (this._focusPending) {
            this._focusPending = false;
            this._selection.restoreFocus();
        }

        if (this._keyboardFocusXref !== null) {
            const xref = this._keyboardFocusXref;
            const source = this._keyboardFocusSource;

            this._keyboardFocusXref = null;
            this._keyboardFocusSource = null;

            // The focus is lost when the update removed the focused arc, and it is stale when the
            // arc stayed and now shows another person. A control that the user moved on to while
            // the update was running keeps the focus.
            const focusLost =
                document.activeElement === null ||
                document.activeElement === document.body ||
                document.activeElement === source;

            if (focusLost) {
                drawn
                    .filter((datum) => datum.data.data.xref === xref)
                    .each(function () {
                        /** @type {HTMLElement} */ (this).focus();
                    });
            }
        }

        if (this._clearPending) {
            this._clearPending = false;
            this.clearSelection();
        }
    }

    /**
     * Tells whether a person is selected, which means the panel shows it.
     *
     * @return {boolean}
     */
    get hasSelection() {
        return this._selectedXref !== null;
    }

    /**
     * Removes the selection, so no person stays marked once the panel has closed.
     */
    clearSelection() {
        if (this._runningUpdates > 0) {
            this._clearPending = true;

            return;
        }

        this._selectedXref = null;
        this._selection.clear();
    }

    /**
     * Gives the focus back to the selected person, if it is still in the chart.
     */
    restoreFocus() {
        if (this._runningUpdates > 0) {
            this._focusPending = true;

            return;
        }

        this._selection.restoreFocus();
    }

    /**
     * Handles a click on a person arc. With the detail panel the person is
     * selected and the panel offers both actions. Without it the center node
     * (depth 0) redirects to the individual page and every other node triggers
     * a chart update.
     *
     * @param {Event|null}    _event     The current event, null for a key
     * @param {HierarchyNode} datum      The D3 data object
     * @param {boolean}       byKeyboard Whether a key triggered the activation
     *
     * @private
     */
    personClick(_event, datum, byKeyboard = false) {
        // Empty partner nodes have no updateUrl -- ignore clicks on them
        if (datum.data.data.updateUrl === "") {
            return;
        }

        if (this._configuration.showDetailPanel && this._detailPanel !== null) {
            this._selectedXref = datum.data.data.xref;
            this._selection.select(datum.data);
            this._detailPanel.select(
                /** @type {PanelPerson} */ (/** @type {unknown} */ (datum.data.data)),
                byKeyboard,
            );

            return;
        }

        // The arcs are drawn again by an update, so the focus of a key press would be lost with the
        // old arc. It is given to the arc of the same person once the chart is bound again. The
        // center person opens its page and draws nothing, and a click of the mouse withdraws the
        // request of an earlier key press.
        this._keyboardFocusXref = byKeyboard && datum.depth !== 0 ? datum.data.data.xref : null;
        this._keyboardFocusSource =
            this._keyboardFocusXref === null ? null : document.activeElement;

        // Trigger either "update" or "redirectToIndividual" method on click depending on person in chart
        datum.depth === 0
            ? this.redirectToIndividual(datum.data.data.url)
            : this.update(datum.data.data.updateUrl);
    }

    /**
     * Opens the webtrees individual page in a new tab.
     *
     * @param {string} url The individual page URL
     */
    redirectToIndividual(url) {
        window.open(url, "_blank");
    }

    /**
     * Fetches new hierarchy data for the given individual URL and animates the
     * chart transition, then redraws overlay layers and rebinds events.
     *
     * @param {string} url The update URL for the new center individual
     */
    update(url) {
        // The updater takes the mouse handlers of the old persons away. The key handlers of the
        // detail panel hold the old person as well, and the arcs show other persons while the
        // animation runs, so they go too and are bound again with the new drawing.
        this.svg.select("g.personGroup").selectAll("g.person").on("keydown", null);

        // The mark would stay on the arc while it shows another person. It is set again when
        // the chart is bound to the new drawing.
        this.svg
            .select("g.personGroup")
            .selectAll("g.person")
            .classed("selected", false)
            .attr("aria-current", null);
        this._runningUpdates += 1;

        const updater = new ChartUpdater(this.svg, this._configuration, this._hierarchy);

        updater.update(
            url,
            () => this.redrawOverlayLayers(),
            () => this.bindClickEventListener(),
        );
    }

    /**
     * Marks existing separator lines as "old" (for fade-out) and draws the
     * separator lines for the incoming hierarchy. Called from Update.update()
     * before the transition starts so old and new lines can cross-fade.
     *
     * @private
     */
    redrawOverlayLayers() {
        // Separators: mark old, draw new
        this.svg.visual.selectAll("g.separatorGroup line").classed("old", true);

        this.drawFamilySeparators();

        // Redraw descendant marriage arcs
        if (this._configuration.showParentMarriageDates) {
            this.drawDescendantMarriageArcs();
        }

        // Smoothly transition the viewBox alongside the arc transitions
        this.transitionViewBox();
    }
}
