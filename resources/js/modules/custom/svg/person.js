/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3.js";
import {appendArc} from "./arc.js";
import { createPersonArcGenerator } from "./arc-factory.js";
import TooltipRenderer from "./tooltip-renderer.js";
import LabelRenderer from "./label-renderer.js";
import {SEX_FEMALE, SEX_MALE} from "../hierarchy.js";
import { classifyElement } from "./lifecycle.js";

/** Minimum rendered image diameter in pixels — narrower arcs skip the image. */
const IMAGE_SIZE_MIN = 28;

/** Maximum image diameter when names are shown (caps at 40% of arc height). */
const IMAGE_HEIGHT_MAX = 55;

/** Minimum angular width of an arc in degrees required to show an image. */
const IMAGE_ANGULAR_MIN_DEG = 10;

/** Vertical gap in pixels between the image and the first text line (center node). */
const IMAGE_TEXT_GAP = 6;

/** Horizontal gap in pixels between the image and the text block (inner arcs). */
const IMAGE_LABEL_GAP = 10;

/**
 * Renders all visual elements for a single person arc: the filled arc path,
 * the SVG <title> for browser tooltips, the name/date label group, the
 * circular thumbnail image (clipped to a circle), the thin color-indicator
 * strip at the outer edge, and the hover/context-menu tooltip events.
 * Respects the new / update / remove lifecycle class flags set by Update.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Person {
    /**
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Geometry}      geometry      Shared geometry instance for this render pass
     * @param {Selection}     person        The <g class="person"> D3 selection
     * @param {Object}        children      The D3 partition datum for this person
     */
    constructor(svg, configuration, geometry, person, children) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = geometry;

        this.init(person, children);
    }

    /**
     * Builds all child elements of the person <g>. Skips outer generations when
     * names are disabled. For nodes with data, pre-computes imageSize on the datum
     * before calling LabelRenderer so text layout can account for the image width.
     *
     * @param {Selection} person The <g class="person"> D3 selection
     * @param {Object}    datum  The D3 partition datum
     */
    init(person, datum) {
        // Hide outer generations when only images are shown (no names)
        if (!this._configuration.showNames
            && (datum.depth > this._configuration.numberOfInnerCircles)
        ) {
            return;
        }

        const { isNew, isUpdate, isRemove } = classifyElement(person);
        const hasData = datum.data.data.xref !== "";

        // Descendant nodes always show their arc (empty partner arcs
        // are structural placeholders for children below them)
        const isDescendant = datum.depth < 0;

        // All visual content goes into a <g class="content"> wrapper so the
        // update lifecycle can fade old/new content as a single unit.
        const content = person.append("g").attr("class", "content");

        if (isNew && (this._configuration.hideEmptySegments || isDescendant)) {
            this.addArcToPerson(content, datum);
        } else if (isUpdate) {
            // Arc must be rebuilt in the new content wrapper (the old arc
            // is inside g.content.old and will be removed after fade-out)
            this.addArcToPerson(content, datum);
        } else if (!isNew && !isRemove
            && (hasData || !this._configuration.hideEmptySegments || isDescendant)
        ) {
            this.addArcToPerson(content, datum);
        }

        if (datum.data.data.xref !== "") {
            this.addTitleToPerson(content, datum.data.data.name);

            // Pre-compute image size so text layout can account for it
            datum.data.data.imageSize = this._computeImageSize(datum);

            // Render labels (text layout uses imageSize if set above)
            if (this._configuration.showNames) {
                const labelRenderer = new LabelRenderer(this._svg, this._configuration, this._geometry);
                labelRenderer.addLabel(content, datum);
            }

            // Place image after text is rendered
            if (datum.data.data.imageSize) {
                this.addImageToPerson(content, datum, this._configuration.showNames);
            }

            this.addColorGroup(content, datum);

            // Bind tooltip and hover events (on the outer person element,
            // not the content wrapper, so events work during transitions)
            const tooltipRenderer = new TooltipRenderer(this._svg, this._configuration);
            tooltipRenderer.bindEvents(person, datum);
        }
    }

    /**
     * Appends the thin color-indicator strip along the outer edge of the arc.
     * When family colors fill the arc body the strip is light gray; otherwise
     * it carries the sex-based CSS class (male / female / unknown).
     *
     * @param {Selection} person The <g class="person"> D3 selection
     * @param {Object}    datum  The D3 partition datum
     *
     * @private
     */
    addColorGroup(person, datum) {
        const arcGenerator = d3.arc()
            .startAngle(this._geometry.startAngle(datum.depth, datum.x0))
            .endAngle(this._geometry.endAngle(datum.depth, datum.x1))
            .innerRadius(this._geometry.outerRadius(datum.depth) - this._configuration.colorArcWidth)
            .outerRadius(this._geometry.outerRadius(datum.depth) + 1)
            .padAngle(this.getArcPadAngle(datum))
            .padRadius(this._configuration.padRadius);

        const color = person
            .append("g")
            .attr("class", "color");

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
     * Computes the image size for a person arc based on arc height, angular
     * width, and whether names are shown. Returns null if conditions aren't
     * met (images disabled, no thumbnail, outer arc, or arc too narrow).
     *
     * @param {Object} datum The D3 partition datum
     *
     * @return {number|null}
     *
     * @private
     */
    _computeImageSize(datum) {
        if (!this._configuration.showImages
            || !datum.data.data.thumbnail
            || (datum.depth > this._configuration.numberOfInnerCircles)
        ) {
            return null;
        }

        const arcHeight = (datum.depth === 0)
            ? this._configuration.centerCircleRadius * 2
            : this._geometry.outerRadius(datum.depth) - this._geometry.innerRadius(datum.depth);

        let imageSize;

        if (this._configuration.showNames) {
            imageSize = Math.min(arcHeight * 0.4, IMAGE_HEIGHT_MAX);
        } else {
            const arcWidth = (datum.depth === 0)
                ? arcHeight
                : (this._geometry.endAngle(datum.depth, datum.x1) - this._geometry.startAngle(datum.depth, datum.x0)) * this._geometry.centerRadius(datum.depth);

            imageSize = Math.min(arcHeight, arcWidth) * 0.8;
        }

        const angularWidth = (datum.depth === 0)
            ? 360
            : Math.abs(
                this._geometry.endAngle(datum.depth, datum.x1)
                - this._geometry.startAngle(datum.depth, datum.x0),
            ) * (180 / Math.PI);

        if ((imageSize >= IMAGE_SIZE_MIN) && (angularWidth >= IMAGE_ANGULAR_MIN_DEG)) {
            return imageSize;
        }

        return null;
    }

    /**
     * Appends a circular thumbnail image to the person element.
     * Called AFTER labels are rendered so getBBox() can measure text.
     *
     * Center node: image above the text, horizontally centered.
     * Inner arcs: image left of the text block, both centered on arc.
     *
     * @param {Selection} person    The parent element
     * @param {Object}    datum     The D3 data object
     * @param {boolean}   showNames Whether name labels are rendered
     *
     * @private
     */
    addImageToPerson(person, datum, showNames = true) {
        const imageSize = datum.data.data.imageSize;

        if (!imageSize) {
            return;
        }

        const nameGroup = person.select("g.name");
        let textWidth = 0;

        nameGroup.selectAll("text").each(function () {
            const lineLength = this.getComputedTextLength();

            if (lineLength > textWidth) {
                textWidth = lineLength;
            }
        });

        const clipId = `clip-image-${datum.id}-${Date.now()}`;

        if (datum.depth === 0) {
            // Center node: image above text, or centered alone if no names shown
            let centerY = 0;

            if (showNames) {
                const firstText = nameGroup.select("text");
                const firstDy = parseFloat(firstText.attr("dy")) || 0;
                const fontSize = this._geometry.getFontSize(datum);
                const lineHeight = fontSize * 1.3;
                centerY = firstDy - (lineHeight / 2) - IMAGE_TEXT_GAP - (imageSize / 2);
            }

            this._svg.defs
                .append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", 0)
                .attr("cy", centerY)
                .attr("r", imageSize / 2);

            const imageGroup = person.append("g")
                .attr("class", "image");

            imageGroup.append("circle")
                .attr("cx", 0)
                .attr("cy", centerY)
                .attr("r", imageSize / 2)
                .attr("fill", "white");

            imageGroup.append("image")
                .attr("href", datum.data.data.thumbnail)
                .attr("x", -(imageSize / 2))
                .attr("y", centerY - (imageSize / 2))
                .attr("width", imageSize)
                .attr("height", imageSize)
                .attr("clip-path", `url(#${clipId})`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            imageGroup.append("circle")
                .attr("cx", 0)
                .attr("cy", centerY)
                .attr("r", imageSize / 2)
                .attr("fill", "none")
                .attr("stroke", "rgb(120, 120, 120)")
                .attr("stroke-width", 1);
        } else {
            // Inner arcs: use measured text width to center image+text block.
            const startAngle = this._geometry.startAngle(datum.depth, datum.x0);
            const endAngle = this._geometry.endAngle(datum.depth, datum.x1);
            const centerRadius = this._geometry.centerRadius(datum.depth);

            // When text is present, shift image left to center image+text block
            const shiftAngle = (textWidth > 0)
                ? ((textWidth + IMAGE_LABEL_GAP) / 2) / centerRadius
                : 0;

            const midAngle = (startAngle + endAngle) / 2;
            const flipped = this._geometry.isPositionFlipped(datum.depth, datum.x0, datum.x1);

            const imageAngle = flipped
                ? midAngle + shiftAngle
                : midAngle - shiftAngle;

            const rotateDeg = imageAngle * (180 / Math.PI) + (flipped ? 180 : 0);
            const posX = centerRadius * Math.sin(imageAngle);
            const posY = -centerRadius * Math.cos(imageAngle);

            this._svg.defs
                .append("clipPath")
                .attr("id", clipId)
                .append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", imageSize / 2);

            const imageGroup = person.append("g")
                .attr("class", "image")
                .attr("transform",
                    "translate(" + posX + "," + posY + ") "
                    + "rotate(" + rotateDeg + ")",
                );

            imageGroup.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", imageSize / 2)
                .attr("fill", "white");

            imageGroup.append("image")
                .attr("href", datum.data.data.thumbnail)
                .attr("x", -(imageSize / 2))
                .attr("y", -(imageSize / 2))
                .attr("width", imageSize)
                .attr("height", imageSize)
                .attr("clip-path", `url(#${clipId})`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            imageGroup.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", imageSize / 2)
                .attr("fill", "none")
                .attr("stroke", "rgb(120, 120, 120)")
                .attr("stroke-width", 1);

            // Shift the text right to make room for the image.
            // Convert pixel shift to startOffset percentage: the text baseline
            // starts at 25%, leaving 50 percentage points of arc length to work with.
            const textShiftPx = (imageSize / 2) + IMAGE_LABEL_GAP;
            const textShiftPercent = (textShiftPx / (Math.abs(endAngle - startAngle) * centerRadius)) * 50;

            nameGroup.selectAll("textPath").each(function () {
                const raw = parseFloat(d3.select(this).attr("startOffset"));
                const currentOffset = Number.isFinite(raw) ? raw : 25;
                d3.select(this).attr("startOffset", `${(currentOffset + textShiftPercent).toFixed(1)}%`);
            });
        }
    }

    /**
     * Builds the d3.arc() generator for this person's segment using its depth,
     * partition angles, and computed radii, then delegates rendering to
     * appendArc() with the pre-computed family color (if any).
     *
     * @param {Selection} person The <g class="person"> D3 selection
     * @param {Object}    datum  The D3 partition datum
     *
     * @private
     */
    addArcToPerson(person, datum) {
        const arcGenerator = createPersonArcGenerator(
            this._geometry,
            this._configuration,
            datum,
            this.getArcPadAngle(datum),
        );

        appendArc(person, arcGenerator, datum.data.data.familyColor);
    }

    /**
     * Inserts an SVG <title> as the first child of the person element so
     * browsers show the full name as a native tooltip on hover.
     *
     * @param {Selection} person The <g class="person"> D3 selection
     * @param {string}    value  The individual's full name
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
        // No padding between spouse pairs (ancestors) or descendant arcs
        // when marriage arcs are shown -- the arcs fill the gap
        if (this._configuration.showParentMarriageDates && (datum.parent || (datum.depth < 0))) {
            return 0;
        }

        return this._configuration.padAngle;
    }
}
