/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../d3.js";
import { MATH_RAD2DEG } from "./geometry.js";

/**
 * @import { Selection } from "d3-selection"
 * @import Configuration from "../configuration.js"
 * @import Geometry from "./geometry.js"
 * @import { HierarchyNode } from "../hierarchy.js"
 */

/**
 * Vertical offsets of every text slot within an arc band, keyed by the slot
 * objects in TEXT_SLOT. The two variants correspond to arcs read in
 * reading direction and arcs flipped by 180 degrees.
 *
 * @typedef {Map<TextSlot, SlotPosition>} SlotPositions
 */

/**
 * One of the TEXT_SLOT identifiers. Its index names the slot's path.
 *
 * @typedef {object} TextSlot
 * @property {number} index The slot index used in the path ID
 */

/**
 * Radial percentage positions of one text slot (0 = inner radius, 100 =
 * outer radius), for arcs read in reading direction and for flipped arcs.
 *
 * @typedef {object} SlotPosition
 * @property {number} normal  The position on an arc read in reading direction
 * @property {number} flipped The position on an arc flipped by 180 degrees
 */

/**
 * Text slot identifiers used for unique path IDs.
 *
 * @type {{
 *     FIRST_NAMES: TextSlot,
 *     LAST_NAMES: TextSlot,
 *     ALTERNATIVE_NAME: TextSlot,
 *     DATE_LINE_1: TextSlot,
 *     DATE_LINE_2: TextSlot,
 * }}
 */
export const TEXT_SLOT = {
    FIRST_NAMES: { index: 0 },
    LAST_NAMES: { index: 1 },
    ALTERNATIVE_NAME: { index: 2 },
    DATE_LINE_1: { index: 3 },
    DATE_LINE_2: { index: 4 },
};

/**
 * The layout of the labels of one arc: which label style an arc gets, where the
 * lines of the label stack sit, how wide a line may be and how the lines of an
 * outer label are spread. It reads the geometry and the configuration and
 * draws nothing.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class ArcLabelLayout {
    /**
     * @param {Configuration} configuration The application configuration
     * @param {Geometry}      geometry      The geometry of the chart
     */
    constructor(configuration, geometry) {
        this._configuration = configuration;
        this._geometry = geometry;
    }

    /**
     * Returns the timespan to render for the datum. A descendant child shows its
     * year-only range instead of the regular timespan while the child arcs are
     * too narrow for places.
     *
     * @param {HierarchyNode} datum The D3 partition datum
     *
     * @return {string}
     */
    getTimespan(datum) {
        const data = datum.data.data;

        if (
            datum.depth <= -2 &&
            this._geometry.compactChildren &&
            data.compactTimespan !== undefined
        ) {
            return data.compactTimespan;
        }

        return data.timespan;
    }
    /**
     * Returns true for generations 1 to numberOfInnerCircles, which render text
     * along curved arc paths. Returns false for the center node (depth 0) and
     * for outer generations that use rotated plain text elements.
     *
     * @param {HierarchyNode} data The D3 partition datum
     *
     * @return {boolean}
     */
    isInnerLabel(data) {
        // Note: The center element does not belong to the inner labels!
        if (data.depth < 0) {
            // Descendants in inner-arc radial bands use arc-path text when
            // the segment is wide enough; narrow segments fall back to
            // rotated outer-style text that fits in the arc height.
            if (Math.abs(data.depth) > this._configuration.numberOfInnerCircles) {
                return false;
            }

            // Compute angular width from fraction * total sector to ensure
            // all siblings get the same result (avoids floating-point
            // boundary issues with individual startAngle/endAngle calls)
            const totalSectorRad =
                this._geometry.endAngle(data.depth, 1) - this._geometry.startAngle(data.depth, 0);
            const angularWidthDeg = (data.x1 - data.x0) * totalSectorRad * MATH_RAD2DEG;
            const minArcDeg = data.depth === -1 ? 30 : 20;

            return angularWidthDeg >= minArcDeg;
        }

        return data.depth > 0 && data.depth <= this._configuration.numberOfInnerCircles;
    }
    /**
     * Calculates text positions grouped by semantic relationship. Names (first,
     * last, alternative) form one group, dates another. Items within a group
     * use tighter spacing; groups are separated by a wider gap. The result is
     * vertically centered in the available arc space.
     *
     * @param {HierarchyNode} datum The D3 data object
     *
     * @return {SlotPositions}
     */
    calculateSlotPositions(datum) {
        // Build semantic groups: names, alternative name, dates.
        // When one name part is empty (e.g. CJK names with no separate
        // first name), exclude it from spacing but still assign a position
        // so slot lookups don't fail.
        const hasFirstNames = datum.data.data.firstNames && datum.data.data.firstNames.length > 0;
        const hasLastNames = datum.data.data.lastNames && datum.data.data.lastNames.length > 0;
        /** @type {TextSlot[]} */
        const nameGroup = [];

        if (hasFirstNames) {
            nameGroup.push(TEXT_SLOT.FIRST_NAMES);
        }

        if (hasLastNames) {
            nameGroup.push(TEXT_SLOT.LAST_NAMES);
        }

        if (nameGroup.length === 0) {
            nameGroup.push(TEXT_SLOT.FIRST_NAMES);
        }

        /** @type {TextSlot[]} */
        const altGroup = [];
        /** @type {TextSlot[]} */
        const dateGroup = [];

        if (datum.data.data.alternativeName !== "") {
            altGroup.push(TEXT_SLOT.ALTERNATIVE_NAME);
        }

        const timespan = this.getTimespan(datum);

        if (timespan !== "") {
            const lines = timespan.split("\n");
            dateGroup.push(TEXT_SLOT.DATE_LINE_1);

            if (lines.length > 1) {
                dateGroup.push(TEXT_SLOT.DATE_LINE_2);
            }
        }

        const groups = [nameGroup];

        if (altGroup.length > 0) {
            groups.push(altGroup);
        }

        if (dateGroup.length > 0) {
            groups.push(dateGroup);
        }

        // Compute spacing dynamically based on font size relative to arc height.
        // This ensures consistent visual gaps across all generations regardless
        // of depth-dependent font scaling.
        const fontSize = this._geometry.getFontSize(datum);
        const arcHeight =
            this._geometry.outerRadius(datum.depth) - this._geometry.innerRadius(datum.depth);
        const fontPercent = (fontSize / arcHeight) * 100;

        let intraNameSpacing = fontPercent * 1.1;
        let intraDateSpacing = fontPercent * 1.0;
        let interGroupSpacing = fontPercent * 1.5;

        // Total vertical extent of all groups using group-specific spacing
        let totalHeight = 0;

        groups.forEach((group, gi) => {
            const isDateGroup = group[0] === TEXT_SLOT.DATE_LINE_1;
            const intraSpacing = isDateGroup ? intraDateSpacing : intraNameSpacing;

            totalHeight += (group.length - 1) * intraSpacing;

            if (gi < groups.length - 1) {
                totalHeight += interGroupSpacing;
            }
        });

        // Center within usable range (0 = inner edge, 100 = outer edge).
        // Margins shrink with more content lines so the text block can
        // spread out instead of compressing into a fixed inner area.
        const totalLines = groups.reduce((sum, g) => sum + g.length, 0);
        const colorArcPercent = (this._configuration.colorArcWidth / arcHeight) * 100;
        const marginFactor = totalLines <= 4 ? 0.6 : 0.25;
        const minMargin = fontPercent * marginFactor;
        const rangeMin = Math.max(3, minMargin);
        const rangeMax = 100 - Math.max(3, minMargin) - colorArcPercent;
        const availableHeight = rangeMax - rangeMin;

        // Scale fill allowance with content: more lines may use more of the range
        const fillRatio = 0.85;
        const maxFill = availableHeight * fillRatio;

        if (totalHeight > maxFill) {
            const scale = maxFill / totalHeight;
            intraNameSpacing *= scale;
            intraDateSpacing *= scale;
            interGroupSpacing *= scale;

            totalHeight = maxFill;
        }

        const rangeMid = (rangeMin + rangeMax) / 2;
        let currentPos = rangeMid + totalHeight / 2;

        // Compensate for SVG text baseline: text renders with its baseline
        // on the arc path, but the visual center of glyphs sits above the
        // baseline. Shift each path position outward (higher %) so the
        // visual center lands at the intended position.
        const normalOffsetPercent = ((fontSize * 0.375) / arcHeight) * 100;
        const flippedOffsetPercent = ((fontSize * 0.2) / arcHeight) * 100;

        /** @type {SlotPositions} */
        const positions = new Map();
        const normalOffset = datum.depth < 0 ? 0 : normalOffsetPercent;

        groups.forEach((group, gi) => {
            const isDateGroup = group[0] === TEXT_SLOT.DATE_LINE_1;
            const intraSpacing = isDateGroup ? intraDateSpacing : intraNameSpacing;

            group.forEach((slot, si) => {
                positions.set(slot, {
                    normal: currentPos - normalOffset,
                    flipped: 100 - currentPos + flippedOffsetPercent,
                });

                if (si < group.length - 1) {
                    currentPos -= intraSpacing;
                }
            });

            if (gi < groups.length - 1) {
                currentPos -= interGroupSpacing;
            }
        });

        // Ensure both name slots have a position even if one was excluded
        // from spacing. Copy the other's position so lookups don't fail.
        const firstNamesPosition = positions.get(TEXT_SLOT.FIRST_NAMES);
        const lastNamesPosition = positions.get(TEXT_SLOT.LAST_NAMES);

        if (firstNamesPosition === undefined && lastNamesPosition !== undefined) {
            positions.set(TEXT_SLOT.FIRST_NAMES, lastNamesPosition);
        } else if (lastNamesPosition === undefined && firstNamesPosition !== undefined) {
            positions.set(TEXT_SLOT.LAST_NAMES, firstNamesPosition);
        }

        return positions;
    }
    /**
     * Get the relative position offset in percent for a text slot.
     *   => (0 = inner radius, 100 = outer radius)
     *
     * @param {boolean}      positionFlipped TRUE if the labels should be flipped
     * @param {SlotPosition} position        The calculated position for this slot
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
     * @param {HierarchyNode} data     The D3 partition datum
     * @param {SlotPosition}  position Radial slot position from calculateSlotPositions()
     *
     * @return {number}
     */
    getAvailableWidth(data, position) {
        // Descendant arcs: dispatch to inner or outer width based on label style
        if (data.depth < 0) {
            if (!this.isInnerLabel(data)) {
                // Narrow descendant arcs use rotated text -- width = actual arc height
                const arcHeight =
                    this._geometry.outerRadius(data.depth) - this._geometry.innerRadius(data.depth);

                return arcHeight - this._configuration.textPadding * 2;
            }

            // Wide descendant arcs use arc-path text -- width = chord length
            const positionFlipped = this._geometry.isPositionFlipped(data.depth, data.x0, data.x1);
            let availableWidth = this._geometry.arcLength(
                data,
                this.getTextOffset(positionFlipped, position),
            );

            availableWidth =
                availableWidth -
                this._configuration.textPadding * 2 -
                this._configuration.padDistance / 2;

            return availableWidth;
        }

        // Outer arcs
        if (data.depth > this._configuration.numberOfInnerCircles) {
            return (
                this._configuration.outerArcHeight -
                this._configuration.textPadding * 2 -
                this._configuration.circlePadding
            );
        }

        // Innermost circle (Reducing the width slightly, avoiding the text is sticking too close to the edge)
        let availableWidth =
            this._configuration.centerCircleRadius * 2 -
            this._configuration.centerCircleRadius * 0.15;

        if (data.depth >= 1) {
            const positionFlipped = this._geometry.isPositionFlipped(data.depth, data.x0, data.x1);

            // Calculate length of the arc
            availableWidth = this._geometry.arcLength(
                data,
                this.getTextOffset(positionFlipped, position),
            );
        }

        availableWidth =
            availableWidth -
            this._configuration.textPadding * 2 -
            this._configuration.padDistance / 2;

        // Reduce available width when an image is present.
        // imageSize is pre-computed and set on the datum by Person.init() before labels are rendered.
        const imageSize = data.data.data.imageSize || 0;

        if (imageSize > 0) {
            availableWidth -= imageSize + 10;
        }

        return availableWidth;
    }
    /**
     * Calculates angular offsets for outer text elements using the same
     * semantic grouping as calculateSlotPositions: names form one tight group,
     * dates another, with a wider gap between groups. Positions are returned as
     * degree offsets from the arc center, vertically centered within the
     * available angular span.
     *
     * @param {HierarchyNode}                 datum        The D3 data object
     * @param {Selection<any, any, any, any>} textElements The text elements to position
     *
     * @return {number[]} Angular offset in degrees for each text element
     */
    calculateOuterSlotPositions(datum, textElements) {
        // Build element groups: [names...], [dates...]
        /** @type {{ items: unknown[], isDate: boolean }} */
        const nameGroup = { items: [], isDate: false };
        const groups = [nameGroup];
        // The group dates are appended to, always the last one in groups
        let lastGroup = nameGroup;

        textElements.each(function () {
            if (d3.select(this).classed("date")) {
                // Start a new group for the first date
                if (lastGroup.items.length > 0 && !lastGroup.isDate) {
                    lastGroup = { items: [], isDate: true };
                    groups.push(lastGroup);
                }

                lastGroup.items.push(this);
            } else {
                nameGroup.items.push(this);
            }
        });

        // Convert pixel-based spacing to degrees at this radius.
        // Use the same ratios as inner arc labels (calculateSlotPositions).
        const fontSize = this._geometry.getFontSize(datum);
        const centerRadius = this._geometry.centerRadius(datum.depth);
        const degPerPixel = MATH_RAD2DEG / centerRadius;

        const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
        const intraNameGapPx = fontSize * 1.1;
        const intraDateGapPx = fontSize * 1.0;
        const interGapPx = fontSize * (totalItems <= 3 ? 1.0 : 1.5);

        let intraNameGapDeg = intraNameGapPx * degPerPixel;
        let intraDateGapDeg = intraDateGapPx * degPerPixel;
        let interGapDeg = interGapPx * degPerPixel;

        // Compute total angular extent using group-specific spacing
        let totalDeg = 0;

        groups.forEach((group, gi) => {
            const intraGap = group.isDate ? intraDateGapDeg : intraNameGapDeg;
            totalDeg += (group.items.length - 1) * intraGap;

            if (gi < groups.length - 1) {
                totalDeg += interGapDeg;
            }
        });

        // Cap to 85% of angular span, compress proportionally if needed
        const angularSpanDeg = this._geometry.angularWidthDeg(datum);
        const maxDeg = angularSpanDeg * 0.85;

        if (totalDeg > maxDeg && totalDeg > 0) {
            const scale = maxDeg / totalDeg;
            intraNameGapDeg *= scale;
            intraDateGapDeg *= scale;
            interGapDeg *= scale;
            totalDeg = maxDeg;
        }

        // Center and assign positions (names at negative = inner side,
        // dates at positive = outer side, matching the old convention)
        let currentPos = -(totalDeg / 2);
        /** @type {number[]} */
        const positions = [];

        groups.forEach((group, gi) => {
            const intraGap = group.isDate ? intraDateGapDeg : intraNameGapDeg;

            group.items.forEach((_element, si) => {
                positions.push(currentPos);

                if (si < group.items.length - 1) {
                    currentPos += intraGap;
                }
            });

            if (gi < groups.length - 1) {
                currentPos += interGapDeg;
            }
        });

        return positions;
    }
}
