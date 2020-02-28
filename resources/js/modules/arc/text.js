/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "../d3";
import Geometry, {MATH_DEG2RAD, MATH_RAD2DEG} from "../geometry";

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
     * @param {Config}  config  The configuration
     * @param {Options} options
     */
    constructor(config, options)
    {
        this._config   = config;
        this._options  = options;
        this._geometry = new Geometry(options);
    }

    /**
     * Creates all the labels and all dependent elements for a single person.
     *
     * @param {Object} parent The parent element to which the elements are to be attached
     * @param {Object} d      The D3 data object
     */
    createLabels(parent, d)
    {
        // Inner labels
        if (this.isInnerLabel(d)) {
            let text     = this.createTextElement(parent, d);
            let parentId = d3.select(parent.node().parentNode).attr("id");

            // First names
            let pathId1   = this.createPathDefinition(parentId, 0, d);
            let textPath1 = this.createTextPath(text, pathId1);
            this.addFirstNames(textPath1, d);
            this.truncateNames(textPath1, d, 0);

            // Last names
            let pathId2   = this.createPathDefinition(parentId, 1, d);
            let textPath2 = this.createTextPath(text, pathId2);
            this.addLastNames(textPath2, d);
            this.truncateNames(textPath2, d, 1);

            // Alternative names
            if (d.data.alternativeNames.length > 0) {
                let pathId3   = this.createPathDefinition(parentId, 2, d);
                let textPath3 = this.createTextPath(text, pathId3)
                    .attr("class", "alternativeName")
                    .classed("rtl", d.data.isAltRtl);

                this.addAlternativeNames(textPath3, d);
                this.truncateNames(textPath3, d, 2);
            }

            // Birth and death date
            let pathId4   = this.createPathDefinition(parentId, 3, d);
            let textPath4 = this.createTextPath(text, pathId4)
                .attr("class", "date");

            this.addTimeSpan(textPath4, d);
            this.truncateNames(textPath4, d, 3);

        // Outer labels
        } else {

            // The outer most circles show the complete name and do
            // not distinguish between first name, last name and dates
            if (d.depth >= 7) {
                let text1 = this.createTextElement(parent, d)
                    .attr("dy", "2px");

                this.addFirstNames(text1, d);
                this.addLastNames(text1, d, 0.25);
                this.truncateNames(text1, d, 0);
            }

            if (d.depth < 7) {
                // First names
                let text2 = this.createTextElement(parent, d)
                    .attr("dy", "2px");

                this.addFirstNames(text2, d);
                this.truncateNames(text2, d, 0);

                // Last names
                let text3 = this.createTextElement(parent, d)
                    .attr("dy", "2px");

                this.addLastNames(text3, d);
                this.truncateNames(text3, d, 1);

                // Birth and death date
                if (d.depth < 6) {
                    let text4 = this.createTextElement(parent, d)
                        .attr("class", "date")
                        .attr("dy", "2px");

                    this.addTimeSpan(text4, d);
                    this.truncateNames(text4, d, 3);
                }
            }

            // Rotate outer labels in right position
            this.transformOuterText(parent, d);
        }
    }

    /**
     * Creates a single <tspan> element for each single given name and append it to the
     * parent element. The "tspan" element containing the preferred name gets an
     * additional underline style in order to highlight this one.
     *
     * @param {Object} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object} d      The D3 data object containing the individual data
     */
    addFirstNames(parent, d)
    {
        let i = 0;

        for (let givenName of d.data.givenNames) {
            // Create a <tspan> element for each given name
            let tspan = parent.append("tspan")
                .text(givenName);

            // The preferred name
            if (givenName === d.data.preferredName) {
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
     * @param {Object} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object} d      The D3 data object containing the individual data
     * @param {Number} dx     Delta X offset used to create a small spacing between multiple words
     */
    addLastNames(parent, d, dx = 0)
    {
        for (let surname of d.data.surnames) {
            // Create a <tspan> element for the last name
            let tspan = parent.append("tspan")
                .text(surname);

            if (dx !== 0) {
                tspan.attr("dx", dx + "em");
            }
        }
    }

    /**
     * Creates a single <tspan> element for each alternative name and append it to the parent element.
     *
     * @param {Object} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object} d      The D3 data object containing the individual data
     * @param {Number} dx     Delta X offset used to create a small spacing between multiple words
     */
    addAlternativeNames(parent, d, dx = 0)
    {
        let i = 0;

        for (let alternativeName of d.data.alternativeNames) {
            // Create a <tspan> element for the last name
            let tspan = parent.append("tspan")
                .text(alternativeName);

            // Add some spacing between the elements
            if (i !== 0) {
                tspan.attr("dx", (d.data.isAltRtl ? -0.25 : 0.25) + "em");
            }

            ++i;
        }
    }

    /**
     * Creates a single <tspan> element for the time span append it to the parent element.
     *
     * @param {Object} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object} d      The D3 data object containing the individual data
     */
    addTimeSpan(parent, d)
    {
        // Create a <tspan> element for the last name
        let tspan = parent.append("tspan")
            .text(this.getTimeSpan(d));
    }

    /**
     * Loops over the <tspan> elements and truncates the contained texts.
     *
     * @param {Object} parent The parent (<text> or <textPath>) element to which the <tspan> elements are to be attached
     * @param {Object} d      The D3 data object containing the individual data
     */
    truncateNames(parent, d, index)
    {
        let availableWidth = this.getAvailableWidth(d, index);

        // Start truncating those elements which are not the preferred ones
        parent.selectAll("tspan:not(.preferred)")
            .each(this.truncateText(parent, availableWidth));

        // Afterwards the preferred ones if text takes still to much width
        parent.selectAll("tspan.preferred")
            .each(this.truncateText(parent, availableWidth));
    }

    /**
     * Returns a float representing the computed length of all <tspan> elements within the element.
     *
     * @param {Object} parent The parent (<text> or <textPath>) element containing the <tspan> child elements
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
     * Truncates the textual content of the actual element.
     *
     * @param {Object} parent         The parent (<text> or <textPath>) element containing the <tspan> child elements
     * @param {Number} availableWidth The total available width the text could take
     */
    truncateText(parent, availableWidth)
    {
        let that = this;

        return function () {
            let textLength = that.getTextLength(parent);
            let tspan      = d3.select(this);
            let text       = tspan.text();

            if ((textLength > availableWidth) && (text.length > 1)) {
                // Keep only the first letter
                tspan.text(text.slice(0, 1) + ".");
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
     * Returns TRUE if the depth of the element is in the inner range. So labels should
     * be rendered along an arc path. Otherwise returns FALSE to indicate the element
     * is either the center one or an outer arc.
     *
     * @param {Object} d The D3 data object
     *
     * @return {Boolean}
     */
    isInnerLabel(d)
    {
        return ((d.depth > 0) && (d.depth < this._options.numberOfInnerCircles));
    }

    /**
     * Creates a <text> element and append it to the parent element.
     *
     * @param {Object} parent The parent element to which the <text> element is to be attached
     * @param {Object} data   The D3 data object
     *
     * @return {Object} Newly created <text> element
     */
    createTextElement(parent, data)
    {
        return parent
            .append("text")
            .style("font-size", this.getFontSize(data) + "px");
    }

    /**
     * Creates a <textPath> element and append it to the parent element.
     *
     * @param {Object} parent The parent element to which the <textPath> element is to be attached
     * @param {String} refId  The id of the reference element
     *
     * @return {Object} Newly created <textPath> element
     */
    createTextPath(parent, refId)
    {
        return parent
            .append("textPath")
            .attr("xlink:href", "#" + refId)
            .attr("startOffset", "25%");
    }

    /**
     * Get the time span label of an person. Returns null if label
     * should not be displayed due empty data.
     *
     * @param {Object} d The D3 data object
     *
     * @return {null|String}
     */
    getTimeSpan(d)
    {
        if (d.data.born || d.data.died) {
            return d.data.born + "-" + d.data.died;
        }

        return "...";
    }

    /**
     * Creates a new <path> definition and append it to the global definition list. The method
     * returns the newly created <path> element id.
     *
     * @param {Object} parent The parent element id
     * @param {Number} index  Index position of element in parent container. Required to create a unique path id.
     * @param {Object} d      The D3 data object
     *
     * @return {String} The id of the newly created path element
     */
    createPathDefinition(parentId, index, d)
    {
        let pathId = "path-" + parentId + "-" + index;

        // If definition already exists return the existing path id
        if (this._config.svgDefs.select("path#" + pathId).node()) {
            return pathId;
        }

        // Create an arc generator for path segments
        let arcGenerator = d3.arc()
            .startAngle(() => this.isPositionFlipped(d)
                ? this._geometry.endAngle(d)
                : this._geometry.startAngle(d)
            )
            .endAngle(() => this.isPositionFlipped(d)
                ? this._geometry.startAngle(d)
                : this._geometry.endAngle(d)
            )
            .innerRadius(() => this._geometry.relativeRadius(d, this.getTextOffset(index, d)))
            .outerRadius(() => this._geometry.relativeRadius(d, this.getTextOffset(index, d)));

        // Store the <path> inside the definition list so we could
        // access it later on by its id
        this._config.svgDefs
            .append("path")
            .attr("id", pathId)
            .attr("d", arcGenerator);

        return pathId;
    }

    /**
     * Check for the 360 degree chart if the current arc labels
     * should be flipped for easier reading.
     *
     * @param {Object} d The D3 data object
     *
     * @return {Boolean}
     */
    isPositionFlipped(d)
    {
        if ((this._options.fanDegree !== 360) || (d.depth <= 1)) {
            return false;
        }

        let sAngle = this._geometry.startAngle(d);
        let eAngle = this._geometry.endAngle(d);

        // Flip names for better readability depending on position in chart
        return ((sAngle >= (90 * MATH_DEG2RAD)) && (eAngle <= (180 * MATH_DEG2RAD)))
            || ((sAngle >= (-180 * MATH_DEG2RAD)) && (eAngle <= (-90 * MATH_DEG2RAD)));
    }

    /**
     * Get the relative position offsets in percent for different text lines (givenname, surname, dates).
     *   => (0 = inner radius, 100 = outer radius)
     *
     * @param {Number} index Index position of element in parent container. Required to create a unique path id.
     * @param {Object} d     The D3 data object
     *
     * @return {Number}
     */
    getTextOffset(index, d)
    {
        // First names, Last name, Alternate name, Date
        return this.isPositionFlipped(d) ? [23, 41, 60, 83][index] : [73, 55, 36, 13][index];
    }

    /**
     * Calculate the available text width. Depending on the depth of an entry in
     * the chart the available width differs.
     *
     * @param {Object} d     The D3 data object
     * @param {Number} index Index position of element in parent container.
     *
     * @returns {Number} Calculated available width
     */
    getAvailableWidth(d, index)
    {
        // Outer arcs
        if (d.depth >= this._options.numberOfInnerCircles) {
            return this._options.outerArcHeight - (this._options.textPadding * 2);
        }

        // Innermost circle (Reducing the width slightly, avoiding the text is sticking too close to the edge)
        let availableWidth = (this._options.centerCircleRadius * 2) - (this._options.centerCircleRadius * 0.15);

        if ((d.depth >= 1) && (d.depth < this._options.numberOfInnerCircles)) {
            // Calculate length of the arc
            availableWidth = this._geometry.arcLength(d, this.getTextOffset(index, d));
        }

        return availableWidth - (this._options.textPadding * 2);
    }

    /**
     * Get the scaled font size.
     *
     * @param {Object} data The The D3 data object
     *
     * @return {Number}
     */
    getFontSize(data)
    {
        let fontSize = this._options.fontSize;

        if (data.depth >= (this._options.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        return ((fontSize - data.depth) * this._options.fontScale / 100.0);
    }

    /**
     * Transform the D3 <text> elements in the group. Rotate each <text> element depending on its offset,
     * so that they are equally positioned inside the arc.
     *
     * @param {Object} parent The D3 parent group object
     * @param {Object} data   The The D3 data object
     *
     * @public
     */
    transformOuterText(parent, data)
    {
        let that          = this;
        let textElements  = parent.selectAll("text");
        let countElements = textElements.size();
        let offset        = 1.0;

        // Special offsets for shifting the text around depending on the depth
        switch (data.depth) {
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
            const offsetRotate = mapIndexToOffset(i) * that._options.fontScale / 100.0;

            // Name of center person should not be rotated in any way
            if (data.depth === 0) {
                // TODO Depends on font-size
                d3.select(this).attr("dy", (offsetRotate * 14) + (14/2) + "px");
            } else {
                d3.select(this).attr("transform", function () {
                    let dx        = data.x1 - data.x0;
                    let angle     = that._geometry.scale(data.x0 + (dx / 2)) * MATH_RAD2DEG;
                    let rotate    = angle - (offsetRotate * (angle > 0 ? -1 : 1));
                    let translate = (that._geometry.centerRadius(data) - (that._options.colorArcWidth / 2.0));

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
