/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../d3.js";
import Geometry from "./geometry.js";
import ArcLabelLayout, { LINE_KIND, TEXT_SLOT } from "./arc-label-layout.js";
import { measureText, truncateNames, truncateToFit } from "@magicsunday/webtrees-chart-lib/infra";
import { createAlternativeNamesData, createNamesData } from "./name-parts.js";
import { getTextMetrics } from "./text-metrics.js";

/**
 * @import { Selection } from "d3-selection"
 * @import Svg from "../svg.js"
 * @import Configuration from "../configuration.js"
 * @import { HierarchyNode } from "../hierarchy.js"
 * @import { LabelElementData } from "./name-parts.js"
 * @import { LineKind, SlotPosition, SlotPositions, TextSlot } from "./arc-label-layout.js"
 */

/**
 * Returns the kind of line that a <text> element of a label stands for.
 *
 * @param {Selection<any, any, any, any>} element The <text> element
 *
 * @return {LineKind}
 */
function getLineKind(element) {
    if (element.classed("date")) {
        return LINE_KIND.DATE;
    }

    return element.classed("wt-chart-box-name-alt") ? LINE_KIND.ALT : LINE_KIND.NAME;
}

/**
 * Generates all text elements for a single person arc: first names, last names,
 * alternative name, and date lines. Inner arcs (depth 1 to
 * numberOfInnerCircles) render text along arc-shaped <path> definitions; outer
 * arcs use rotated plain <text> elements. Slot positions are calculated to
 * vertically center the full text block within the arc band with tighter
 * intra-group and wider inter-group spacing. Long names and dates are truncated
 * with an ellipsis to fit.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */

export default class Text {
    /**
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Geometry}      [geometry]    Optional geometry instance (created from config if omitted)
     * @param {number}        [imageSize]   The size of the person's image in px that the text makes room for, 0 for no image
     */
    constructor(svg, configuration, geometry, imageSize = 0) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = geometry || new Geometry(this._configuration);
        this._layout = new ArcLabelLayout(this._configuration, this._geometry, imageSize);
        this._metrics = getTextMetrics(this._svg, this._geometry);
    }

    /**
     * Creates all the labels and all dependent elements for a single person.
     *
     * @param {Selection<any, any, any, any>} parent The parent element to which the elements are to be attached
     * @param {HierarchyNode}                 datum  The D3 data object
     */
    createLabels(parent, datum) {
        const positions = this._layout.calculateSlotPositions(datum);

        if (this._layout.isInnerLabel(datum)) {
            this.createInnerLabels(parent, datum, positions);
        } else {
            this.createOuterLabels(parent, datum, positions);
        }

        // Note: Marriage dates are rendered separately in the marriage arc layer (chart.js),
        // not as part of individual person labels.
    }

    /**
     * Creates labels for inner arc generations (text along arc paths).
     *
     * @param {Selection<any, any, any, any>} parent
     * @param {HierarchyNode}                 datum
     * @param {SlotPositions}                 positions
     *
     * @private
     */
    createInnerLabels(parent, datum, positions) {
        // The label group sits inside the content group of the person, which carries no id, so the
        // id comes from the person group. It names the paths and lets the cleanup after an update
        // find the ones that nothing refers to any more.
        const parentId = /** @type {Element} */ (parent.node().closest("g.person")).id;
        const nameGroups = createNamesData(datum);
        const textStartOffset = "25%";
        const nameSlots = [TEXT_SLOT.FIRST_NAMES, TEXT_SLOT.LAST_NAMES];

        nameGroups.forEach((nameGroup, index) => {
            if (nameGroup.length === 0) {
                return;
            }

            const slot = this.getSlot(nameSlots, index);
            const position = this.getSlotPosition(positions, slot);
            const availableWidth = this._layout.getAvailableWidth(datum, position);
            const pathId = this.createPathDefinition(parentId, slot, position, datum);
            const textPath = parent
                .append("text")
                .append("textPath")
                .attr("href", `#${pathId}`)
                .attr("startOffset", textStartOffset);

            this.addNameElements(
                textPath,
                this.truncateNamesData(textPath, nameGroup, availableWidth),
            );
        });

        if (datum.data.data.alternativeName !== "") {
            const slot = TEXT_SLOT.ALTERNATIVE_NAME;
            const position = this.getSlotPosition(positions, slot);
            const pathId = this.createPathDefinition(parentId, slot, position, datum);
            const availableWidth = this._layout.getAvailableWidth(datum, position);
            const nameGroup = createAlternativeNamesData(datum);

            const textPath = parent
                .append("text")
                .append("textPath")
                .attr("href", `#${pathId}`)
                .attr("startOffset", textStartOffset)
                .classed("wt-chart-box-name-alt", true)
                .classed("rtl", datum.data.data.isAltRtl);

            this.addNameElements(
                textPath,
                this.truncateNamesData(textPath, nameGroup, availableWidth),
            );
        }

        this.renderTimespanLines(datum, positions, (slot, position) => {
            const pathId = this.createPathDefinition(parentId, slot, position, datum);

            return parent
                .append("text")
                .append("textPath")
                .attr("href", `#${pathId}`)
                .attr("startOffset", textStartOffset)
                .attr("class", "date");
        });
    }

    /**
     * Creates labels for outer arc generations (plain text elements).
     *
     * @param {Selection<any, any, any, any>} parent
     * @param {HierarchyNode}                 datum
     * @param {SlotPositions}                 positions
     *
     * @private
     */
    createOuterLabels(parent, datum, positions) {
        if (datum.depth >= 7) {
            const nameGroups = createNamesData(datum);
            const availableWidth = this._layout.getAvailableWidth(
                datum,
                this.getSlotPosition(positions, TEXT_SLOT.FIRST_NAMES),
            );
            const combined = nameGroups.flat();

            const text = parent.append("text").attr("dominant-baseline", "middle");

            this.addNameElements(text, this.truncateNamesData(text, combined, availableWidth));
        } else {
            const nameGroups = createNamesData(datum);
            const nameSlots = [TEXT_SLOT.FIRST_NAMES, TEXT_SLOT.LAST_NAMES];
            // Center node only: lift the inline nickname out of the
            // given-names group and render it on its own line. The
            // truncate-drops-nickname-first heuristic that protects narrow
            // outer arcs would otherwise wipe the nickname inside the
            // tight central radius. Mirrors the pedigree-chart top/bottom
            // rendering, where the nickname sits between given names and
            // surname. Other outer arcs keep the inline placement so they
            // don't lose their tight horizontal layout.
            const isCenter = datum.depth === 0;

            nameGroups.forEach((nameGroup, index) => {
                if (nameGroup.length === 0) {
                    return;
                }

                const availableWidth = this._layout.getAvailableWidth(
                    datum,
                    this.getSlotPosition(positions, this.getSlot(nameSlots, index)),
                );

                if (isCenter && index === 0) {
                    const nickname = nameGroup.find((entry) => entry.isNickname);

                    if (nickname !== undefined) {
                        const givenNames = nameGroup.filter((entry) => !entry.isNickname);
                        // Strip isNickname so truncateNamesData does not
                        // drop this dedicated line first when the center
                        // radius is narrow — the whole point of lifting
                        // it out is that it survives truncation.
                        const nickEntry = { ...nickname, isNickname: false };

                        if (givenNames.length > 0) {
                            const givenText = parent
                                .append("text")
                                .attr("dominant-baseline", "middle");
                            this.addNameElements(
                                givenText,
                                this.truncateNamesData(givenText, givenNames, availableWidth),
                            );
                        }

                        const nickText = parent
                            .append("text")
                            .attr("class", "nickname")
                            .attr("dominant-baseline", "middle");
                        this.addNameElements(
                            nickText,
                            this.truncateNamesData(nickText, [nickEntry], availableWidth),
                        );
                        return;
                    }
                }

                const text = parent.append("text").attr("dominant-baseline", "middle");

                this.addNameElements(text, this.truncateNamesData(text, nameGroup, availableWidth));
            });

            // Skip alternative names for descendants to save space
            if (datum.data.data.alternativeName !== "" && datum.depth >= 0) {
                const availableWidth = this._layout.getAvailableWidth(
                    datum,
                    this.getSlotPosition(positions, TEXT_SLOT.ALTERNATIVE_NAME),
                );
                const nameGroup = createAlternativeNamesData(datum);

                const text = parent
                    .append("text")
                    .attr("dominant-baseline", "middle")
                    .classed("wt-chart-box-name-alt", true)
                    .classed("rtl", datum.data.data.isAltRtl);

                this.addNameElements(text, this.truncateNamesData(text, nameGroup, availableWidth));
            }

            // Depth 6+ outer arcs are too narrow for date text
            if (datum.depth < 6) {
                // Outer labels use plain text elements — slot/position unused
                // since positioning is handled by transformOuterText
                this.renderTimespanLines(datum, positions, (_slot) =>
                    parent.append("text").attr("class", "date").attr("dominant-baseline", "middle"),
                );
            }
        }

        if (datum.depth >= 8) {
            parent.selectAll("tspan[text-decoration]").attr("text-decoration", null);
        }

        this.transformOuterText(parent, datum);
    }

    /**
     * Appends up to two date lines from the timespan of the datum to parent,
     * truncating each with an ellipsis when it exceeds the available arc width.
     * The createElement callback abstracts away the inner/outer difference:
     * inner labels pass a textPath creator, outer labels pass a plain text
     * creator.
     *
     * @param {HierarchyNode} datum     The D3 partition datum
     * @param {SlotPositions} positions Slot-to-position map from calculateSlotPositions()
     * @param {(slot: TextSlot, position: SlotPosition) => Selection<any, any, any, any>} createElement
     *                                  Creates the container element of one line
     *
     * @private
     */
    renderTimespanLines(datum, positions, createElement) {
        const timespan = this._layout.getTimespan(datum);

        if (timespan === "") {
            return;
        }

        const timespanLines = timespan.split("\n");
        const dateSlots = [TEXT_SLOT.DATE_LINE_1, TEXT_SLOT.DATE_LINE_2];

        timespanLines.slice(0, dateSlots.length).forEach((line, lineIndex) => {
            const slot = this.getSlot(dateSlots, lineIndex);
            const position = this.getSlotPosition(positions, slot);
            const container = createElement(slot, position);

            container.append("title").text(line);

            const tspan = container.append("tspan").text(line);
            const availableWidth = this._layout.getAvailableWidth(datum, position);

            truncateToFit(tspan, availableWidth);
        });
    }

    /**
     * Appends one <tspan> per name part to parent. Preferred names receive an
     * underline decoration; last names receive the "lastName" CSS class.
     * Adjacent name parts are spaced 0.25em apart (negated for RTL scripts).
     *
     * @param {Selection<any, any, any, any>} parent The <text> or <textPath> element to append spans to
     * @param {LabelElementData[]}            data   Array of name part descriptors
     *
     * @private
     */
    addNameElements(parent, data) {
        parent
            .selectAll("tspan")
            .data(data)
            .enter()
            .call((enterSelection) => {
                enterSelection
                    .append("tspan")
                    .text((datum) => datum.label)
                    // Add some spacing between the elements
                    .attr("dx", (datum, index) => {
                        return index === 0 ? null : `${(datum.isNameRtl ? -1 : 1) * 0.25}em`;
                    })
                    // Highlight the preferred and last name
                    .attr("text-decoration", (datum) => (datum.isPreferred ? "underline" : null))
                    .classed("lastName", (datum) => Boolean(datum.isLastName));
            });
    }

    /**
     * Takes the font-size and font-weight of the parent element from the metrics
     * of the render pass and delegates to truncateNames() with them.
     *
     * @param {Selection<any, any, any, any>} parent         The <text> or <textPath> element whose font metrics to use
     * @param {LabelElementData[]}            names          The name parts to truncate
     * @param {number}                        availableWidth Maximum pixel width for the combined name string
     *
     * @return {LabelElementData[]}
     *
     * @private
     */
    truncateNamesData(parent, names, availableWidth) {
        const { fontSize, fontWeight } = this._metrics.getFont(parent);

        return /** @type {LabelElementData[]} */ (
            truncateNames(
                /** @type {any} */ (names),
                availableWidth,
                (text) => this.measureText(text, fontSize, fontWeight),
                { strategy: this._configuration.nameAbbreviation },
            )
        );
    }

    /**
     * Returns the pixel width of text rendered in the SVG's font family, which
     * the metrics of the render pass read once, at the given size and weight. Delegates to the shared canvas-based
     * measure utility.
     *
     * @param {string} text
     * @param {string} fontSize   CSS font-size string (e.g. "14px")
     * @param {string} fontWeight CSS font-weight (default 400)
     *
     * @return {number}
     *
     * @private
     */
    measureText(text, fontSize, fontWeight = "400") {
        const fontFamily = this._metrics.getFontFamily();

        return measureText(text, fontFamily, fontSize, String(fontWeight));
    }

    /**
     * Registers a circular arc <path> in SVG defs at the radial position for
     * the given text slot. The path ID is derived from parentId and slot.index.
     * During updates, if a path with that ID already exists, a numeric suffix
     * is appended so old and new textPaths can coexist during the cross-fade.
     * Reverses start/end angles for flipped labels in the bottom half of 360°
     * charts.
     *
     * @param {string}        parentId The ID of the parent person/marriage element
     * @param {TextSlot}      slot     One of the TEXT_SLOT constants (carries .index for the path ID)
     * @param {SlotPosition}  position Radial percentage positions for this slot
     * @param {HierarchyNode} data     The D3 partition datum
     *
     * @return {string} The id attribute of the newly created <path> element
     *
     * @private
     */
    createPathDefinition(parentId, slot, position, data) {
        let pathId = `path-${parentId}-${slot.index}`;

        // If path already exists (update case), create a new one with a unique ID
        // so old text keeps its path during fade-out and new text gets correct position
        if (this._svg.defs.select(`path#${pathId}`).node()) {
            pathId = `${pathId}-${this._svg.defs.get().selectAll(`path[id^='${pathId}']`).size()}`;
        }

        const positionFlipped = this.isPositionFlipped(data.depth, data.x0, data.x1);
        const startAngle = this._geometry.startAngle(data.depth, data.x0);
        const endAngle = this._geometry.endAngle(data.depth, data.x1);
        const relativeRadius = this._geometry.relativeRadius(
            data.depth,
            this._layout.getTextOffset(positionFlipped, position),
        );

        // Create an arc generator for path segments
        const arcGenerator = d3
            .arc()
            .startAngle(positionFlipped ? endAngle : startAngle)
            .endAngle(positionFlipped ? startAngle : endAngle)
            .innerRadius(relativeRadius)
            .outerRadius(relativeRadius);

        arcGenerator
            .padAngle(this._configuration.padAngle)
            .padRadius(this._configuration.padRadius)
            .cornerRadius(this._configuration.cornerRadius);

        // Store the <path> inside the definition list, so we could
        // access it later on by its id
        // The generator only reads its constant angles and radii, never the
        // datum d3 passes in, so the untyped defs datum is fine here.
        this._svg.defs
            .append("path")
            .attr("id", pathId)
            .attr("d", /** @type {any} */ (arcGenerator));

        return pathId;
    }

    /**
     * Check for the 360-degree chart if the current arc labels should be
     * flipped for easier reading.
     *
     * @param {number} depth The depth of the element inside the chart
     * @param {number} x0    The left edge (x0) of the rectangle
     * @param {number} x1    The right edge (x1) of the rectangle
     *
     * @return {boolean}
     *
     * @private
     */
    isPositionFlipped(depth, x0, x1) {
        return this._geometry.isPositionFlipped(depth, x0, x1);
    }

    /**
     * Returns the text slot at the given index of a slot list.
     *
     * @param {TextSlot[]} slots The slot list
     * @param {number}     index The index of the slot
     *
     * @return {TextSlot}
     *
     * @private
     */
    getSlot(slots, index) {
        const slot = slots[index];

        if (slot === undefined) {
            throw new Error(`No text slot at index ${index}`);
        }

        return slot;
    }

    /**
     * Returns the position calculateSlotPositions() assigned to the given slot.
     * Every slot a label is rendered in has one.
     *
     * @param {SlotPositions} positions The slot positions of the datum
     * @param {TextSlot}      slot      The slot to look up
     *
     * @return {SlotPosition}
     *
     * @private
     */
    getSlotPosition(positions, slot) {
        const position = positions.get(slot);

        if (position === undefined) {
            throw new Error(`No text position calculated for slot ${slot.index}`);
        }

        return position;
    }

    /**
     * Positions all <text> elements within the label group. The layout decides
     * where every line goes. For the center node (depth 0) it stacks the lines
     * vertically, and the lines are set with dy offsets. For outer arcs it
     * aligns each line with the angular center of the segment, and the lines are
     * set with a rotate and translate transform.
     *
     * @param {Selection<any, any, any, any>} parent The label <g> element whose <text> children to position
     * @param {HierarchyNode}                 datum  The D3 partition datum
     *
     * @private
     */
    transformOuterText(parent, datum) {
        const layout = this._layout;
        const textElements = parent.selectAll("text");
        /** @type {LineKind[]} */
        const lineKinds = [];

        textElements.each(function () {
            lineKinds.push(getLineKind(d3.select(this)));
        });

        // Center person: vertical stacking via dy.
        if (datum.depth === 0) {
            const offsets = layout.calculateCenterSlotOffsets(datum, lineKinds);

            textElements.each(function (_ignore, i) {
                d3.select(this).attr("dy", `${offsets[i]}px`);
            });

            return;
        }

        // Outer labels: use semantic group spacing (same logic as inner
        // labels in calculateSlotPositions) but in angular degrees.
        const angularPositions = layout.calculateOuterSlotPositions(datum, lineKinds);

        // calculateOuterSlotPositions() returns one offset per text element
        textElements.each(function (_ignore, i) {
            const angularPosition = /** @type {number} */ (angularPositions[i]);

            d3.select(this).attr(
                "transform",
                layout.calculateOuterTransform(datum, angularPosition),
            );
        });
    }
}
