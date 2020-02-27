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
     * Append the arc paths to the label element.
     *
     * @param {Object} label Label element used to append the arc path
     * @param {Object} d     D3 data object
     */
    addLabel(label, d)
    {
        if (this.isInnerLabel(d)) {
            // Inner labels
            let text     = this.appendTextToLabel(label, d);
            let timeSpan = this.getTimeSpan(d);

            // Create a path for each line of text as mobile devices
            // won't display <tspan> elements in the right position
            let pathId1 = this.appendPathToLabel(label, 0, d);
            let pathId2 = this.appendPathToLabel(label, 1, d);

            this.appendTextPath(text, pathId1)
                .text(this.getFirstNames(d))
                .each(this.truncate(d, 0));

            this.appendTextPath(text, pathId2)
                .text(this.getLastName(d))
                .each(this.truncate(d, 1));

            if (d.data.alternativeName) {
                let pathId3 = this.appendPathToLabel(label, 2, d);

                this.appendTextPath(text, pathId3)
                    .attr("class", "alternativeName")
                    .classed("rtl", d.data.isAltRtl)
                    .text(d.data.alternativeName)
                    .each(this.truncate(d, 2));
            }

            if (timeSpan) {
                let pathId4 = this.appendPathToLabel(label, 3, d);

                this.appendTextPath(text, pathId4)
                    .attr("class", "date")
                    .text(timeSpan)
                    .each(this.truncate(d, 3));
            }
        } else {
            // Outer labels
            let name     = d.data.name;
            let timeSpan = this.getTimeSpan(d);

            // Return first name for inner circles
            if (d.depth < 7) {
                name = this.getFirstNames(d);
            }

            // Create the text elements for first name, last name and
            // the birth/death dates
            this.appendOuterArcText(d, 0, label, name);

            // The outer most circles show the complete name and do not distinguish between
            // first name, last name and dates
            if (d.depth < 7) {
                // Add last name
                this.appendOuterArcText(d, 1, label, this.getLastName(d));

                // Never reached
                // if ((d.depth < 5) && d.data.alternativeName) {
                //     let textElement = this.appendOuterArcText(d, 2, label, d.data.alternativeName, "alternativeName");
                //
                //     if (d.data.isAltRtl) {
                //         textElement.classed("rtl", true);
                //     }
                // }

                // Add dates
                if ((d.depth < 6) && timeSpan) {
                    this.appendOuterArcText(d, 3, label, timeSpan, "date");
                }
            }

            // Rotate outer labels in right position
            this.transformOuterText(label, d);
        }
    }

    /**
     * Returns TRUE if the depth of the element is in the inner range. So labels should
     * be rendered along an arc path. Otherwise returns FALSE to indicate the element
     * is either the center one or an outer arc.
     *
     * @param {Object} d D3 data object
     *
     * @return {Boolean}
     */
    isInnerLabel(d)
    {
        return ((d.depth > 0) && (d.depth < this._options.numberOfInnerCircles));
    }

    /**
     * Add "text" element to given parent element.
     *
     * @param {Object} parent Parent element used to append the "text" element
     * @param {Object} data   The D3 data object
     *
     * @return {Object} Newly added label element
     */
    appendTextToLabel(parent, data)
    {
        return parent
            .append("text")
            .attr("dominant-baseline", "middle")
            .style("font-size", this.getFontSize(data));
    }

    /**
     * Get the time span label of an person. Returns null if label
     * should not be displayed due empty data.
     *
     * @param {Object} d D3 data object
     *
     * @return {null|String}
     */
    getTimeSpan(d)
    {
        if (d.data.born || d.data.died) {
            return d.data.born + "-" + d.data.died;
        }

        return null;
    }

    /**
     * Append a path element to the given parent group element.
     *
     * @param {Object} label Parent container element, D3 group element
     * @param {Number} index Index position of element in parent container. Required to create a unique path id.
     * @param {Object} d     D3 data object
     *
     * @return {String} The id of the newly created path element
     */
    appendPathToLabel(label, index, d)
    {
        let personId = d3.select(label.node().parentNode).attr("id");

        // Create arc generator for path segments
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

        let pathId = "path-" + personId + "-" + index;

        // Append a path so we could use it to write the label along it
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
     * @param {Object} d D3 data object
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
     * @param {Object} d     D3 data object
     *
     * @return {Number}
     */
    getTextOffset(index, d)
    {
        // TODO Calculate values instead of using hard coded ones
        return this.isPositionFlipped(d) ? [20, 35, 58, 81][index] : [75, 60, 37, 14][index];
    }

    /**
     * Append "textPath" element.
     *
     * @param {Object} parent The parent element used to append the "textPath" element
     * @param {String} refId  The id of the reference element
     *
     * @return {Object} D3 textPath object
     */
    appendTextPath(parent, refId)
    {
        return parent
            .append("textPath")
            .attr("xlink:href", "#" + refId)
            .attr("startOffset", "25%");
    }

    /**
     * Get the first names of an person.
     *
     * @param {Object} d D3 data object
     *
     * @return {String}
     */
    getFirstNames(d)
    {
        return d.data.name.substr(0, d.data.name.lastIndexOf(" "));
    }

    /**
     * Get the last name of an person.
     *
     * @param {Object} d D3 data object
     *
     * @return {String}
     */
    getLastName(d)
    {
        return d.data.name.substr(d.data.name.lastIndexOf(" ") + 1);
    }

    /**
     * Truncates the text of the current element depending on its depth
     * in the chart.
     *
     * @param {Object} d     D3 data object
     * @param {Number} index Index position of element in parent container
     *
     * @returns {string} Truncated text
     */
    truncate(d, index)
    {
        let availableWidth = this.getAvailableWidth(d, index);

        return function () {
            // Depending on the depth of an entry in the chart the available width differs
            let self       = d3.select(this);
            let textLength = self.node().getComputedTextLength();
            let text       = self.text();

            while ((textLength > availableWidth) && (text.length > 0)) {
                // Remove last char
                text = text.slice(0, -1);

                // Recalculate the text width
                textLength = self
                    .text(text + "...")
                    .node()
                    .getComputedTextLength();
            }
        };
    }

    /**
     * Calculate the available text width. Depending on the depth of an entry in
     * the chart the available width differs.
     *
     * @param {Object} d     D3 data object
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
     * Append text element to the given group element.
     *
     * @param {Object} d         D3 data object
     * @param {Number} index     Index position of element in parent container
     * @param {Object} group     D3 group (g) object
     * @param {String} label     Label to display
     * @param {String} textClass Optional class to set to the D3 text element
     *
     * @return {Object} D3 text object
     */
    appendOuterArcText(d, index, group, label, textClass = null)
    {
        let textElement = group.append("text");

        textElement.attr("class", textClass || null)
            .attr("class", textClass || null)
            .attr("dominant-baseline", "middle")
            .style("font-size", this.getFontSize(d))
            .text(label)
            .each(this.truncate(d, index));

        return textElement;
    }

    /**
     * Get the scaled font size.
     *
     * @param {Object} data The D3 data object
     *
     * @return {String}
     */
    getFontSize(data)
    {
        let fontSize = this._options.fontSize;

        if (data.depth >= (this._options.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        return ((fontSize - data.depth) * this._options.fontScale / 100.0) + "px";
    }

    /**
     * Transform the D3 text elements in the group. Rotate each text element depending on its offset,
     * so that they are equally positioned inside the arc.
     *
     * @param {Object} label The D3 label group object
     * @param {Object} data  The D3 data object
     *
     * @public
     */
    transformOuterText(label, data)
    {
        let that          = this;
        let textElements  = label.selectAll("text");
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
                d3.select(this).attr("dy", offsetRotate + "em");
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
