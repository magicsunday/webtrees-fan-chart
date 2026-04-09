/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";

/**
 * This class handles the tooltip and mouse interaction for person elements.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class TooltipRenderer
{
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     */
    constructor(svg, configuration)
    {
        this._svg           = svg;
        this._configuration = configuration;
    }

    /**
     * Binds all mouse and context-menu event listeners to a person element.
     *
     * @param {Selection} person The person element to bindEvents events to
     * @param {Object}    datum  The D3 data object
     */
    bindEvents(person, datum)
    {
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
            })
            .on("mousemove", (event) => {
                this._svg.div
                    .style("left", (event.pageX) + "px")
                    .style("top", (event.pageY - 30) + "px");
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
     * Sets the tooltip HTML content and positions it near the cursor.
     *
     * @param {Event}  event The triggering mouse event
     * @param {Object} datum The D3 data object
     */
    setTooltipHtml(event, datum)
    {
        // Ignore empty elements
        if (datum.data.data.xref === "") {
            return;
        }

        let image = "";

        // Show individual image or silhouette (depending on tree configuration)
        if (this._configuration.showImages) {
            if (datum.data.data.thumbnail) {
                image = "<div class=\"image\">";
                image += "<img src=\"" + datum.data.data.thumbnail + "\" alt=\"\" />";
                image += "</div>";
            } else {
                if (this._configuration.showSilhouettes) {
                    image = "<div class=\"image\">";
                    image += "<i class=\"icon-silhouette icon-silhouette-" + datum.data.data.sex.toLowerCase() + " wt-icon-flip-rtl\" ></i>";
                    image += "</div>";
                }
            }
        }

        const dates = datum.data.data.birth || datum.data.data.marriageDate || datum.data.data.death;

        this._svg.div
            .html(
                image
                + "<div class=\"text\">"
                    + "<div class=\"name\">" + datum.data.data.name + "</div>"
                    + (dates
                        ? "<table>"
                            + (datum.data.data.birth
                            ? ("<tr class=\"date\"><th>\u2605</th><td>" + datum.data.data.birth + "</td></tr>")
                            : "")
                            + (datum.data.data.marriageDate
                            ? ("<tr class=\"date\"><th>\u26AD</th><td>" + datum.data.data.marriageDate + "</td></tr>")
                            : "")
                            + (datum.data.data.death
                            ? ("<tr class=\"date\"><th>\u2020</th><td>" + datum.data.data.death + "</td></tr>")
                            : "")
                        + "</table>"
                    : "")
                + "</div>"
            )
            .style("left", (event.pageX) + "px")
            .style("top", (event.pageY - 30) + "px");

        if (this._svg.div.property("active")) {
            this._svg.div
                .transition()
                .duration(200)
                .style("opacity", 1);
        }
    }
}
