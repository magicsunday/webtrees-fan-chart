/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import {config} from "./config";
import {centerRadius, outerRadius, relativeRadius, arcLength, startAngle, endAngle} from "./radius";
import * as d3 from "./d3";
import {addArcToPerson} from "./arc-person";
import {initData, SEX_FEMALE, SEX_MALE} from "./hierarchy";
import {MATH_DEG2RAD, MATH_RAD2DEG, MATH_PI2} from "./math";

/**
 * Append labels (initial hidden).
 *
 * @param {Object} parent The parent element used to append the label element too
 *
 * @return {Object} Newly added label element
 */
export function addLabelToPerson(parent) {
    return parent
        .append("g")
        .attr("class", "label")
        .style("fill", rso.options.fontColor);
}

/**
 * Get the scaled font size.
 *
 * @param {Object} data The D3 data object
 *
 * @return {String}
 */
function getFontSize(data) {
    let fontSize = rso.options.fontSize;

    if (data.depth >= (rso.options.numberOfInnerCircles + 1)) {
        fontSize += 1;
    }

    return ((fontSize - data.depth) * rso.options.fontScale / 100.0) + "px";
}

/**
 * Add "text" element to given parent element.
 *
 * @param {Object} parent Parent element used to append the "text" element
 * @param {Object} data   The D3 data object
 *
 * @return {Object} Newly added label element
 */
export function appendTextToLabel(parent, data) {
    return parent
        .append("text")
        .attr("dominant-baseline", "middle")
        .style("font-size", getFontSize(data));
}

/**
 * Append "textPath" element.
 *
 * @param {Object} parent The parent element used to append the "textPath" element
 * @param {String} refId  The id of the reference element
 *
 * @return {Object} D3 textPath object
 */
export function appendTextPath(parent, refId) {
    return parent
        .append("textPath")
        .attr("xlink:href", "#" + refId)
        .attr("startOffset", "25%");
}

/**
 * Append the arc paths to the label element.
 *
 * @param {object} label Label element used to append the arc path
 * @param {object} d     D3 data object
 *
 * @return {void}
 */
export function addArcPathToLabel(label, d) {
    /**
     * Get the first names of an person.
     *
     * @param {object} d D3 data object
     *
     * @return {string}
     */
    function getFirstNames(d) {
        return d.data.name.substr(0, d.data.name.lastIndexOf(" "));
    }

    if (isInnerLabel(d)) {
        // Inner labels
        let text     = appendTextToLabel(label, d);
        let timeSpan = getTimeSpan(d);

        // Create a path for each line of text as mobile devices
        // won't display <tspan> elements in the right position
        let path1 = appendPathToLabel(label, 0, d);
        let path2 = appendPathToLabel(label, 1, d);

        appendTextPath(text, path1.attr("id"))
            .text(getFirstNames(d))
            .each(truncate(d, 0));

        appendTextPath(text, path2.attr("id"))
            .text(getLastName(d))
            .each(truncate(d, 1));

        if (d.data.alternativeName) {
            let path3 = appendPathToLabel(label, 2, d);

            appendTextPath(text, path3.attr("id"))
                .attr("class", "alternativeName")
                .classed("rtl", d.data.isAltRtl)
                .text(d.data.alternativeName)
                .each(truncate(d, 2));
        }

        if (timeSpan) {
            let path4 = appendPathToLabel(label, 3, d);

            appendTextPath(text, path4.attr("id"))
                .attr("class", "date")
                .text(timeSpan)
                .each(truncate(d, 3));
        }
    } else {
        // Outer labels
        let name     = d.data.name;
        let timeSpan = getTimeSpan(d);

        // Return first name for inner circles
        if (d.depth < 7) {
            name = getFirstNames(d);
        }

        // Create the text elements for first name, last name and
        // the birth/death dates
        appendOuterArcText(d, 0, label, name);

        // The outer most circles show the complete name and do not distinguish between
        // first name, last name and dates
        if (d.depth < 7) {
            // Add last name
            appendOuterArcText(d, 1, label, getLastName(d));

            if ((d.depth < 5) && d.data.alternativeName) {
                let textElement = appendOuterArcText(d, 2, label, d.data.alternativeName, "alternativeName");

                if (d.data.isAltRtl) {
                    textElement.classed("rtl", true);
                }
            }

            // Add dates
            if ((d.depth < 6) && timeSpan) {
                appendOuterArcText(d, 3, label, timeSpan, "date");
            }
        }

        // Rotate outer labels in right position
        transformOuterText(label, d);
    }
}

export function addPersonData(person, d) {
    if (person.classed("new") && rso.options.hideEmptySegments) {
        addArcToPerson(person, d);
    } else {
        if (!person.classed("new")
            && !person.classed("update")
            && !person.classed("remove")
            && ((d.data.xref !== "") || !rso.options.hideEmptySegments)
        ) {
            addArcToPerson(person, d);
        }
    }

    if (d.data.xref !== "") {
        addTitleToPerson(person, d);

        // Append labels (initial hidden)
        let label = addLabelToPerson(person);

        addArcPathToLabel(label, d);
    }

    // Hovering
    person
        .on("mouseover", function () {
            d3.select(this).classed("hover", true);
        })
        .on("mouseout", function () {
            d3.select(this).classed("hover", false);
        });
}

/**
 * Create an gradient fill and return unique identifier.
 *
 * @param {object} d D3 data object
 *
 * @return {void}
 */
export function addGradientColor(d) {
    if (d.depth < 1) {
        return;
    }

    // Define initial gradient colors starting with second generation
    if (d.depth === 1) {
        let color1 = [64, 143, 222];
        let color2 = [161, 219, 117];

        if (d.data.sex === SEX_FEMALE) {
            color1 = [218, 102, 13];
            color2 = [235, 201, 33];
        }

        d.data.colors = [color1, color2];

        // Calculate subsequent gradient colors
    } else {
        let c = [
            Math.ceil((d.parent.data.colors[0][0] + d.parent.data.colors[1][0]) / 2.0),
            Math.ceil((d.parent.data.colors[0][1] + d.parent.data.colors[1][1]) / 2.0),
            Math.ceil((d.parent.data.colors[0][2] + d.parent.data.colors[1][2]) / 2.0),
        ];

        if (d.data.sex === SEX_MALE) {
            d.data.colors[0] = d.parent.data.colors[0];
            d.data.colors[1] = c;
        }

        if (d.data.sex === SEX_FEMALE) {
            d.data.colors[0] = c;
            d.data.colors[1] = d.parent.data.colors[1];
        }
    }

    // Add a new radial gradient
    let newGrad = config.svgDefs
        .append("svg:linearGradient")
        .attr("id", function () {
            return "grad-" + d.data.id;
        });

    // Define start and stop colors of gradient
    newGrad.append("svg:stop")
        .attr("offset", "0%")
        .attr("stop-color", "rgb(" + d.data.colors[0].join(",") + ")");

    newGrad.append("svg:stop")
        .attr("offset", "100%")
        .attr("stop-color", "rgb(" + d.data.colors[1].join(",") + ")");
}

/**
 * Adds an color overlay for each arc.
 *
 * @return {object} Color group object
 */
export function addColorGroup() {
    // Arc generator
    let arcGen = d3.arc()
        .startAngle(function (d) {
            return (d.depth === 0) ? 0 : startAngle(d);
        })
        .endAngle(function (d) {
            return (d.depth === 0) ? MATH_PI2 : endAngle(d);
        })
        .innerRadius(function (d) {
            return outerRadius(d) - rso.options.colorArcWidth;
        })
        .outerRadius(function (d) {
            return outerRadius(d) + 1;
        });

    let colorGroup = config.svg
        .select("g")
        .append("g")
        .attr("class", "colorGroup")
        .style("opacity", 0);

    colorGroup
        .selectAll("g.colorGroup")
        .data(config.nodes)
        .enter()
        .filter(function (d) {
            return (d.data.xref !== "");
        })
        .append("path")
        .attr("fill", function (d) {
            if (rso.options.showColorGradients) {
                // Innermost circle (first generation)
                if (!d.depth) {
                    return "rgb(225, 225, 225)";
                }

                return "url(#grad-" + d.data.id + ")";
            }

            return d.data.color;
        })
        .attr("d", arcGen);

    return colorGroup;
}

/**
 * Create the arc elements for each individual in the data list.
 *
 * @return {void}
 */
export function createArcElements() {
    let personGroup = config.svg.select("g.personGroup");

    personGroup.selectAll("g.person")
        .data(config.nodes)
        .enter()
        .each(function (entry) {
            let person = personGroup
                .append("g")
                .attr("class", "person")
                .attr("id", "person-" + entry.data.id)
                .on("click", null);

            addPersonData(person, entry);

            if (rso.options.showColorGradients) {
                addGradientColor(entry);
            }
        });

    bindClickEventListener();
    addColorGroup()
        .style("opacity", 1);
}

/**
 * This method bind the "click" event listeners to a "person" element.
 */
export function bindClickEventListener() {
    let personGroup = config.svg
        .select("g.personGroup")
        .selectAll("g.person")
        .data(config.nodes)
        .filter(function (d) {
            return (d.data.xref !== "");
        })
        .classed("available", true);

    // Trigger method on click
    personGroup
        .on("click", personClick);
}

/**
 * Redirect the current page the the individual page.
 *
 * @param {object} d D3 data object
 */
function individual(d) {
    window.location = rso.options.individualUrl + d.data.xref;
}

/**
 * Method triggers either the "update" or "individual" method on the click on an person.
 *
 * @param {Object} data The D3 data object
 */
function personClick(data) {
    // Trigger either "update" or "individual" method on click depending on person in chart
    (data.depth === 0) ? individual(data) : update(data);
}

/**
 * Returns TRUE if the depth of the element is in the inner range. So labels should
 * be rendered along an arc path. Otherwise returns FALSE to indicate the element
 * is either the center one or an outer arc.
 *
 * @param {object} d D3 data object
 *
 * @return {bool}
 */
export function isInnerLabel(d) {
    return ((d.depth > 0) && (d.depth < rso.options.numberOfInnerCircles));
}

/**
 * Helper method to execute callback method after all transitions are done
 * of a selection.
 *
 * @param {object}   transition D3 transition object
 * @param {function} callback   Callback method
 */
export function endall(transition, callback) {
    let n = 0;

    transition
        .on("start", function() { ++n; })
        .on("end", function() {
            if (!--n) {
                callback.apply(transition);
            }
        });
}

/**
 * Function is executed as callback after all transitions are done in update method.
 */
export function updateDone() {
    // Remove arc if segments should be hidden
    if (rso.options.hideEmptySegments) {
        config.svg
            .selectAll("g.person.remove")
            .selectAll("g.arc")
            .remove();
    }

    // Remove styles so CSS classes may work correct, Uses a small timer as animation seems not
    // to be done already if the point is reached
    let t = d3.timer(function () {
        config.svg
            .selectAll("g.person g.arc path")
            .attr("style", null);

        config.svg
            .selectAll("g.person g.label")
            .style("opacity", null);

        t.stop();
    }, 10);

    config.svg
        .selectAll("g.person.new, g.person.update, g.person.remove")
        .classed("new", false)
        .classed("update", false)
        .classed("remove", false)
        .selectAll("g.label.old, title.old")
        .remove();

    config.svg
        .selectAll("g.colorGroup:not(.new)")
        .remove();

    config.svg
        .selectAll("g.colorGroup.new")
        .classed("new", false);

    config.svg
        .selectAll("g.person.available")
        .classed("available", false);

    // Add click handler after all transitions are done
    bindClickEventListener();
}

/**
 * Update the chart with data loaded from AJAX.
 *
 * @param {object} d D3 data object
 */
export function update(d) {
    config.svg
        .selectAll("g.person")
        .on("click", null);

    d3.json(
        rso.options.updateUrl + d.data.xref
    ).then(function (data) {
        // Initialize the new loaded data
        initData(data);

        // Flag all elements which are subject to change
        config.svg
            .selectAll("g.person")
            .data(config.nodes)
            .each(function (entry) {
                let person = d3.select(this);

                person.classed("remove", entry.data.xref === "")
                    .classed("update", (entry.data.xref !== "") && person.classed("available"))
                    .classed("new", (entry.data.xref !== "") && !person.classed("available"));

                if (!person.classed("new")) {
                    person.selectAll("g.label, title")
                        .classed("old", true);
                }

                addPersonData(person, entry);
            });

        // Hide all new labels of not removed elements
        config.svg
            .selectAll("g.person:not(.remove)")
            .selectAll("g.label:not(.old)")
            .style("opacity", 0);

        addColorGroup()
            .classed("new", true);

        // Create transition instance
        let t = d3.transition()
            .duration(rso.options.updateDuration)
            .call(endall, function () { updateDone(); });

        // Fade out old arc
        config.svg
            .selectAll("g.person.remove g.arc path")
            .transition(t)
            .style("fill", function () {
                return rso.options.hideEmptySegments ? null : "rgb(240, 240, 240)";
            })
            .style("opacity", function () {
                return rso.options.hideEmptySegments ? 0 : null;
            });

        // Fade in new arcs
        config.svg
            .selectAll("g.person.new g.arc path")
            .transition(t)
            .style("fill", "rgb(250, 250, 250)")
            .style("opacity", function () {
                return rso.options.hideEmptySegments ? 1 : null;
            });

        // Fade out all old labels and color group
        config.svg
            .selectAll("g.person.update g.label.old, g.person.remove g.label.old, g.colorGroup:not(.new)")
            .transition(t)
            .style("opacity", 0);

        // Fade in all new labels and color group
        config.svg
            .selectAll("g.person:not(.remove) g.label:not(.old), g.colorGroup.new")
            .transition(t)
            .style("opacity", 1);
    });
}

/**
 * Get the relative position offsets in percent for different text lines (givenname, surname, dates).
 *   => (0 = inner radius, 100 = outer radius)
 *
 * @param {int}    index Index position of element in parent container. Required to create a unique path id.
 * @param {object} d     D3 data object
 *
 * @return {int}
 */
export function getTextOffset(index, d) {
    // TODO Calculate values instead of using hard coded ones
    return isPositionFlipped(d) ? [20, 35, 58, 81][index] : [75, 60, 37, 14][index];
}

/**
 * Truncates the text of the current element depending on its depth
 * in the chart.
 *
 * @param {object} d     D3 data object
 * @param {int}    index Index position of element in parent container
 *
 * @returns {string} Truncated text
 */
export function truncate(d, index) {
    let availableWidth = getAvailableWidth(d, index);

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
 * @param {object} d     D3 data object
 * @param {int}    index Index position of element in parent container.
 *
 * @returns {int} Calculated available width
 */
export function getAvailableWidth(d, index) {
    // Innermost circle (Reducing the width slightly, avoiding the text is sticking too close to the edge)
    let availableWidth = (rso.options.centerCircleRadius * 2) - (rso.options.centerCircleRadius * 0.15);

    if ((d.depth >= 1) && (d.depth < rso.options.numberOfInnerCircles)) {
        // Calculate length of the arc
        availableWidth = arcLength(d, getTextOffset(index, d));
    } else {
        // Outer arcs
        if (d.depth >= rso.options.numberOfInnerCircles) {
            availableWidth = rso.options.outerArcHeight;
        }
    }

    return availableWidth - (rso.options.textPadding * 2);
}

// /**
//  * Get the first names of an person.
//  *
//  * @param {object} d D3 data object
//  *
//  * @return {string}
//  */
// export function getFirstNames(d) {
//     return d.data.name.substr(0, d.data.name.lastIndexOf(" "));
// }

/**
 * Get the last name of an person.
 *
 * @param {object} d D3 data object
 *
 * @return {string}
 */
export function getLastName(d) {
    return d.data.name.substr(d.data.name.lastIndexOf(" ") + 1);
}

/**
 * Get the time span label of an person. Returns null if label
 * should not be displayed due empty data.
 *
 * @param {object} d D3 data object
 *
 * @return {null|string}
 */
export function getTimeSpan(d) {
    if (d.data.born || d.data.died) {
        return d.data.born + "-" + d.data.died;
    }

    return null;
}

/**
 * Check for the 360 degree chart if the current arc labels
 * should be flipped for easier reading.
 *
 * @param {object} d D3 data object
 *
 * @return {boolean}
 */
export function isPositionFlipped(d) {
    if ((rso.options.fanDegree !== 360) || (d.depth <= 1)) {
        return false;
    }

    let sAngle = startAngle(d);
    let eAngle = endAngle(d);

    // Flip names for better readability depending on position in chart
    return ((sAngle >= (90 * MATH_DEG2RAD)) && (eAngle <= (180 * MATH_DEG2RAD)))
        || ((sAngle >= (-180 * MATH_DEG2RAD)) && (eAngle <= (-90 * MATH_DEG2RAD)));
}

/**
 * Append a path element to the given parent group element.
 *
 * @param {object} label Parent container element, D3 group element
 * @param {int}    index Index position of element in parent container. Required to create a unique path id.
 * @param {object} d     D3 data object
 *
 * @return {object} D3 path object
 */
export function appendPathToLabel(label, index, d) {
    let personId = d3.select(label.node().parentNode).attr("id");

    // Create arc generator for path segments
    let arcGenerator = d3.arc()
        .startAngle(function () {
            return isPositionFlipped(d)
                ? endAngle(d)
                : startAngle(d);
        })
        .endAngle(function () {
            return isPositionFlipped(d)
                ? startAngle(d)
                : endAngle(d);
        })
        .innerRadius(function () {
            return relativeRadius(d, getTextOffset(index, d));
        })
        .outerRadius(function () {
            return relativeRadius(d, getTextOffset(index, d));
        });

    // Append a path so we could use it to write the label along it
    return label.append("path")
        .attr("id", personId + "-" + index)
        .attr("d", arcGenerator);
}

/**
 * Append text element to the given group element.
 *
 * @param {object} d         D3 data object
 * @param {int}    index     Index position of element in parent container
 * @param {object} group     D3 group (g) object
 * @param {string} label     Label to display
 * @param {string} textClass Optional class to set to the D3 text element
 *
 * @return {object} D3 text object
 */
export function appendOuterArcText(d, index, group, label, textClass) {
    let textElement = group.append("text");

    textElement.attr("class", textClass || null)
        .attr("class", textClass || null)
        .attr("dominant-baseline", "middle")
        .style("font-size", function () {
            return getFontSize(d);
        })
        .text(label)
        .each(truncate(d, index));

    return textElement;
}

// /**
//  * Get an radius relative to the outer radius adjusted by the given
//  * position in percent.
//  *
//  * @param {Object} data     The D3 data object
//  * @param {Number} position The percent offset (0 = inner radius, 100 = outer radius)
//  *
//  * @returns {Number}
//  */
// export function arcLength(data, position) {
//     return (endAngle(data) - startAngle(data)) * relativeRadius(data, position);
// }

/**
 * Add title element to the person element containing the full name of the individual.
 *
 * @param {Object} person Parent element used to append the title too
 * @param {Object} data   The D3 data object
 */
export function addTitleToPerson(person, data) {
    person
        .insert("title", ":first-child")
        .text(data.data.name);
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
export function transformOuterText(label, data) {
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

        offsetRotate *= mapIndexToOffset(i) * rso.options.fontScale / 100.0;

        // Name of center person should not be rotated in any way
        if (data.depth === 0) {
            d3.select(this).attr("dy", offsetRotate + "em");
        } else {
            d3.select(this).attr("transform", function () {
                let dx        = data.x1 - data.x0;
                let angle     = rso.options.x(data.x0 + (dx / 2)) * MATH_RAD2DEG;
                let rotate    = angle - (offsetRotate * (angle > 0 ? -1 : 1));
                let translate = (centerRadius(data) - (rso.options.colorArcWidth / 2.0));

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
