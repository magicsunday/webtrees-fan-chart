/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";
import Geometry from "./geometry";
import TooltipRenderer from "./tooltip-renderer";
import LabelRenderer from "./label-renderer";
import {SEX_FEMALE, SEX_MALE} from "../hierarchy";

/**
 * This class handles the creation of the person elements of the chart.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Person {
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Selection}     person
     * @param {Object}        children
     */
    constructor(svg, configuration, person, children) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = new Geometry(this._configuration);

        this.init(person, children);
    }

    /**
     * Initialize the required elements.
     *
     * @param {Selection} person
     * @param {Object}    datum
     */
    init(person, datum) {
        if (person.classed("new") && this._configuration.hideEmptySegments) {
            this.addArcToPerson(person, datum);
        } else {
            if (!person.classed("new")
                && !person.classed("update")
                && !person.classed("remove")
                && ((datum.data.data.xref !== "") || !this._configuration.hideEmptySegments)
            ) {
                this.addArcToPerson(person, datum);
            }
        }

        if (datum.data.data.xref !== "") {
            this.addTitleToPerson(person, datum.data.data.name);

            // Pre-compute image size so text layout can account for it
            if (this._configuration.showImages
                && datum.data.data.thumbnail
                && (datum.depth <= this._configuration.numberOfInnerCircles)
            ) {
                const arcHeight = (datum.depth === 0)
                    ? this._configuration.centerCircleRadius * 2
                    : this._geometry.outerRadius(datum.depth) - this._geometry.innerRadius(datum.depth);

                const imageSize = Math.min(arcHeight * 0.4, 55);

                if (imageSize >= 16) {
                    datum.data.data.imageSize = imageSize;
                }
            }

            // Render labels (text layout uses imageSize if set above)
            const labelRenderer = new LabelRenderer(this._svg, this._configuration);
            labelRenderer.addLabel(person, datum);

            // Place image after text is rendered, using getBBox for exact sizing
            if (datum.data.data.imageSize) {
                this.addImageToPerson(person, datum);
            }

            this.addColorGroup(person, datum);

            // Bind tooltip and hover events
            const tooltipRenderer = new TooltipRenderer(this._svg, this._configuration);
            tooltipRenderer.bindEvents(person, datum);
        }
    }

    /**
     * Adds a color overlay for each arc.
     *
     * @param {Selection} person
     * @param {Object}    data   The D3 data object
     */
    addColorGroup(person, datum) {
        // Arc generator
        const arcGenerator = d3.arc()
            .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
            .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
            .innerRadius(this._geometry.outerRadius(datum.depth) - this._configuration.colorArcWidth)
            .outerRadius(this._geometry.outerRadius(datum.depth) + 1);
        // .innerRadius((data) => this._geometry.outerRadius(data.depth) - this._configuration.colorArcWidth - 2)
        // .outerRadius((data) => this._geometry.outerRadius(data.depth) - 1);

        arcGenerator.padAngle(this.getArcPadAngle(datum))
            .padRadius(this._configuration.padRadius)
        //     .cornerRadius(this._configuration.cornerRadius - 2)
        ;

        const color = person
            .append("g")
            .attr("class", "color");

        // Hide immediately during updates to prevent visual flash
        if (person.classed("update")) {
            color.style("opacity", 1e-6);
        }

        const path = color.append("path")
            .attr("d", arcGenerator);

        if (this._configuration.showFamilyColors) {
            // Light gray strip when family colors fill the arcs
            path.style("fill", "rgb(215, 215, 215)");
        } else {
            // Sex-based color on the strip
            if (!datum.depth) {
                path.attr("fill", "rgb(225, 225, 225)");
            }

            path.attr(
                "class",
                datum.data.data.sex === SEX_FEMALE ? "female" : (datum.data.data.sex === SEX_MALE ? "male" : "unknown"),
            );
        }
    }

    /**
     * Appends a circular thumbnail image to the person element.
     * Called AFTER labels are rendered so getBBox() can measure text.
     *
     * Center node: image above the text, horizontally centered.
     * Inner arcs: image left of the text block, both centered on arc.
     *
     * @param {Selection} person The parent element
     * @param {Object}    datum  The D3 data object
     *
     * @private
     */
    addImageToPerson(person, datum)
    {
        let imageSize = datum.data.data.imageSize;

        if (!imageSize) {
            return;
        }

        // Select the NEW name group (not the old one being faded out)
        let nameGroup = person.select("g.name:not(.old)");
        let textWidth = 0;

        nameGroup.selectAll("text").each(function () {
            let lineLength = this.getComputedTextLength();

            if (lineLength > textWidth) {
                textWidth = lineLength;
            }
        });

        let clipId = "clip-image-" + datum.id;
        let gap    = 10;

        if (datum.depth === 0) {
            // Center node: image above text, both vertically centered
            let textBBox    = nameGroup.node() ? nameGroup.node().getBBox() : null;
            let textHeight  = textBBox ? textBBox.height : 50;
            let imageGap    = 6;
            let totalHeight = imageSize + imageGap + textHeight;
            let centerY     = -(totalHeight / 2) + (imageSize / 2);

            this._svg.defs
                .append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", 0)
                .attr("cy", centerY)
                .attr("r", imageSize / 2);

            let imageGroup = person.append("g")
                .attr("class", "image");

            imageGroup.append("image")
                .attr("href", datum.data.data.thumbnail)
                .attr("x", -(imageSize / 2))
                .attr("y", centerY - (imageSize / 2))
                .attr("width", imageSize)
                .attr("height", imageSize)
                .attr("clip-path", "url(#" + clipId + ")")
                .attr("preserveAspectRatio", "xMidYMid slice");

            imageGroup.append("circle")
                .attr("cx", 0)
                .attr("cy", centerY)
                .attr("r", imageSize / 2)
                .attr("fill", "none")
                .attr("stroke", "rgb(120, 120, 120)")
                .attr("stroke-width", 1);

            // Store for text positioning in transformOuterText
            datum.data.data.imageSize = imageSize;
        } else {
            // Inner arcs: use measured text width to center image+text block.
            let startAngle   = this._geometry.startAngle(datum.depth, datum.x0);
            let endAngle     = this._geometry.endAngle(datum.depth, datum.x1);
            let centerRadius = this._geometry.centerRadius(datum.depth);

            let totalBlock  = imageSize + gap + textWidth;
            let blockShift  = totalBlock / 2;
            let imageCenterOffset = blockShift - (imageSize / 2);

            // Convert pixel offset to angular offset
            let shiftAngle = imageCenterOffset / centerRadius;

            let midAngle = (startAngle + endAngle) / 2;
            let flipped  = this._geometry.isPositionFlipped(datum.depth, datum.x0, datum.x1);

            let imageAngle = flipped
                ? midAngle + shiftAngle
                : midAngle - shiftAngle;

            let rotateDeg = imageAngle * (180 / Math.PI) + (flipped ? 180 : 0);
            let posX = centerRadius * Math.sin(imageAngle);
            let posY = -centerRadius * Math.cos(imageAngle);

            this._svg.defs
                .append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", imageSize / 2);

            let imageGroup = person.append("g")
                .attr("class", "image")
                .attr("transform",
                    "translate(" + posX + "," + posY + ") "
                    + "rotate(" + rotateDeg + ")"
                );

            imageGroup.append("image")
                .attr("href", datum.data.data.thumbnail)
                .attr("x", -(imageSize / 2))
                .attr("y", -(imageSize / 2))
                .attr("width", imageSize)
                .attr("height", imageSize)
                .attr("clip-path", "url(#" + clipId + ")")
                .attr("preserveAspectRatio", "xMidYMid slice");

            imageGroup.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", imageSize / 2)
                .attr("fill", "none")
                .attr("stroke", "rgb(120, 120, 120)")
                .attr("stroke-width", 1);

            // Shift the text right to make room for the image.
            // Text left edge = block center + gap/2 from arc midpoint.
            let textShiftPx = (imageSize / 2) + gap;
            let textShiftPercent = (textShiftPx / (Math.abs(endAngle - startAngle) * centerRadius)) * 50;

            nameGroup.selectAll("textPath").each(function () {
                let currentOffset = parseFloat(d3.select(this).attr("startOffset")) || 25;
                d3.select(this).attr("startOffset", (currentOffset + textShiftPercent).toFixed(1) + "%");
            });
        }
    }

    /**
     * Appends the arc element to the person element.
     *
     * @param {Selection} person The parent element used to append the arc too
     * @param {Object}    datum  The D3 data object
     *
     * @private
     */
    addArcToPerson(person, datum) {
        // Create arc generator
        const arcGenerator = d3.arc()
            .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
            .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
            .innerRadius(this._geometry.innerRadius(datum.depth))
            .outerRadius(this._geometry.outerRadius(datum.depth));

        arcGenerator.padAngle(this.getArcPadAngle(datum))
            .padRadius(this._configuration.padRadius)
            .cornerRadius(this._configuration.cornerRadius);

        // Append arc
        const arcGroup = person
            .append("g")
            .attr("class", "arc");

        const path = arcGroup
            .append("path")
            .attr("d", arcGenerator);

        // Apply family-branch color to the arc fill (inline style
        // overrides the CSS rules that set fill on arc paths).
        // During updates, new arcs skip the immediate fill so the
        // D3 transition can fade from gray to the family color.
        if (datum.data.data.familyColor && !person.classed("new")) {
            path.style("fill", datum.data.data.familyColor);
        }

        // Hide arc initially if its new during chart update
        if (person.classed("new")) {
            path.style("opacity", 1e-6);
        }
    }

    /**
     * Add title element to the person element containing the full name of the individual.
     *
     * @param {Selection} person The parent element used to append the title too
     * @param {string}    value  The value to assign to the title
     *
     * @private
     */
    addTitleToPerson(person, value) {
        person
            .insert("title", ":first-child")
            .text(value);
    }

    /**
     * Returns the pad angle for a person's arc. When marriage arcs are shown,
     * spouse segments (sharing the same parent) use no padding so they appear
     * as a single joined block.
     *
     * @param {Object} datum The D3 data object
     *
     * @return {number}
     *
     * @private
     */
    getArcPadAngle(datum) {
        if (this._configuration.showParentMarriageDates && datum.parent) {
            return 0;
        }

        return this._configuration.padAngle;
    }
}
