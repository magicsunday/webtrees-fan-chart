/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../d3.js";
import { appendArc } from "./arc.js";
import { createMarriageArcGenerator } from "./arc-factory.js";
import FamilyColor from "./family-color.js";
import { SYMBOL_MARRIAGE } from "../hierarchy.js";
import { classifyElement } from "./lifecycle.js";
import { truncateToFit } from "@magicsunday/webtrees-chart-lib";

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
     * @param {Geometry}      geometry      Shared geometry instance for this render pass
     * @param {Selection}     marriage      The <g class="marriage"> D3 selection
     * @param {Object}        datum         The D3 partition datum for the parent node
     */
    constructor(svg, configuration, geometry, marriage, datum) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = geometry;

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
        if (
            !this._configuration.showNames &&
            datum.depth >= this._configuration.numberOfInnerCircles
        ) {
            return;
        }

        const isDescendant = datum.depth < 0;
        const hasChildren = datum.children?.some((child) => child.data.data.xref !== "");

        const { isNew, isUpdate, isRemove } = classifyElement(marriage);

        // All visual content goes into a <g class="content"> wrapper so the
        // update lifecycle can fade old/new content as a single unit.
        const content = marriage.append("g").attr("class", "content");

        if (isNew && this._configuration.hideEmptySegments) {
            this.addArc(content, datum);
        } else if (isUpdate) {
            // Arc geometry changes on re-center (partition positions shift).
            // The old content is marked .old, so addArc() will rebuild it.
            this.addArc(content, datum);
        } else if (
            !isNew &&
            !isRemove &&
            (hasChildren || !this._configuration.hideEmptySegments || isDescendant)
        ) {
            this.addArc(content, datum);
        }

        if (!isRemove) {
            this.addLabel(content, datum);
        }
    }

    /**
     * Resolves the radial and angular geometry for a marriage arc.
     *
     * @param {Object} datum The D3 partition datum
     *
     * @return {{ innerR: number, outerR: number, startAngle: number, endAngle: number }}
     *
     * @private
     */
    _resolveMarriageGeometry(datum) {
        if (datum.depth < 0) {
            return {
                innerR: this._geometry.outerRadius(0),
                outerR: this._geometry.innerRadius(1),
                startAngle: this._geometry.startAngle(datum.depth, datum.x0),
                endAngle: this._geometry.endAngle(datum.depth, datum.x1),
            };
        }

        return {
            innerR: this._geometry.outerRadius(datum.depth),
            outerR: this._geometry.innerRadius(datum.depth + 1),
            startAngle:
                datum.depth < 1
                    ? this._geometry.calcAngle(datum.x0)
                    : this._geometry.startAngle(datum.depth, datum.x0),
            endAngle:
                datum.depth < 1
                    ? this._geometry.calcAngle(datum.x1)
                    : this._geometry.endAngle(datum.depth, datum.x1),
        };
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
        const { innerR, outerR, startAngle, endAngle } = this._resolveMarriageGeometry(datum);

        if (outerR <= innerR) {
            return;
        }

        const arcGenerator = createMarriageArcGenerator(this._configuration, {
            startAngle,
            endAngle,
            innerR,
            outerR,
        });

        const color =
            datum.depth < 0
                ? datum.data.data.familyColor || null
                : FamilyColor.getMarriageColor(datum);

        appendArc(marriage, arcGenerator, color);
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
        // Resolve the date text first — most arcs have no date, so we avoid
        // computing geometry entirely for those.
        const dateText =
            datum.depth < 0 ? datum.data.data.marriageDate : datum.data.data.marriageDateOfParents;

        if (!dateText) {
            return;
        }

        const { innerR, outerR, startAngle, endAngle } = this._resolveMarriageGeometry(datum);

        if (outerR <= innerR) {
            return;
        }

        const midRadius = (innerR + outerR) / 2;

        // Flip text direction in the bottom half of 360° charts
        // so marriage dates read left-to-right like person labels
        const flipped = this._geometry.isPositionFlipped(datum.depth, datum.x0, datum.x1);

        const textPathGenerator = d3
            .arc()
            .startAngle(flipped ? endAngle : startAngle)
            .endAngle(flipped ? startAngle : endAngle)
            .innerRadius(midRadius)
            .outerRadius(midRadius);

        // Get the marriage ID from the outer <g class="marriage"> element
        // (the parent parameter is the content wrapper which has no ID)
        const marriageNode = marriage.node().closest("g.marriage") || marriage.node();
        const marriageId = marriageNode.id || marriageNode.getAttribute?.("id") || "marriage-0";
        let pathId = `path-${marriageId}`;

        // During updates, old text still references the old path definition.
        // Create a new path with a unique ID so old and new text render at
        // their respective positions during the cross-fade.
        if (this._svg.defs.select(`path#${pathId}`).node()) {
            pathId += `-${Date.now()}`;
        }

        this._svg.defs.append("path").attr("id", pathId).attr("d", textPathGenerator);

        const labelGroup = marriage
            .append("g")
            .attr("class", "name")
            .style("font-size", `${this.getFontSize(datum)}px`);

        const text = labelGroup
            .append("text")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central");

        const textPath = text
            .append("textPath")
            .attr("href", `#${pathId}`)
            .attr("startOffset", "25%")
            .attr("class", "date");

        const marriageText = dateText === "?" ? SYMBOL_MARRIAGE : `${SYMBOL_MARRIAGE} ${dateText}`;

        const tspan = textPath.append("tspan").text(marriageText);

        // Truncate if text overflows the arc (with padding on both sides)
        const arcLength = (endAngle - startAngle) * midRadius - this._configuration.textPadding * 2;

        truncateToFit(tspan, arcLength);
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
            Object.assign({}, datum, { depth: Math.max(1, datum.depth + 1) }),
        );
    }
}
