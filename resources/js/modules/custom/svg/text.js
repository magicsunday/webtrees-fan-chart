/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";
import Geometry, {MATH_RAD2DEG} from "./geometry";
import measureText from "../../lib/chart/text/measure";

/**
 * Generates all text elements for a single person arc: first names, last names,
 * alternative name, and date lines. Inner arcs (depth 1 to numberOfInnerCircles)
 * render text along arc-shaped <path> definitions; outer arcs use rotated plain
 * <text> elements. Slot positions are calculated to vertically center the full
 * text block within the arc band with tighter intra-group and wider inter-group
 * spacing. Long names and dates are truncated with an ellipsis to fit.
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
     */
    constructor(svg, configuration, geometry) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = geometry || new Geometry(this._configuration);
    }

    /**
     * Creates all the labels and all dependent elements for a single person.
     *
     * @param {Selection} parent The parent element to which the elements are to be attached
     * @param {Object}    datum  The D3 data object
     */
    createLabels(parent, datum) {
        const positions = this.calculateSlotPositions(datum);

        if (this.isInnerLabel(datum)) {
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
     * @param {Selection} parent
     * @param {Object}    datum
     * @param {Map}       positions
     */
    createInnerLabels(parent, datum, positions) {
        const parentId = d3.select(parent.node().parentNode).attr("id");
        const nameGroups = this.createNamesData(datum);
        const textStartOffset = "25%";
        const nameSlots = [Text.TEXT_SLOT.FIRST_NAMES, Text.TEXT_SLOT.LAST_NAMES];

        nameGroups.forEach((nameGroup, index) => {
            const slot = nameSlots[index];
            const position = positions.get(slot);
            const availableWidth = this.getAvailableWidth(datum, position);
            const pathId = this.createPathDefinition(parentId, slot, position, datum);
            const textPath = parent
                .append("text")
                .append("textPath")
                .attr("href", "#" + pathId)
                .attr("startOffset", textStartOffset);

            this.addNameElements(
                textPath,
                this.truncateNamesData(textPath, nameGroup, availableWidth),
            );
        });

        if (datum.data.data.alternativeName !== "") {
            const slot = Text.TEXT_SLOT.ALTERNATIVE_NAME;
            const position = positions.get(slot);
            const pathId = this.createPathDefinition(parentId, slot, position, datum);
            const availableWidth = this.getAvailableWidth(datum, position);
            const nameGroup = this.createAlternativeNamesData(datum);

            const textPath = parent
                .append("text")
                .append("textPath")
                .attr("href", "#" + pathId)
                .attr("startOffset", textStartOffset)
                .classed("wt-chart-box-name-alt", true)
                .classed("rtl", datum.data.data.isAltRtl);

            this.addNameElements(
                textPath,
                this.truncateNamesData(textPath, nameGroup, availableWidth),
            );
        }

        this.renderTimespanLines(parent, datum, positions, (slot, position) => {
            const pathId = this.createPathDefinition(parentId, slot, position, datum);

            return parent
                .append("text")
                .append("textPath")
                .attr("href", "#" + pathId)
                .attr("startOffset", textStartOffset)
                .attr("class", "date");
        });
    }

    /**
     * Creates labels for outer arc generations (plain text elements).
     *
     * @param {Selection} parent
     * @param {Object}    datum
     * @param {Map}       positions
     */
    createOuterLabels(parent, datum, positions) {
        if (datum.depth >= 7) {
            const nameGroups = this.createNamesData(datum);
            const availableWidth = this.getAvailableWidth(datum, positions.get(Text.TEXT_SLOT.FIRST_NAMES));
            const combined = nameGroups.flat();

            const text = parent
                .append("text")
                .attr("dominant-baseline", "middle");

            this.addNameElements(
                text,
                this.truncateNamesData(text, combined, availableWidth),
            );
        } else {
            const nameGroups = this.createNamesData(datum);
            const nameSlots = [Text.TEXT_SLOT.FIRST_NAMES, Text.TEXT_SLOT.LAST_NAMES];

            nameGroups.forEach((nameGroup, index) => {
                const availableWidth = this.getAvailableWidth(datum, positions.get(nameSlots[index]));
                const text = parent
                    .append("text")
                    .attr("dominant-baseline", "middle");

                this.addNameElements(
                    text,
                    this.truncateNamesData(text, nameGroup, availableWidth),
                );
            });

            if (datum.data.data.alternativeName !== "") {
                const availableWidth = this.getAvailableWidth(datum, positions.get(Text.TEXT_SLOT.ALTERNATIVE_NAME));
                const nameGroup = this.createAlternativeNamesData(datum);

                const text = parent
                    .append("text")
                    .attr("dominant-baseline", "middle")
                    .classed("wt-chart-box-name-alt", true)
                    .classed("rtl", datum.data.data.isAltRtl);

                this.addNameElements(
                    text,
                    this.truncateNamesData(text, nameGroup, availableWidth),
                );
            }

            // Depth 6+ outer arcs are too narrow for date text
            if (datum.depth < 6) {
                // Outer labels use plain text elements — slot/position unused
                // since positioning is handled by transformOuterText
                this.renderTimespanLines(parent, datum, positions, (_slot) => parent
                    .append("text")
                    .attr("class", "date")
                    .attr("dominant-baseline", "middle"));
            }
        }

        if (datum.depth >= 8) {
            parent.selectAll("tspan[text-decoration]")
                .attr("text-decoration", null);
        }

        this.transformOuterText(parent, datum);
    }

    /**
     * Appends up to two date lines from datum.data.data.timespan to parent,
     * truncating each with an ellipsis when it exceeds the available arc width.
     * The createElement callback abstracts away the inner/outer difference:
     * inner labels pass a textPath creator, outer labels pass a plain text creator.
     *
     * @param {Selection} parent
     * @param {Object}    datum
     * @param {Map}       positions        Slot-to-position map from calculateSlotPositions()
     * @param {Function}  createElement    Called as (slot, position) => container element
     */
    renderTimespanLines(parent, datum, positions, createElement) {
        if (datum.data.data.timespan === "") {
            return;
        }

        const timespanLines = datum.data.data.timespan.split("\n");
        const dateSlots = [Text.TEXT_SLOT.DATE_LINE_1, Text.TEXT_SLOT.DATE_LINE_2];

        timespanLines.slice(0, dateSlots.length).forEach((line, lineIndex) => {
            const slot = dateSlots[lineIndex];
            const position = positions.get(slot);
            const container = createElement(slot, position);

            container.append("title").text(line);

            const tspan = container.append("tspan").text(line);
            const availableWidth = this.getAvailableWidth(datum, position);

            if (this.getTextLength(container) > availableWidth) {
                container.selectAll("tspan")
                    .each(this.truncateDate(container, availableWidth));

                tspan.text(tspan.text() + "\u2026");
            }
        });
    }

    /**
     * Splits the individual's name into two arrays: first names and last names,
     * preserving the order they appear in the full name string. Each entry carries
     * flags for preferred-name underline and last-name bold styling. Returns
     * [firstNamesArray, lastNamesArray].
     *
     * @param {NameElementData} datum
     *
     * @return {LabelElementData[][]}
     */
    createNamesData(datum) {
        /**
         * @var {LabelElementData[][]} names
         */
        const names = {};
        let minPosFirstnames = Number.MAX_SAFE_INTEGER;
        let minPosLastnames = Number.MAX_SAFE_INTEGER;

        let firstnameOffset = 0;
        const firstnameMap = new Map();

        // Iterate over the individual name components and determine their position in the overall
        // name and insert the component at the corresponding position in the result object.
        for (const firstName of datum.data.data.firstNames) {
            const pos = datum.data.data.name.indexOf(firstName, firstnameOffset);

            if (pos !== -1) {
                firstnameOffset = pos + firstName.length;

                if (pos < minPosFirstnames) {
                    minPosFirstnames = pos;
                }

                firstnameMap.set(
                    pos,
                    {
                        label: firstName,
                        isPreferred: firstName === datum.data.data.preferredName,
                        isLastName: false,
                        isNameRtl: datum.data.data.isNameRtl,
                    },
                );
            }
        }

        names[minPosFirstnames] = [...firstnameMap].map(([, value]) => ( value ));

        let lastnameOffset = 0;
        const lastnameMap = new Map();

        for (const lastName of datum.data.data.lastNames) {
            let pos;

            // Check if last name already exists in first names list, in case first name equals last name
            do {
                pos = datum.data.data.name.indexOf(lastName, lastnameOffset);

                if ((pos !== -1) && firstnameMap.has(pos)) {
                    lastnameOffset = pos + lastName.length;
                }
            } while ((pos !== -1) && firstnameMap.has(pos));

            if (pos !== -1) {
                lastnameOffset = pos;

                if (pos < minPosLastnames) {
                    minPosLastnames = pos;
                }

                lastnameMap.set(
                    pos,
                    {
                        label: lastName,
                        isPreferred: false,
                        isLastName: true,
                        isNameRtl: datum.data.data.isNameRtl,
                    },
                );
            }
        }

        names[minPosLastnames] = [...lastnameMap].map(([, value]) => ( value ));

        // Extract the values (keys don't matter anymore)
        return Object.values(names);
    }

    /**
     * Splits the alternative name into per-word LabelElementData entries,
     * each marked with the isAltRtl flag for correct bidirectional spacing.
     *
     * @param {NameElementData} datum
     *
     * @return {LabelElementData[]}
     */
    createAlternativeNamesData(datum) {
        return datum.data.data.alternativeName.split(/\s+/).map((word) => ({
            label: word,
            isPreferred: false,
            isLastName: false,
            isNameRtl: datum.data.data.isAltRtl,
        }));
    }

    /**
     * Appends one <tspan> per name part to parent. Preferred names receive an
     * underline decoration; last names receive the "lastName" CSS class. Adjacent
     * name parts are spaced 0.25em apart (negated for RTL scripts).
     *
     * @param {Selection}         parent The <text> or <textPath> element to append spans to
     * @param {LabelElementData[]} data  Array of name part descriptors
     */
    addNameElements(parent, data) {
        parent.selectAll("tspan")
            .data(data)
            .enter()
            .call((enterSelection) => {
                enterSelection.append("tspan")
                    .text(datum => datum.label)
                    // Add some spacing between the elements
                    .attr("dx", (datum, index) => {
                        return index !== 0 ? ((datum.isNameRtl ? -1 : 1) * 0.25) + "em" : null;
                    })
                    // Highlight the preferred and last name
                    .attr("text-decoration", datum => datum.isPreferred ? "underline" : null)
                    .classed("lastName", datum => datum.isLastName);
            });
    }

    /**
     * Reads the current font-size and font-weight from the parent element and
     * delegates to truncateNames() with those metrics.
     *
     * @param {Selection}          parent         The <text> or <textPath> element whose font metrics to use
     * @param {LabelElementData[]} names          The name parts to truncate
     * @param {number}             availableWidth Maximum pixel width for the combined name string
     *
     * @return {LabelElementData[]}
     */
    truncateNamesData(parent, names, availableWidth) {
        const fontSize = parent.style("font-size");
        const fontWeight = parent.style("font-weight");

        return this.truncateNames(names, fontSize, fontWeight, availableWidth);
    }

    /**
     * Reduces name parts to initial-letter abbreviations until the joined string
     * fits within availableWidth. Abbreviation order: non-preferred given names
     * first (least important), then the preferred given name, then last names
     * (never dropped entirely). Works on a shallow clone so the caller's array
     * is not mutated.
     *
     * @param {LabelElementData[]} names          Name parts to truncate
     * @param {string}             fontSize       CSS font-size (e.g. "14px")
     * @param {string}             fontWeight     CSS font-weight
     * @param {number}             availableWidth Maximum pixel width for the full name string
     *
     * @return {LabelElementData[]}
     */
    truncateNames(names, fontSize, fontWeight, availableWidth) {
        // Shallow clone each name object to avoid mutating the caller's data.
        // This is safe because all LabelElementData fields are primitives
        // (label: string, isPreferred: bool, isLastName: bool, isNameRtl: bool).
        const workNames = names.map(name => ({...name}));
        let text = workNames.map(item => item.label).join(" ");

        return workNames
            // Start truncating from the last element to the first one
            .reverse()
            .map((name) => {
                // Select all not preferred and not last names
                if ((name.isPreferred === false)
                    && (name.isLastName === false)
                ) {
                    if (this.measureText(text, fontSize, fontWeight) > availableWidth) {
                        // Keep only the first letter
                        name.label = name.label.slice(0, 1) + ".";
                        text = workNames.map(item => item.label).join(" ");
                    }
                }

                return name;
            })
            .map((name) => {
                // Afterward, the preferred ones, if text takes still too much space
                if (name.isPreferred === true) {
                    if (this.measureText(text, fontSize, fontWeight) > availableWidth) {
                        // Keep only the first letter
                        name.label = name.label.slice(0, 1) + ".";
                        text = workNames.map(item => item.label).join(" ");
                    }
                }

                return name;
            })
            .map((name) => {
                // Finally truncate lastnames
                if (name.isLastName === true) {
                    if (this.measureText(text, fontSize, fontWeight) > availableWidth) {
                        // Keep only the first letter
                        name.label = name.label.slice(0, 1) + ".";
                        text = workNames.map(item => item.label).join(" ");
                    }
                }

                return name;
            })
            // Revert reversed order again
            .reverse();
    }

    /**
     * Returns the pixel width of text rendered in the SVG's current font family
     * at the given size and weight. Delegates to the shared canvas-based measure utility.
     *
     * @param {string} text
     * @param {string} fontSize   CSS font-size string (e.g. "14px")
     * @param {string} fontWeight CSS font-weight (default 400)
     *
     * @returns {number}
     */
    measureText(text, fontSize, fontWeight = 400) {
        const fontFamily = this._svg.style("font-family");

        return measureText(text, fontFamily, fontSize, fontWeight);
    }

    /**
     * Returns a callback suitable for use with D3's .each() that strips
     * trailing characters from each <tspan> until the total text length of
     * parent fits within availableWidth, removing a trailing period if present.
     *
     * @param {Selection} parent         The <text> or <textPath> containing the <tspan> children
     * @param {number}    availableWidth Maximum pixel width before truncation kicks in
     *
     * @return {Function}
     */
    truncateDate(parent, availableWidth) {
        const that = this;

        return function () {
            let textLength = that.getTextLength(parent);
            const tspan = d3.select(this);
            let text = tspan.text();

            // Repeat removing the last char until the width matches
            while ((textLength > availableWidth) && (text.length > 1)) {
                // Remove last char
                text = text.slice(0, -1).trim();

                tspan.text(text);

                // Recalculate text length
                textLength = that.getTextLength(parent);
            }

            // Remove trailing dot if present
            if (text[text.length - 1] === ".") {
                tspan.text(text.slice(0, -1).trim());
            }
        };
    }

    /**
     * Returns a float representing the computed length of all <tspan> elements within the element.
     *
     * @param {Selection} parent The parent (<text> or <textPath>) element containing the <tspan> child elements
     *
     * @returns {number}
     */
    getTextLength(parent) {
        let totalWidth = 0;

        // Calculate the total used width of all <tspan> elements
        parent.selectAll("tspan").each(function () {
            totalWidth += this.getComputedTextLength();
        });

        return totalWidth;
    }

    /**
     * Returns true for generations 1 to numberOfInnerCircles, which render
     * text along curved arc paths. Returns false for the center node (depth 0)
     * and for outer generations that use rotated plain text elements.
     *
     * @param {Object} data The D3 partition datum
     */
    isInnerLabel(data) {
        // Note: The center element does not belong to the inner labels!
        return ((data.depth > 0) && (data.depth <= this._configuration.numberOfInnerCircles));
    }

    /**
     * Registers a circular arc <path> in SVG defs at the radial position for
     * the given text slot. The path ID is derived from parentId and slot.index.
     * During updates, if a path with that ID already exists, a numeric suffix
     * is appended so old and new textPaths can coexist during the cross-fade.
     * Reverses start/end angles for flipped labels in the bottom half of 360° charts.
     *
     * @param {string} parentId The ID of the parent person/marriage element
     * @param {Object} slot     One of the TEXT_SLOT constants (carries .index for the path ID)
     * @param {{normal: number, flipped: number}} position Radial percentage positions for this slot
     * @param {Object} data     The D3 partition datum
     *
     * @return {string} The id attribute of the newly created <path> element
     */
    createPathDefinition(parentId, slot, position, data) {
        let pathId = "path-" + parentId + "-" + slot.index;

        // If path already exists (update case), create a new one with a unique ID
        // so old text keeps its path during fade-out and new text gets correct position
        if (this._svg.defs.select("path#" + pathId).node()) {
            pathId = pathId + "-" + this._svg.defs.get().selectAll("path[id^='" + pathId + "']").size();
        }

        const positionFlipped = this.isPositionFlipped(data.depth, data.x0, data.x1);
        const startAngle = this._geometry.startAngle(data.depth, data.x0);
        const endAngle = this._geometry.endAngle(data.depth, data.x1);
        const relativeRadius = this._geometry.relativeRadius(data.depth, this.getTextOffset(positionFlipped, position));

        // Create an arc generator for path segments
        const arcGenerator = d3.arc()
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
        this._svg.defs
            .append("path")
            .attr("id", pathId)
            .attr("d", arcGenerator);

        return pathId;
    }

    /**
     * Check for the 360-degree chart if the current arc labels should be flipped for easier reading.
     *
     * @param {number} depth The depth of the element inside the chart
     * @param {number} x0    The left edge (x0) of the rectangle
     * @param {number} x1    The right edge (x1) of the rectangle
     */
    isPositionFlipped(depth, x0, x1) {
        return this._geometry.isPositionFlipped(depth, x0, x1);
    }

    /**
     * Text slot identifiers used for unique path IDs.
     *
     * @type {Object<string, {index: number}>}
     */
    static TEXT_SLOT = {
        FIRST_NAMES:      { index: 0 },
        LAST_NAMES:       { index: 1 },
        ALTERNATIVE_NAME: { index: 2 },
        DATE_LINE_1:      { index: 3 },
        DATE_LINE_2:      { index: 4 },
    };

    /**
     * Calculates text positions grouped by semantic relationship. Names
     * (first, last, alternative) form one group, dates another. Items within
     * a group use tighter spacing; groups are separated by a wider gap.
     * The result is vertically centered in the available arc space.
     *
     * @param {Object} datum The D3 data object
     *
     * @return {Map<Object, {normal: number, flipped: number}>}
     */
    calculateSlotPositions(datum) {
        // Build semantic groups: names, alternative name, dates
        const nameGroup = [Text.TEXT_SLOT.FIRST_NAMES, Text.TEXT_SLOT.LAST_NAMES];
        const altGroup = [];
        const dateGroup = [];

        if (datum.data.data.alternativeName !== "") {
            altGroup.push(Text.TEXT_SLOT.ALTERNATIVE_NAME);
        }

        if (datum.data.data.timespan !== "") {
            const lines = datum.data.data.timespan.split("\n");
            dateGroup.push(Text.TEXT_SLOT.DATE_LINE_1);

            if (lines.length > 1) {
                dateGroup.push(Text.TEXT_SLOT.DATE_LINE_2);
            }
        }

        const groups = [nameGroup];

        if (altGroup.length > 0) {
            groups.push(altGroup);
        }

        if (dateGroup.length > 0) {
            groups.push(dateGroup);
        }

        // Spacing within a group (tight) vs. between groups (wide), in percent
        // of the arc height. Tuned relative to the base font size (22px).
        let intraGroupSpacing = 16;
        let interGroupSpacing = 24;

        // Total vertical extent of all groups
        let totalHeight = 0;

        groups.forEach((group, gi) => {
            totalHeight += (group.length - 1) * intraGroupSpacing;

            if (gi < (groups.length - 1)) {
                totalHeight += interGroupSpacing;
            }
        });

        // Center within usable range (0 = inner edge, 100 = outer edge).
        // rangeMax accounts for the color arc strip at the outer edge.
        const rangeMin = 5;
        const rangeMax = 78;
        const availableHeight = rangeMax - rangeMin;

        // Compress spacing proportionally if content exceeds the safe zone
        if (totalHeight > availableHeight) {
            const scale = availableHeight / totalHeight;
            intraGroupSpacing *= scale;
            interGroupSpacing *= scale;

            totalHeight = availableHeight;
        }

        const rangeMid = (rangeMin + rangeMax) / 2;
        let currentPos = rangeMid + (totalHeight / 2);

        const positions = new Map();

        groups.forEach((group, gi) => {
            group.forEach((slot, si) => {
                positions.set(slot, {
                    normal:  currentPos,
                    flipped: 100 - currentPos,
                });

                if (si < (group.length - 1)) {
                    currentPos -= intraGroupSpacing;
                }
            });

            if (gi < (groups.length - 1)) {
                currentPos -= interGroupSpacing;
            }
        });

        return positions;
    }

    /**
     * Get the relative position offset in percent for a text slot.
     *   => (0 = inner radius, 100 = outer radius)
     *
     * @param {boolean}                           positionFlipped TRUE if the labels should be flipped
     * @param {{normal: number, flipped: number}} position        The calculated position for this slot
     *
     * @return {number}
     */
    getTextOffset(positionFlipped, position) {
        return positionFlipped ? position.flipped : position.normal;
    }

    /**
     * Computes the maximum pixel width available for a text line at the given
     * radial slot. Outer arcs use a fixed arc-height-based width; inner arcs
     * use the arc chord length at the slot's radial percentage; the center
     * circle uses a fraction of its diameter. Image presence further reduces
     * the width by imageSize + 10 px gap.
     *
     * @param {Object}                            data     The D3 partition datum
     * @param {{normal: number, flipped: number}} position Radial slot position from calculateSlotPositions()
     *
     * @returns {number}
     */
    getAvailableWidth(data, position) {
        // Outer arcs
        if (data.depth > this._configuration.numberOfInnerCircles) {
            return this._configuration.outerArcHeight
                - (this._configuration.textPadding * 2)
                - this._configuration.circlePadding;
        }

        // Innermost circle (Reducing the width slightly, avoiding the text is sticking too close to the edge)
        let availableWidth = (this._configuration.centerCircleRadius * 2) - (this._configuration.centerCircleRadius * 0.15);

        if (data.depth >= 1) {
            const positionFlipped = this.isPositionFlipped(data.depth, data.x0, data.x1);

            // Calculate length of the arc
            availableWidth = this._geometry.arcLength(data, this.getTextOffset(positionFlipped, position));
        }

        availableWidth = availableWidth - (this._configuration.textPadding * 2)
            - (this._configuration.padDistance / 2);

        // Reduce available width when an image is present.
        // imageSize is pre-computed and set on the datum by Person.init() before labels are rendered.
        const imageSize = data.data.data.imageSize || 0;

        if (imageSize > 0) {
            availableWidth -= (imageSize + 10);
        }

        return availableWidth;
    }

    /**
     * Positions all <text> elements within the label group. For the center node
     * (depth 0), stacks them vertically using dy offsets, accounting for a
     * thumbnail image above the text when present. For outer arcs, applies a
     * rotate+translate transform to align each line with the segment's angular
     * center using semantic group spacing (see calculateOuterSlotPositions).
     *
     * @param {Selection} parent The label <g> element whose <text> children to position
     * @param {Object}    datum  The D3 partition datum
     */
    transformOuterText(parent, datum) {
        const that = this;
        const textElements = parent.selectAll("text");
        const countElements = textElements.size();

        // Center person: vertical stacking via dy.
        // imageSize is pre-computed and set on the datum by Person.init() before labels are rendered.
        if (datum.depth === 0) {
            const fontSize = that._geometry.getFontSize(datum);
            const imageSize = datum.data.data.imageSize || 0;

            if (imageSize > 0) {
                // Image present: use absolute positioning to center image + text block.
                // Tight spacing within groups (name/date), larger gap between groups.
                const imageGap = 6;
                const innerLineHeight = fontSize * 0.95;
                const groupGap = fontSize * 0.45;

                // Only include group gap when both names and dates are present
                let hasNames = false;
                let hasDates = false;

                textElements.each(function () {
                    if (d3.select(this).classed("date")) {
                        hasDates = true;
                    } else {
                        hasNames = true;
                    }
                });

                const actualGroupGap = (hasNames && hasDates) ? groupGap : 0;
                const textHeight = (countElements * innerLineHeight) + actualGroupGap;
                const totalHeight = imageSize + imageGap + textHeight;

                let currentY = -(totalHeight / 2) + imageSize + imageGap + (innerLineHeight / 2);
                let prevIsDate = false;

                textElements.each(function () {
                    const isDate = d3.select(this).classed("date");

                    // Add group gap when switching from names to dates
                    if (isDate && !prevIsDate) {
                        currentY += groupGap;
                    }

                    d3.select(this).attr("dy", currentY + "px");

                    currentY += innerLineHeight;
                    prevIsDate = isDate;
                });
            } else {
                // No image: use original index-based offset positioning
                const offset = Math.max(1.0, countElements * 0.4);

                const mapIndexToOffset = d3.scaleLinear()
                    .domain([0, countElements - 1])
                    .range([-offset, offset]);

                textElements.each(function (_ignore, i) {
                    const offsetRotate = mapIndexToOffset(i) * that._configuration.fontScale / 100.0;
                    const isDate = d3.select(this).classed("date");
                    const groupShift = fontSize * 0.15;

                    d3.select(this).attr("dy",
                        (offsetRotate * fontSize) + (fontSize / 2)
                        + (isDate ? groupShift : -groupShift)
                        + "px",
                    );
                });
            }

            return;
        }

        // Outer labels: use semantic group spacing (same logic as inner
        // labels in calculateSlotPositions) but in angular degrees.
        const angularPositions = this.calculateOuterSlotPositions(datum, textElements);

        textElements.each(function (ignore, i) {
            const offsetRotate = angularPositions[i] * that._configuration.fontScale / 100.0;

            d3.select(this).attr("transform", function () {
                const dx = datum.x1 - datum.x0;
                const angle = that._geometry.scale(datum.x0 + (dx / 2)) * MATH_RAD2DEG;
                let rotate = angle - (offsetRotate * (angle > 0 ? -1 : 1));
                let translate = (that._geometry.centerRadius(datum.depth) - (that._configuration.colorArcWidth / 2.0));

                if (angle > 0) {
                    rotate -= 90;
                } else {
                    translate = -translate;
                    rotate += 90;
                }

                return "rotate(" + rotate + ") translate(" + translate + ")";
            });
        });
    }

    /**
     * Calculates angular offsets for outer text elements using the same
     * semantic grouping as calculateSlotPositions: names form one tight
     * group, dates another, with a wider gap between groups. Positions
     * are returned as degree offsets from the arc center, vertically
     * centered within the available angular span.
     *
     * @param {Object}    datum        The D3 data object
     * @param {Selection} textElements The text elements to position
     *
     * @return {number[]} Angular offset in degrees for each text element
     */
    calculateOuterSlotPositions(datum, textElements) {
        // Build element groups: [names...], [dates...]
        const groups = [{ items: [], isDate: false }];

        textElements.each(function () {
            if (d3.select(this).classed("date")) {
                // Start a new group for the first date
                if ((groups[groups.length - 1].items.length > 0)
                    && !groups[groups.length - 1].isDate
                ) {
                    groups.push({ items: [], isDate: true });
                }

                groups[groups.length - 1].items.push(this);
            } else {
                groups[0].items.push(this);
            }
        });

        // Convert pixel-based spacing to degrees at this radius
        const fontSize = this._geometry.getFontSize(datum);
        const centerRadius = this._geometry.centerRadius(datum.depth);
        const degPerPixel = MATH_RAD2DEG / centerRadius;

        // Same ratio as inner labels: intraGroup = 16/73 of available,
        // interGroup = 24/73. Convert to pixel gap then to degrees.
        const intraGapPx = fontSize * 1.05;
        const interGapPx = fontSize * 1.3;

        let intraGapDeg = intraGapPx * degPerPixel;
        let interGapDeg = interGapPx * degPerPixel;

        // Compute total height
        let totalDeg = 0;

        groups.forEach((group, gi) => {
            totalDeg += (group.items.length - 1) * intraGapDeg;

            if (gi < (groups.length - 1)) {
                totalDeg += interGapDeg;
            }
        });

        // Cap to 50% of angular span, compress proportionally if needed
        const angularSpanDeg = (datum.x1 - datum.x0) * 360;
        const maxDeg = angularSpanDeg * 0.5;

        if ((totalDeg > maxDeg) && (totalDeg > 0)) {
            const scale = maxDeg / totalDeg;
            intraGapDeg *= scale;
            interGapDeg *= scale;
            totalDeg = maxDeg;
        }

        // Center and assign positions (names at negative = inner side,
        // dates at positive = outer side, matching the old convention)
        let currentPos = -(totalDeg / 2);
        const positions = [];

        groups.forEach((group, gi) => {
            group.items.forEach((element, si) => {
                positions.push(currentPos);

                if (si < (group.items.length - 1)) {
                    currentPos += intraGapDeg;
                }
            });

            if (gi < (groups.length - 1)) {
                currentPos += interGapDeg;
            }
        });

        return positions;
    }
}
