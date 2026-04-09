/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";
import Geometry from "./geometry";
import FamilyColor from "./family-color";
import {SYMBOL_MARRIAGE} from "../hierarchy";

/**
 * This class handles the creation of the marriage arc elements of the chart.
 * It follows the same structure as the Person class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Marriage {
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Selection}     marriage
     * @param {Object}        datum
     */
    constructor(svg, configuration, marriage, datum) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = new Geometry(this._configuration);

        this.init(marriage, datum);
    }

    /**
     * Initialize the required elements.
     *
     * @param {Selection} marriage
     * @param {Object}    datum
     */
    init(marriage, datum) {
        const hasChildren = datum.children
            && datum.children.some(child => child.data.data.xref !== "");

        if (marriage.classed("new") && this._configuration.hideEmptySegments) {
            this.addArc(marriage, datum);
        } else {
            if (!marriage.classed("new")
                && !marriage.classed("update")
                && !marriage.classed("remove")
                && (hasChildren || !this._configuration.hideEmptySegments)
            ) {
                this.addArc(marriage, datum);
            }
        }


        if (!marriage.classed("remove")) {
            this.addLabel(marriage, datum);
        }
    }

    /**
     * Appends the arc element to the marriage element.
     *
     * @param {Selection} marriage The parent element
     * @param {Object}    datum    The D3 data object
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

        const arcGroup = marriage
            .append("g")
            .attr("class", "arc");

        const path = arcGroup
            .append("path")
            .attr("d", arcGenerator);

        const parentColor = FamilyColor.getMarriageColor(datum);

        if (parentColor && !marriage.classed("new")) {
            path.style("fill", parentColor);
        }

        // Hide arc initially if it's new during chart update
        if (marriage.classed("new")) {
            path.style("opacity", 1e-6);
        }
    }

    /**
     * Appends the label (marriage date text) to the marriage element.
     *
     * @param {Selection} marriage The parent element
     * @param {Object}    datum    The D3 data object
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
     * Get the scaled font size.
     *
     * @param {Object} datum The D3 data object
     *
     * @return {number}
     */
    getFontSize(datum) {
        // Use the parents' depth (datum.depth + 1) for font sizing
        // since the marriage arc visually belongs to the parent generation
        return this._geometry.getFontSize(
            Object.assign({}, datum, { depth: datum.depth + 1 }),
        );
    }
}
