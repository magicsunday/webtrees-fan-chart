/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../../lib/d3";
import Geometry, {MATH_DEG2RAD, MATH_RAD2DEG} from "./geometry";
import measureText from "../../lib/chart/text/measure"

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
     * @param {Selection} parent The parent element to which the elements are to be attached
     * @param {Object}    datum  The D3 data object
     */
    createLabels(parent, datum)
    {
        // Inner labels
        if (this.isInnerLabel(datum)) {
            const parentId = d3.select(parent.node().parentNode).attr("id");
            const nameGroups = this.createNamesData(datum);

            // The textPath element must be contained individually in a text element, otherwise the exported
            // chart will not be drawn correctly in Inkscape (actually this is not necessary, the browsers
            // display the chart correctly).

            nameGroups.forEach((nameGroup, index) => {
                const availableWidth = this.getAvailableWidth(datum, index);
                const pathId = this.createPathDefinition(parentId, index, datum);
                const textPath = parent
                    .append("text")
                    .append("textPath")
                    .attr("href", "#" + pathId)
                    .attr("startOffset", "25%");

                this.addNameElements(
                    textPath,
                    this.truncateNamesData(
                        textPath,
                        nameGroup,
                        availableWidth
                    )
                );
            });

            // Alternative names
            if (datum.data.data.alternativeName !== "") {
                const pathId = this.createPathDefinition(parentId, 2, datum);
                const availableWidth = this.getAvailableWidth(datum, 2);
                const nameGroup = this.createAlternativeNamesData(datum);

                const textPath = parent
                    .append("text")
                    .append("textPath")
                    .attr("href", "#" + pathId)
                    .attr("startOffset", "25%")
                    .classed("wt-chart-box-name-alt", true)
                    .classed("rtl", datum.data.data.isAltRtl);

                this.addNameElements(
                    textPath,
                    this.truncateNamesData(
                        textPath,
                        nameGroup,
                        availableWidth
                    )
                );
            }

            // Birth and death date
            if (datum.data.data.timespan !== "") {
                const pathId = this.createPathDefinition(parentId, 3, datum);
                const textPath = parent
                    .append("text")
                    .append("textPath")
                    .attr("href", "#" + pathId)
                    .attr("startOffset", "25%")
                    .attr("class", "date");

                textPath.append("title")
                    .text(datum.data.data.timespan);

                // Create a <tspan> element for the time span
                const tspan = textPath.append("tspan")
                    .text(datum.data.data.timespan);

                const availableWidth = this.getAvailableWidth(datum, 3);

                if (this.getTextLength(textPath) > availableWidth) {
                    textPath.selectAll("tspan")
                        .each(this.truncateDate(textPath, availableWidth));

                    tspan.text(tspan.text() + "\u2026");
                }
            }

        // Outer labels
        } else {
            // The outermost circles show the complete name and do
            // not distinguish between first name, last name and dates
            if (datum.depth >= 7) {
                const [first, ...last] = this.createNamesData(datum);
                const availableWidth = this.getAvailableWidth(datum, 0);

                // Merge the firstname and lastname groups, as we display the whole name in one line
                const combined = [].concat(first, typeof last[0] !== "undefined" ? last[0] : []);

                let text1 = parent
                    .append("text")
                    .attr("dy", "2px");

                this.addNameElements(
                    text1,
                    this.truncateNamesData(
                        text1,
                        combined,
                        availableWidth
                    )
                );
            } else {
                const nameGroups = this.createNamesData(datum);

                nameGroups.forEach((nameGroup, index) => {
                    const availableWidth = this.getAvailableWidth(datum, index);
                    const text = parent
                        .append("text")
                        .attr("dy", "2px");

                    this.addNameElements(
                        text,
                        this.truncateNamesData(
                            text,
                            nameGroup,
                            availableWidth
                        )
                    );
                });

                // Alternative name
                if (datum.data.data.alternativeName !== "") {
                    const availableWidth = this.getAvailableWidth(datum, 2);
                    const nameGroup = this.createAlternativeNamesData(datum);

                    const text = parent
                        .append("text")
                        .attr("dy", "5px")
                        .classed("wt-chart-box-name-alt", true)
                        .classed("rtl", datum.data.data.isAltRtl);

                    this.addNameElements(
                        text,
                        this.truncateNamesData(
                            text,
                            nameGroup,
                            availableWidth
                        )
                    );
                }

                // Birth and death date
                if (datum.depth < 6) {
                    // Birth and death date
                    if (datum.data.data.timespan !== "") {
                        const text = parent
                            .append("text")
                            .attr("class", "date")
                            .attr("dy", "7px");

                        text.append("title")
                            .text(datum.data.data.timespan);

                        // Create a <tspan> element for the time span
                        const tspan = text.append("tspan")
                            .text(datum.data.data.timespan);

                        const availableWidth = this.getAvailableWidth(datum, 2);

                        if (this.getTextLength(text) > availableWidth) {
                            text.selectAll("tspan")
                                .each(this.truncateDate(text, availableWidth));

                            tspan.text(tspan.text() + "\u2026");
                        }
                    }
                }
            }

            // Rotate outer labels in the right position
            this.transformOuterText(parent, datum);
        }

        // Marriage date
        if (this._configuration.showParentMarriageDates && datum.children && (datum.depth < 5)) {
            const parentId = d3.select(parent.node().parentNode).attr("id");
            const pathId = this.createPathDefinition(parentId, 4, datum);
            const textPath = parent
                .append("text")
                .append("textPath")
                .attr("href", "#" + pathId)
                .attr("startOffset", "25%")
                .attr("class", "date");

            this.addMarriageDate(textPath, datum);
        }
    }

    /**
     * Creates the data array for the names in top/bottom layout.
     *
     * @param {NameElementData} datum
     *
     * @return {LabelElementData[][]}
     *
     * @private
     */
    createNamesData(datum)
    {
        /** @var {LabelElementData[][]} names */
        let names = {};
        /** @var {LabelElementData[]} firstnames */
        let firstnames = {};
        /** @var {LabelElementData[]} lastnames */
        let lastnames = {};
        let minPosFirstnames = Number.MAX_SAFE_INTEGER;
        let minPosLastnames = Number.MAX_SAFE_INTEGER;

        let firstnameOffset = 0;
        let firstnameMap = new Map();

        // Iterate over the individual name components and determine their position in the overall
        // name and insert the component at the corresponding position in the result object.
        for (let i in datum.data.data.firstNames) {
            const pos = datum.data.data.name.indexOf(datum.data.data.firstNames[i], firstnameOffset);

            if (pos !== -1) {
                firstnameOffset = pos + datum.data.data.firstNames[i].length;

                if (pos < minPosFirstnames) {
                    minPosFirstnames = pos;
                }

                firstnameMap.set(
                    pos,
                    {
                        label: datum.data.data.firstNames[i],
                        isPreferred: datum.data.data.firstNames[i] === datum.data.data.preferredName,
                        isLastName: false,
                        isNameRtl: datum.data.data.isNameRtl
                    }
                );
            }
        }

        names[minPosFirstnames] = [...firstnameMap].map(([, value]) => ( value ));

        let lastnameOffset = 0;
        let lastnameMap = new Map();

        for (let i in datum.data.data.lastNames) {
            let pos;

            // Check if last name already exists in first names list, in case first name equals last name
            do {
                pos = datum.data.data.name.indexOf(datum.data.data.lastNames[i], lastnameOffset);

                if ((pos !== -1) && firstnameMap.has(pos)) {
                    lastnameOffset += pos + datum.data.data.lastNames[i].length;
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
                        label: datum.data.data.lastNames[i],
                        isPreferred: false,
                        isLastName: true,
                        isNameRtl: datum.data.data.isNameRtl
                    }
                );
            }
        }

        names[minPosLastnames] = [...lastnameMap].map(([, value]) => ( value ));

        // Extract the values (keys don't matter anymore)
        return Object.values(names);
    }

    /**
     * Creates the data array for the alternative name.
     *
     * @param {NameElementData} datum
     *
     * @return {LabelElementData[]}
     *
     * @private
     */
    createAlternativeNamesData(datum)
    {
        let words = datum.data.data.alternativeName.split(/\s+/);

        /** @var {LabelElementData[]} names */
        let names = [];

        // Append the alternative names
        names = names.concat(
            words.map((word) => {
                return {
                    label: word,
                    isPreferred: false,
                    isLastName: false,
                    isNameRtl: datum.data.data.isAltRtl
                }
            })
        );

        return names;
    }

    /**
     * Creates a single <tspan> element for each single name and append it to the
     * parent element. The "tspan" element containing the preferred name gets an
     * additional underline style to highlight this one.
     *
     * @param {Selection}                       parent The parent element to which the <tspan> elements are to be attached
     * @param {function(*): LabelElementData[]} data
     *
     * @private
     */
    addNameElements(parent, data)
    {
        parent.selectAll("tspan")
            .data(data)
            .enter()
            .call((g) => {
                g.append("tspan")
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
     * Creates the data array for the names.
     *
     * @param {Object}             parent
     * @param {LabelElementData[]} names
     * @param {number}             availableWidth
     *
     * @return {LabelElementData[]}
     *
     * @private
     */
    truncateNamesData(parent, names, availableWidth)
    {
        const fontSize   = parent.style("font-size");
        const fontWeight = parent.style("font-weight");

        return this.truncateNames(names, fontSize, fontWeight, availableWidth);
    }

    /**
     * Creates a single <tspan> element for the marriage date and append it to the parent element.
     *
     * @param {Selection} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object}    datum  The D3 data object containing the individual data
     */
    addMarriageDate(parent, datum)
    {
        // Create a <tspan> element for the parent marriage date
        if (datum.data.data.marriageDateOfParents) {
            parent.append("tspan")
                .text("\u26AD " + datum.data.data.marriageDateOfParents);
        }
    }

    /**
     * Truncates the list of names.
     *
     * @param {LabelElementData[]} names          The names array
     * @param {string}             fontSize       The font size
     * @param {number}             fontWeight     The font weight
     * @param {number}             availableWidth The available width
     *
     * @return {LabelElementData[]}
     *
     * @private
     */
    truncateNames(names, fontSize, fontWeight, availableWidth)
    {
        let text = names.map(item => item.label).join(" ");

        return names
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
                        text       = names.map(item => item.label).join(" ");
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
                        text       = names.map(item => item.label).join(" ");
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
                        text       = names.map(item => item.label).join(" ");
                    }
                }

                return name;
            })
            // Revert reversed order again
            .reverse();
    }

    /**
     * Measures the given text and return its width depending on the used font (including size and weight).
     *
     * @param {string} text
     * @param {string} fontSize
     * @param {number} fontWeight
     *
     * @returns {number}
     *
     * @private
     */
    measureText(text, fontSize, fontWeight = 400)
    {
        const fontFamily = this._svg.style("font-family");

        return measureText(text, fontFamily, fontSize, fontWeight);
    }

    /**
     * Truncates a date value.
     *
     * @param {Selection} parent         The parent (<text> or <textPath>) element containing the <tspan> child elements
     * @param {number}    availableWidth The total available width the text could take
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
     * @param {Selection} parent The parent (<text> or <textPath>) element containing the <tspan> child elements
     *
     * @returns {number}
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
     * be rendered along an arc path. Otherwise, returns FALSE to indicate the element
     * is either the center one or an outer arc.
     *
     * @param {Object} data The D3 data object
     *
     * @return {boolean}
     */
    isInnerLabel(data)
    {
        // Note: The center element does not belong to the inner labels!
        return ((data.depth > 0) && (data.depth <= this._configuration.numberOfInnerCircles));
    }

    /**
     * Creates a new <path> definition and append it to the global definition list.
     *
     * @param {string} parentId The parent element id
     * @param {number} index    Index position of an element in parent container. Required to create a unique path id.
     * @param {Object} data     The D3 data object
     *
     * @return {string} The id of the newly created path element
     */
    createPathDefinition(parentId, index, data)
    {
        let pathId = "path-" + parentId + "-" + index;

        // If definition already exists, return the existing path ID
        if (this._svg.defs.select("path#" + pathId).node()) {
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
     *
     * @return {boolean}
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
     * @param {boolean} positionFlipped TRUE if the labels should be flipped for easier reading
     * @param {number}  index           The index position of element in parent container. Required to create a unique path id.
     *
     * @return {number}
     */
    getTextOffset(positionFlipped, index)
    {
        // First names, Last name, Alternative name, Date, Parent marriage date
        return positionFlipped
            ? [23, 40, 62, 84, 125][index]
            : [73, 56, 34, 12, 120][index];
    }

    /**
     * Calculate the available text width. Depending on the depth of an entry in
     * the chart the available width differs.
     *
     * @param {Object} data  The D3 data object
     * @param {number} index The index position of element in parent container.
     *
     * @returns {number} Calculated available width
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
     * @param {Selection} parent The D3 parent group object
     * @param {Object}    datum  The The D3 data object
     *
     * @public
     */
    transformOuterText(parent, datum)
    {
        let that = this;
        let textElements = parent.selectAll("text");
        let countElements = textElements.size();
        let offset = 1.0;

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

            // The name of center person should not be rotated in any way
            if (datum.depth === 0) {
                // TODO Depends on font-size
                d3.select(this).attr("dy", (offsetRotate * 15) + (15 / 2) + "px");
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
