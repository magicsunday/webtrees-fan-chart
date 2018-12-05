/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import {Geometry, MATH_DEG2RAD, MATH_RAD2DEG} from "../geometry";
import * as d3 from "../d3";

/**
 * Class handling all the text and path elements.
 */
export default class Text
{
    /**
     * Constructor.
     *
     * @param {Config}  config
     * @param {Options} options
     */
    constructor(config, options)
    {
        this.config   = config;
        this.options  = options;
        this.geometry = new Geometry(options);
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
            let path1 = this.appendPathToLabel(label, 0, d);
            let path2 = this.appendPathToLabel(label, 1, d);

            this.appendTextPath(text, path1.attr("id"))
                .text(this.getFirstNames(d))
                .each(this.truncate(d, 0));

            this.appendTextPath(text, path2.attr("id"))
                .text(this.getLastName(d))
                .each(this.truncate(d, 1));

            if (d.data.alternativeName) {
                let path3 = this.appendPathToLabel(label, 2, d);

                this.appendTextPath(text, path3.attr("id"))
                    .attr("class", "alternativeName")
                    .classed("rtl", d.data.isAltRtl)
                    .text(d.data.alternativeName)
                    .each(this.truncate(d, 2));
            }

            if (timeSpan) {
                let path4 = this.appendPathToLabel(label, 3, d);

                this.appendTextPath(text, path4.attr("id"))
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

                if ((d.depth < 5) && d.data.alternativeName) {
                    let textElement = this.appendOuterArcText(d, 2, label, d.data.alternativeName, "alternativeName");

                    if (d.data.isAltRtl) {
                        textElement.classed("rtl", true);
                    }
                }

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
        return ((d.depth > 0) && (d.depth < this.options.numberOfInnerCircles));
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
     * @return {Object} D3 path object
     */
    appendPathToLabel(label, index, d)
    {
        let personId = d3.select(label.node().parentNode).attr("id");

        // Create arc generator for path segments
        let arcGenerator = d3.arc()
            .startAngle(() => this.isPositionFlipped(d)
                ? this.geometry.endAngle(d)
                : this.geometry.startAngle(d)
            )
            .endAngle(() => this.isPositionFlipped(d)
                ? this.geometry.startAngle(d)
                : this.geometry.endAngle(d)
            )
            .innerRadius(() => this.geometry.relativeRadius(d, this.getTextOffset(index, d)))
            .outerRadius(() => this.geometry.relativeRadius(d, this.getTextOffset(index, d)));

        // Append a path so we could use it to write the label along it
        return label.append("path")
            .attr("id", personId + "-" + index)
            .attr("d", arcGenerator);
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
        if ((this.options.fanDegree !== 360) || (d.depth <= 1)) {
            return false;
        }

        let sAngle = this.geometry.startAngle(d);
        let eAngle = this.geometry.endAngle(d);

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
        // Innermost circle (Reducing the width slightly, avoiding the text is sticking too close to the edge)
        let availableWidth = (this.options.centerCircleRadius * 2) - (this.options.centerCircleRadius * 0.15);

        if ((d.depth >= 1) && (d.depth < this.options.numberOfInnerCircles)) {
            // Calculate length of the arc
            availableWidth = this.geometry.arcLength(d, this.getTextOffset(index, d));
        } else {
            // Outer arcs
            if (d.depth >= this.options.numberOfInnerCircles) {
                availableWidth = this.options.outerArcHeight;
            }
        }

        return availableWidth - (this.options.textPadding * 2);
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
    appendOuterArcText(d, index, group, label, textClass)
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
        let fontSize = this.options.fontSize;

        if (data.depth >= (this.options.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        return ((fontSize - data.depth) * this.options.fontScale / 100.0) + "px";
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
        let self          = this;
        let textElements  = label.selectAll("text");
        let countElements = textElements.size();
        let offsets       = [0, -0.025, 0.5, 1.15, 2.0];
        let offset        = offsets[countElements];

        let mapIndexToOffset = d3.scaleLinear()
            .domain([0, countElements - 1])
            .range([-offset, offset]);

        textElements.each(function (ignore, i) {
            // Slightly increase in the y axis' value so the texts may not overlay
            let offsetRotate = (i <= 1 ? 1.25 : 1.75);

            if ((data.depth === 0) || (data.depth === 6)) {
                offsetRotate = 1.0;
            }

            if (data.depth === 7) {
                offsetRotate = 0.75;
            }

            if (data.depth === 8) {
                offsetRotate = 0.5;
            }

            offsetRotate *= mapIndexToOffset(i) * self.options.fontScale / 100.0;

            // Name of center person should not be rotated in any way
            if (data.depth === 0) {
                d3.select(this).attr("dy", offsetRotate + "em");
            } else {
                d3.select(this).attr("transform", function () {
                    let dx        = data.x1 - data.x0;
                    let angle     = self.geometry.scale(data.x0 + (dx / 2)) * MATH_RAD2DEG;
                    let rotate    = angle - (offsetRotate * (angle > 0 ? -1 : 1));
                    let translate = (self.geometry.centerRadius(data) - (self.options.colorArcWidth / 2.0));

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
