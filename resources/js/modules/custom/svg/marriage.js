/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";
import {appendArc} from "./arc";
import Geometry from "./geometry";
import FamilyColor from "./family-color";
import {SYMBOL_MARRIAGE} from "../hierarchy";

/**
 * Renders the thin arc that sits in the radial gap between a parent generation
 * and its parents, showing the marriage date of the couple. The arc fills the
 * space between outerRadius(depth) and innerRadius(depth+1). Text is rendered
 * along the arc mid-radius and flipped in the bottom half of 360° charts.
 * Mirrors the lifecycle pattern of the Person class (new / update / remove
 * CSS class classification).
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Marriage {
    /**
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Selection}     marriage       The <g class="marriage"> D3 selection
     * @param {Object}        datum          The D3 partition datum for the parent node
     */
    constructor(svg, configuration, marriage, datum) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = new Geometry(this._configuration);

        this.init(marriage, datum);
    }

    /**
     * Decides which elements to create based on the lifecycle state (new /
     * update / remove). Skips arc creation for elements being updated (the
     * existing arc is reused) and skips label creation for elements being removed.
     * Returns early for outer generations when names are disabled.
     *
     * @param {Selection} marriage The <g class="marriage"> D3 selection
     * @param {Object}    datum    The D3 partition datum
     */
    init(marriage, datum) {
        // Hide marriage arcs for outer generations when names are disabled
        if (!this._configuration.showNames
            && (datum.depth >= this._configuration.numberOfInnerCircles)
        ) {
            return;
        }

        const hasChildren = datum.children
            && datum.children.some(child => child.data.data.xref !== "");

        const isNew = marriage.classed("new");
        const isUpdate = marriage.classed("update");
        const isRemove = marriage.classed("remove");

        if (isNew && this._configuration.hideEmptySegments) {
            this.addArc(marriage, datum);
        } else if (!isNew && !isUpdate && !isRemove
            && (hasChildren || !this._configuration.hideEmptySegments)
        ) {
            this.addArc(marriage, datum);
        }

        if (!isRemove) {
            this.addLabel(marriage, datum);
        }
    }

    /**
     * Builds the d3.arc() generator for the gap between outerRadius(depth)
     * and innerRadius(depth+1) and delegates rendering to appendArc(). Skips
     * if an arc already exists (update path reuse) or if the gap is zero or
     * negative.
     *
     * @param {Selection} marriage The <g class="marriage"> D3 selection
     * @param {Object}    datum    The D3 partition datum
     *
     * @private
     */
    addArc(marriage, datum) {
        // Reuse existing arc if present (during updates)
        if (!marriage.select("g.arc").empty()) {
            return;
        }

        const innerR = this._geometry.outerRadius(datum.depth);
        const outerR = this._geometry.innerRadius(datum.depth + 1);

        if (outerR <= innerR) {
            return;
        }

        const startAngle = (datum.depth < 1)
            ? this._geometry.calcAngle(datum.x0)
            : this._geometry.startAngle(datum.depth, datum.x0);

        const endAngle = (datum.depth < 1)
            ? this._geometry.calcAngle(datum.x1)
            : this._geometry.endAngle(datum.depth, datum.x1);

        const arcGenerator = d3.arc()
            .startAngle(startAngle)
            .endAngle(endAngle)
            .innerRadius(innerR)
            .outerRadius(outerR)
            .padAngle(0)
            .padRadius(0)
            .cornerRadius(this._configuration.cornerRadius);

        appendArc(marriage, arcGenerator, FamilyColor.getMarriageColor(datum));
    }

    /**
     * Appends a text label showing the marriage symbol and date along the arc
     * mid-radius. Creates a <path> in SVG defs keyed by a unique ID so old
     * and new labels can cross-fade at their respective positions during updates.
     * Truncates the date string with an ellipsis if it overflows the arc length.
     * No-ops when the datum has no marriageDateOfParents or the arc gap is zero.
     *
     * @param {Selection} marriage The <g class="marriage"> D3 selection
     * @param {Object}    datum    The D3 partition datum
     *
     * @private
     */
    addLabel(marriage, datum) {
        if (!datum.data.data.marriageDateOfParents) {
            return;
        }

        const innerR = this._geometry.outerRadius(datum.depth);
        const outerR = this._geometry.innerRadius(datum.depth + 1);

        if (outerR <= innerR) {
            return;
        }

        const startAngle = (datum.depth < 1)
            ? this._geometry.calcAngle(datum.x0)
            : this._geometry.startAngle(datum.depth, datum.x0);

        const endAngle = (datum.depth < 1)
            ? this._geometry.calcAngle(datum.x1)
            : this._geometry.endAngle(datum.depth, datum.x1);

        const midRadius = (innerR + outerR) / 2;

        // Flip text direction in the bottom half of 360° charts
        // so marriage dates read left-to-right like person labels
        const flipped = this._geometry.isPositionFlipped(datum.depth, datum.x0, datum.x1);

        const textPathGenerator = d3.arc()
            .startAngle(flipped ? endAngle : startAngle)
            .endAngle(flipped ? startAngle : endAngle)
            .innerRadius(midRadius)
            .outerRadius(midRadius);

        const marriageId = marriage.attr("id");
        let pathId = "path-" + marriageId;

        // During updates, old text still references the old path definition.
        // Create a new path with a unique ID so old and new text render at
        // their respective positions during the cross-fade.
        if (this._svg.defs.select("path#" + pathId).node()) {
            pathId += "-" + marriage.selectAll("g.name").size();
        }

        this._svg.defs
            .append("path")
            .attr("id", pathId)
            .attr("d", textPathGenerator);

        const labelGroup = marriage
            .append("g")
            .attr("class", "name")
            .style("font-size", this.getFontSize(datum) + "px");

        // Hide immediately during updates to prevent visual flash
        if (marriage.classed("update")) {
            labelGroup.style("opacity", 1e-6);
        }

        const text = labelGroup
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central");

        const textPath = text
            .append("textPath")
            .attr("href", "#" + pathId)
            .attr("startOffset", "25%")
            .attr("class", "date");

        const marriageText = (datum.data.data.marriageDateOfParents === "?")
            ? SYMBOL_MARRIAGE
            : SYMBOL_MARRIAGE + " " + datum.data.data.marriageDateOfParents;

        const tspan = textPath
            .append("tspan")
            .text(marriageText);

        // Truncate if text overflows the arc (with padding on both sides)
        const arcLength = ((endAngle - startAngle) * midRadius) - 24;

        if (tspan.node().getComputedTextLength() > arcLength) {
            let label = tspan.text();

            while ((tspan.node().getComputedTextLength() > arcLength) && (label.length > 1)) {
                label = label.slice(0, -1).trim();
                tspan.text(label);
            }

            // Remove trailing dot if present
            if (label[label.length - 1] === ".") {
                label = label.slice(0, -1).trim();
            }

            tspan.text(label + "\u2026");
        }
    }

    /**
     * Returns the font size for the marriage label. Uses depth+1 because the
     * marriage arc occupies the gap that visually belongs to the parent
     * generation, so the text should match parent-generation sizing.
     *
     * @param {Object} datum The D3 partition datum
     *
     * @return {number}
     *
     * @private
     */
    getFontSize(datum) {
        return this._geometry.getFontSize(
            Object.assign({}, datum, { depth: datum.depth + 1 }),
        );
    }
}
