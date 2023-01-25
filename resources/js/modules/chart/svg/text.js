/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "./../../d3";
import Geometry, {MATH_DEG2RAD, MATH_RAD2DEG} from "./geometry";

/**
 * The class handles all the text and path elements.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Text
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
        this._geometry      = new Geometry(this._configuration);
    }

    /**
     * Creates all the labels and all dependent elements for a single person.
     *
     * @param {selection} parent The parent element to which the elements are to be attached
     * @param {Object}    datum  The D3 data object
     */
    createLabels(parent, datum)
    {
        // Inner labels
        if (this.isInnerLabel(datum)) {
            let parentId = d3.select(parent.node().parentNode).attr("id");

            // First names
            if (datum.data.firstNames.length) {
                let pathId1   = this.createPathDefinition(parentId, 0, datum);
                let textPath1 = parent
                    .append("text")
                    .append("textPath")
                    .attr("xlink:href", "#" + pathId1)
                    .attr("startOffset", "25%");

                this.addFirstNames(textPath1, datum);
                this.truncateNames(textPath1, datum, 0);
            }

            // Last names
            if (datum.data.lastNames.length) {
                let pathId2   = this.createPathDefinition(parentId, 1, datum);
                let textPath2 = parent
                    .append("text")
                    .append("textPath")
                    .attr("xlink:href", "#" + pathId2)
                    .attr("startOffset", "25%");

                this.addLastNames(textPath2, datum);
                this.truncateNames(textPath2, datum, 1);
            }

            // If both first and last names are empty, add the full name as alternative
            if (!datum.data.firstNames.length
                && !datum.data.lastNames.length
            ) {
                let pathId1   = this.createPathDefinition(parentId, 0, datum);
                let textPath1 = parent
                    .append("text")
                    .append("textPath")
                    .attr("xlink:href", "#" + pathId1)
                    .attr("startOffset", "25%");

                textPath1.append("tspan")
                    .text(datum.data.name);

                this.truncateNames(textPath1, datum, 0);
            }

            // Alternative names
            if (datum.data.alternativeNames.length) {
                let pathId3   = this.createPathDefinition(parentId, 2, datum);
                let textPath3 = parent
                    .append("text")
                    .append("textPath")
                    .attr("xlink:href", "#" + pathId3)
                    .attr("startOffset", "25%")
                    .attr("class", "alternativeName")
                    .classed("rtl", datum.data.isAltRtl);

                this.addAlternativeNames(textPath3, datum);
                this.truncateNames(textPath3, datum, 2);
            }

            // Birth and death date
            let pathId4   = this.createPathDefinition(parentId, 3, datum);
            let textPath4 = parent
                .append("text")
                .append("textPath")
                .attr("xlink:href", "#" + pathId4)
                .attr("startOffset", "25%")
                .attr("class", "date");

            textPath4.append("title")
                .text(datum.data.timespan);

            // Create a <tspan> element for the time span
            let tspan = textPath4.append("tspan")
                .text(datum.data.timespan);

            let availableWidth = this.getAvailableWidth(datum, 3);

            if (this.getTextLength(textPath4) > availableWidth) {
                textPath4.selectAll("tspan")
                    .each(this.truncateDate(textPath4, availableWidth));

                tspan.text(tspan.text() + "\u2026");
            }

        // Outer labels
        } else {
            // The outer most circles show the complete name and do
            // not distinguish between first name, last name and dates
            if (datum.depth >= 7) {
                let text1 = parent
                    .append("text")
                    .attr("dy", "2px");

                if (datum.data.firstNames.length) {
                    this.addFirstNames(text1, datum);
                }

                if (datum.data.lastNames.length) {
                    this.addLastNames(text1, datum, 0.25);
                }

                // If both first and last names are empty, add the full name as alternative
                if (!datum.data.firstNames.length
                    && !datum.data.lastNames.length
                ) {
                    text1.append("tspan")
                        .text(datum.data.name);
                }

                this.truncateNames(text1, datum, 0);
            }

            else {
                // First names
                if (datum.data.firstNames.length) {
                    let text2 = parent
                        .append("text")
                        .attr("dy", "2px");

                    this.addFirstNames(text2, datum);
                    this.truncateNames(text2, datum, 0);
                }

                // Last names
                if (datum.data.lastNames.length) {
                    let text3 = parent
                        .append("text")
                        .attr("dy", "2px");

                    this.addLastNames(text3, datum);
                    this.truncateNames(text3, datum, 1);
                }

                // If both first and last names are empty, add the full name as alternative
                if (!datum.data.firstNames.length
                    && !datum.data.lastNames.length
                ) {
                    let text2 = parent
                        .append("text")
                        .attr("dy", "2px");

                    text2.append("tspan")
                        .text(datum.data.name);

                    this.truncateNames(text2, datum, 0);
                }

                // Birth and death date
                if (datum.depth < 6) {
                    // Birth and death date
                    let text4 = parent
                        .append("text")
                        .attr("class", "date")
                        .attr("dy", "2px");

                    text4.append("title")
                        .text(datum.data.timespan);

                    // Create a <tspan> element for the time span
                    let tspan = text4.append("tspan")
                        .text(datum.data.timespan);

                    let availableWidth = this.getAvailableWidth(datum, 2);

                    if (this.getTextLength(text4) > availableWidth) {
                        text4.selectAll("tspan")
                            .each(this.truncateDate(text4, availableWidth));

                        tspan.text(tspan.text() + "\u2026");
                    }
                }
            }

            // Rotate outer labels in right position
            this.transformOuterText(parent, datum);
        }

        // Marriage date
        if (this._configuration.showParentMarriageDates && datum.children && (datum.depth < 5)) {
            let parentId5 = d3.select(parent.node().parentNode).attr("id");
            let pathId5   = this.createPathDefinition(parentId5, 4, datum);
            let textPath5 = parent
                .append("text")
                .append("textPath")
                .attr("xlink:href", "#" + pathId5)
                .attr("startOffset", "25%")
                .attr("class", "marriage-date");

            this.addMarriageDate(textPath5, datum);
        }
    }

    /**
     * Creates a single <tspan> element for each single given name and append it to the
     * parent element. The "tspan" element containing the preferred name gets an
     * additional underline style in order to highlight this one.
     *
     * @param {selection} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object}    datum  The D3 data object containing the individual data
     */
    addFirstNames(parent, datum)
    {
        let i = 0;

        for (let firstName of datum.data.firstNames) {
            // Create a <tspan> element for each given name
            let tspan = parent.append("tspan")
                .text(firstName);

            // The preferred name
            if (firstName === datum.data.preferredName) {
                tspan.attr("class", "preferred");
            }

            // Add some spacing between the elements
            if (i !== 0) {
                tspan.attr("dx", "0.25em");
            }

            ++i;
        }
    }

    /**
     * Creates a single <tspan> element for each last name and append it to the parent element.
     *
     * @param {selection} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object}    datum  The D3 data object containing the individual data
     * @param {Number}    dx     Additional space offset to add between names
     */
    addLastNames(parent, datum, dx = 0)
    {
        let i = 0;

        for (let lastName of datum.data.lastNames) {
            // Create a <tspan> element for each last name
            let tspan = parent.append("tspan")
                .attr("class", "lastName")
                .text(lastName);

            // Add some spacing between the elements
            if (i !== 0) {
                tspan.attr("dx", "0.25em");
            }

            if (dx !== 0) {
                tspan.attr("dx", dx + "em");
            }

            ++i;
        }
    }

    /**
     * Creates a single <tspan> element for each alternative name and append it to the parent element.
     *
     * @param {selection} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object}    datum  The D3 data object containing the individual data
     * @param {Number}    dx     Delta X offset used to create a small spacing between multiple words
     */
    addAlternativeNames(parent, datum, dx = 0)
    {
        let i = 0;

        for (let alternativeName of datum.data.alternativeNames) {
            // Create a <tspan> element for each alternative name
            let tspan = parent.append("tspan")
                .text(alternativeName);

            // Add some spacing between the elements
            if (i !== 0) {
                tspan.attr("dx", (datum.data.isAltRtl ? -0.25 : 0.25) + "em");
            }

            ++i;
        }
    }

    /**
     * Creates a single <tspan> element for the marriage date and append it to the parent element.
     *
     * @param {selection} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object}    datum  The D3 data object containing the individual data
     */
    addMarriageDate(parent, datum)
    {
        // Create a <tspan> element for the parent marriage date
        if (datum.data.parentMarriage) {
            parent.append("tspan")
                .text("\u26AD " + datum.data.parentMarriage);
        }
    }

    /**
     * Loops over the <tspan> elements and truncates the contained texts.
     *
     * @param {selection} parent The parent (<text> or <textPath>) element to which the <tspan> elements are attached
     * @param {Object}    datum  The D3 data object containing the individual data
     * @param {Number}    index  The index position of the element in parent container.
     */
    truncateNames(parent, datum, index)
    {
        // The total available width that the text can occupy
        let availableWidth = this.getAvailableWidth(datum, index);

        // Select all not preferred names and not last names
        // Start truncating from last element to the first one
        parent.selectAll("tspan:not(.preferred):not(.lastName)")
            .nodes()
            .reverse()
            .forEach(element => {
                d3.select(element)
                    .each(this.truncateText(parent, availableWidth));
            });

        // Afterwards the preferred ones if text takes still to much space
        parent.selectAll("tspan.preferred")
            .each(this.truncateText(parent, availableWidth));

        // Truncate last names as last ones
        parent.selectAll("tspan.lastName")
            .each(this.truncateText(parent, availableWidth));
    }

    /**
     * Truncates the textual content of the actual element.
     *
     * @param {selection} parent         The parent (<text> or <textPath>) element containing the <tspan> child elements
     * @param {Number}    availableWidth The total available width the text could take
     */
    truncateText(parent, availableWidth)
    {
        let that = this;

        return function () {
            let textLength = that.getTextLength(parent);
            let tspan      = d3.select(this);
            let words      = tspan.text().split(/\s+/);

            // If the <tspan> contains multiple words split them until available width matches
            for (let i = words.length - 1; i >= 0; --i) {
                if (textLength > availableWidth) {
                    // Keep only the first letter
                    words[i] = words[i].slice(0, 1) + ".";

                    tspan.text(words.join(" "));

                    // Recalculate text length
                    textLength = that.getTextLength(parent);
                }
            }
        };

        // Truncate text letter by letter

        // while ((textLength > availableWidth) && (text.length > 1)) {
        //     // Remove last char
        //     text = text.slice(0, -1);
        //
        //     if (text.length > 1) {
        //         self.text(text + "...");
        //     } else {
        //         self.text(text + ".");
        //     }
        //
        //     // Recalculate the text width
        //     textLength = this.getTextLength(parent);
        // }
    }

    /**
     * Truncates a date value.
     *
     * @param {selection} parent         The parent (<text> or <textPath>) element containing the <tspan> child elements
     * @param {Number}    availableWidth The total available width the text could take
     */
    truncateDate(parent, availableWidth)
    {
        let that = this;

        return function () {
            let textLength = that.getTextLength(parent);
            let tspan      = d3.select(this);
            let text       = tspan.text();

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
     * @param {selection} parent The parent (<text> or <textPath>) element containing the <tspan> child elements
     *
     * @returns {Number}
     */
    getTextLength(parent)
    {
        let totalWidth = 0;

        // Calculate the total used width of all <tspan> elements
        parent.selectAll("tspan").each(function () {
            totalWidth += this.getComputedTextLength();
        });

        return totalWidth;
    }

    /**
     * Returns TRUE if the depth of the element is in the inner range. So labels should
     * be rendered along an arc path. Otherwise returns FALSE to indicate the element
     * is either the center one or an outer arc.
     *
     * @param {Object} data The D3 data object
     *
     * @return {Boolean}
     */
    isInnerLabel(data)
    {
        // Note: The center element does not belong to the inner labels!
        return ((data.depth > 0) && (data.depth <= this._configuration.numberOfInnerCircles));
    }

    /**
     * Creates a new <path> definition and append it to the global definition list.
     *
     * @param {String} parentId The parent element id
     * @param {Number} index    Index position of element in parent container. Required to create a unique path id.
     * @param {Object} data     The D3 data object
     *
     * @return {String} The id of the newly created path element
     */
    createPathDefinition(parentId, index, data)
    {
        let pathId = "path-" + parentId + "-" + index;

        // If definition already exists return the existing path id
        if (this._svg.defs.get().select("path#" + pathId).node()) {
            return pathId;
        }

        let positionFlipped = this.isPositionFlipped(data.depth, data.x0, data.x1);
        let startAngle      = this._geometry.startAngle(data.depth, data.x0);
        let endAngle        = this._geometry.endAngle(data.depth, data.x1);
        let relativeRadius  = this._geometry.relativeRadius(data.depth, this.getTextOffset(positionFlipped, index));

        // Special treatment for center marriage date position
        if (this._configuration.showParentMarriageDates && (index === 4) && (data.depth < 1)) {
            startAngle = this._geometry.calcAngle(data.x0);
            endAngle   = this._geometry.calcAngle(data.x1);
        }

        // Create an arc generator for path segments
        let arcGenerator = d3.arc()
            .startAngle(positionFlipped ? endAngle : startAngle)
            .endAngle(positionFlipped ? startAngle : endAngle)
            .innerRadius(relativeRadius)
            .outerRadius(relativeRadius);

        arcGenerator
            .padAngle(this._configuration.padAngle)
            .padRadius(this._configuration.padRadius)
            .cornerRadius(this._configuration.cornerRadius);

        // Store the <path> inside the definition list so we could
        // access it later on by its id
        this._svg.defs.get()
            .append("path")
            .attr("id", pathId)
            .attr("d", arcGenerator);

        return pathId;
    }

    /**
     * Check for the 360 degree chart if the current arc labels should be flipped for easier reading.
     *
     * @param {Number} depth The depth of the element inside the chart
     * @param {Number} x0    The left edge (x0) of the rectangle
     * @param {Number} x1    The right edge (x1) of the rectangle
     *
     * @return {Boolean}
     */
    isPositionFlipped(depth, x0, x1)
    {
        if ((this._configuration.fanDegree !== 360) || (depth <= 1)) {
            return false;
        }

        const startAngle = this._geometry.startAngle(depth, x0);
        const endAngle   = this._geometry.endAngle(depth, x1);

        // Flip names for better readability depending on position in chart
        return ((startAngle >= (90 * MATH_DEG2RAD)) && (endAngle <= (180 * MATH_DEG2RAD)))
            || ((startAngle >= (-180 * MATH_DEG2RAD)) && (endAngle <= (-90 * MATH_DEG2RAD)));
    }

    /**
     * Get the relative position offsets in percent for different text lines (firstName, lastName, dates).
     *   => (0 = inner radius, 100 = outer radius)
     *
     * @param {Boolean} positionFlipped TRUE if the labels should be flipped for easier reading
     * @param {Number}  index           The index position of element in parent container. Required to create a unique path id.
     *
     * @return {Number}
     */
    getTextOffset(positionFlipped, index)
    {
        // First names, Last name, Alternate name, Date, Parent marriage date
        return positionFlipped
            ? [23, 42, 61, 84, 125][index]
            : [73, 54, 35, 12, 120][index];
    }

    /**
     * Calculate the available text width. Depending on the depth of an entry in
     * the chart the available width differs.
     *
     * @param {Object} data  The D3 data object
     * @param {Number} index The index position of element in parent container.
     *
     * @returns {Number} Calculated available width
     *
     * @private
     */
    getAvailableWidth(data, index)
    {
        // Outer arcs
        if (data.depth > this._configuration.numberOfInnerCircles) {
            return this._configuration.outerArcHeight
                - (this._configuration.textPadding * 2)
                - this._configuration.circlePadding;
        }

        // Innermost circle (Reducing the width slightly, avoiding the text is sticking too close to the edge)
        let availableWidth = (this._configuration.centerCircleRadius * 2) - (this._configuration.centerCircleRadius * 0.15);

        if (data.depth >= 1) {
            let positionFlipped = this.isPositionFlipped(data.depth, data.x0, data.x1);

            // Calculate length of the arc
            availableWidth = this._geometry.arcLength(data, this.getTextOffset(positionFlipped, index));
        }

        return availableWidth - (this._configuration.textPadding * 2)
            - (this._configuration.padDistance / 2);
    }

    /**
     * Transform the D3 <text> elements in the group. Rotate each <text> element depending on its offset,
     * so that they are equally positioned inside the arc.
     *
     * @param {selection} parent The D3 parent group object
     * @param {Object}    datum  The The D3 data object
     *
     * @public
     */
    transformOuterText(parent, datum)
    {
        let that          = this;
        let textElements  = parent.selectAll("text");
        let countElements = textElements.size();
        let offset        = 1.0;

        // Special offsets for shifting the text around depending on the depth
        switch (datum.depth) {
            case 0: offset = 1.5; break;
            case 1: offset = 6.5; break;
            case 2: offset = 3.5; break;
            case 3: offset = 2.2; break;
            case 4: offset = 1.9; break;
            case 5: offset = 1.5; break;
            case 6: offset = 0.5; break;
        }

        let mapIndexToOffset = d3.scaleLinear()
            .domain([0, countElements - 1])
            .range([-offset, offset]);

        textElements.each(function (ignore, i) {
            const offsetRotate = mapIndexToOffset(i) * that._configuration.fontScale / 100.0;

            // Name of center person should not be rotated in any way
            if (datum.depth === 0) {
                // TODO Depends on font-size
                d3.select(this).attr("dy", (offsetRotate * 14) + (14 / 2) + "px");
            } else {
                d3.select(this).attr("transform", function () {
                    let dx        = datum.x1 - datum.x0;
                    let angle     = that._geometry.scale(datum.x0 + (dx / 2)) * MATH_RAD2DEG;
                    let rotate    = angle - (offsetRotate * (angle > 0 ? -1 : 1));
                    let translate = (that._geometry.centerRadius(datum.depth) - (that._configuration.colorArcWidth / 2.0));

                    if (angle > 0) {
                        rotate -= 90;
                    } else {
                        translate = -translate;
                        rotate += 90;
                    }

                    return "rotate(" + rotate + ") translate(" + translate + ")";
                });
            }
        });
    }
}
