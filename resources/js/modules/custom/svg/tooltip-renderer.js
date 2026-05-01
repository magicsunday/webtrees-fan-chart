/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../d3.js";
import {SYMBOL_BIRTH, SYMBOL_DEATH, SYMBOL_ELLIPSIS, SYMBOL_MARRIAGE} from "../hierarchy.js";

/**
 * Escapes HTML entities to prevent injection in tooltip content.
 *
 * @param {string} value The value to escape
 *
 * @return {string}
 */
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Builds the HTML rows for a single fact (date + optional place).
 *
 * @param {string} symbol Unicode symbol for the fact type
 * @param {string} date   Date string (may be empty)
 * @param {string} place  Place string (may be empty)
 *
 * @return {string}
 */
function buildFactRows(symbol, date, place) {
    let rows = `<tr class="date"><th>${symbol}</th><td>${date ? escapeHtml(date) : SYMBOL_ELLIPSIS}</td></tr>`;

    if (place) {
        rows += `<tr class="place"><th></th><td>${escapeHtml(place)}</td></tr>`;
    }

    return rows;
}

/**
 * Binds hover and context-menu events to a person arc element and manages the
 * floating tooltip div. The tooltip is shown on mouseenter and positioned on
 * mousemove. A right-click toggles it "pinned" so it stays visible after the
 * cursor leaves. The div's "active" property tracks the pinned state.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class TooltipRenderer {
    constructor(svg, configuration) {
        this._svg = svg;
        this._configuration = configuration;
    }

    /**
     * Attaches contextmenu, mouseenter, mouseleave, mousemove, mouseover, and
     * mouseout handlers to the person element. No-ops for empty persons (no xref).
     *
     * @param {Selection} person The <g class="person"> D3 selection
     * @param {Object}    datum  The D3 partition datum
     */
    bindEvents(person, datum) {
        if (datum.data.data.xref === "") {
            return;
        }

        person
            .on("contextmenu", (event) => {
                if (this._svg.div.property("active")) {
                    this._svg.div
                        .transition()
                        .duration(200)
                        .style("opacity", 0);

                    this._svg.div.property("active", false);
                    event.preventDefault();
                } else {
                    this._svg.div.property("active", true);
                    this.setTooltipHtml(event, datum);

                    event.preventDefault();
                }
            })
            .on("mouseenter", (event) => {
                this.setTooltipHtml(event, datum);
            })
            .on("mouseleave", () => {
                if (!this._svg.div.property("active")) {
                    this._svg.div.transition().duration(200).style("opacity", 0);
                }
            })
            .on("mousemove", (event) => {
                this._svg.div
                    .style("left", `${event.pageX}px`)
                    .style("top", `${event.pageY - 30}px`);
            })
            .on("mouseover", (event) => {
                d3.select(event.currentTarget)
                    .classed("hover", true)
                    .raise();
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget)
                    .classed("hover", false);
            });
    }

    /**
     * Builds the HTML for the tooltip image (thumbnail or silhouette).
     * Returns an empty string if no image should be shown.
     *
     * @param {Object} datum The D3 partition datum
     *
     * @return {string}
     *
     * @private
     */
    _buildTooltipImage(datum) {
        const thumbnail = datum.data.data.thumbnail;
        const silhouette = datum.data.data.silhouette;
        const isPhoto = thumbnail !== "" && thumbnail !== silhouette;

        // Real photo: blurred backdrop + crisp foreground (matches chart-arc).
        if (isPhoto) {
            const src = escapeHtml(thumbnail);
            return `<div class="image"><img class="blur" src="${src}" alt=""><img src="${src}" alt=""></div>`;
        }

        // Silhouette: only when the tooltip-side config opts in.
        if (this._configuration.showSilhouettes && silhouette !== "") {
            return `<div class="image"><img src="${escapeHtml(silhouette)}" alt="" /></div>`;
        }

        return "";
    }

    /**
     * Builds the HTML table rows for birth, marriage, and death data.
     * Returns an empty string if no data is available.
     *
     * @param {Object} datum The D3 partition datum
     *
     * @return {string}
     *
     * @private
     */
    _buildTooltipData(datum) {
        const birthDate = datum.data.data.birthDateFull || datum.data.data.birth || "";
        const deathDate = datum.data.data.deathDateFull || datum.data.data.death || "";
        const marriageDate = datum.data.data.marriageDateFull || datum.data.data.marriageDate || "";
        const birthPlace = datum.data.data.birthPlace || "";
        const deathPlace = datum.data.data.deathPlace || "";
        const marriagePlace = datum.data.data.marriagePlace || "";
        const hasBirth = birthDate || birthPlace;
        const hasDeath = deathDate || deathPlace;
        const hasMarriage = marriageDate || marriagePlace;

        if (!hasBirth && !hasMarriage && !hasDeath) {
            return "";
        }

        let rows = "";

        if (hasBirth) {
            rows += buildFactRows(SYMBOL_BIRTH, birthDate, birthPlace);
        }

        if (hasMarriage) {
            rows += buildFactRows(SYMBOL_MARRIAGE, marriageDate, marriagePlace);
        }

        if (hasDeath) {
            rows += buildFactRows(SYMBOL_DEATH, deathDate, deathPlace);
        }

        return `<table>${rows}</table>`;
    }

    /**
     * Builds the tooltip HTML (thumbnail or silhouette icon, full name, and a
     * table of birth / marriage / death facts with symbols) and positions the
     * div near the cursor. When the tooltip is pinned (active = true), also
     * fades it in. No-ops for empty persons.
     *
     * @param {Event}  event The triggering mouse event (used for cursor position)
     * @param {Object} datum The D3 partition datum
     *
     * @private
     */
    setTooltipHtml(event, datum) {
        if (datum.data.data.xref === "") {
            return;
        }

        const image = this._buildTooltipImage(datum);
        const data = this._buildTooltipData(datum);
        const safeName = escapeHtml(datum.data.data.name);

        this._svg.div
            .html(
                `${image}<div class="text"><div class="name">${safeName}</div>${data}</div>`,
            )
            .style("left", `${event.pageX}px`)
            .style("top", `${event.pageY - 30}px`);

        if (this._svg.div.property("active")) {
            this._svg.div
                .transition()
                .duration(200)
                .style("opacity", 1);
        }
    }
}
