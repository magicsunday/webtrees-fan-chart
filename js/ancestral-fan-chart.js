/*global
    window, console, Math, d3, jQuery, $
*/

/**
 * Webtrees module.
 *
 * Copyright (C) 2017  Rico Sonntag
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301  USA
 */

/**
 * jQuery widget "rso.ancestralFanChart"
 */
(function ($) {
    'use strict';

    $.widget('rso.ancestralFanChart', {
        options: {
            nameSwitchTreshold: 5,

            // Default font size
            fontSize: 14,

            hideEmptyCells : false,

            // Default font scaling factor
            fontScale: 100,

            // Degrees of the fan chart
            fanDegree: 360,

            startPi: -Math.PI,
            endPi: Math.PI,

            width: 1200,
            height: 1200,
            radius: 600,
            padding: 5,

            x: null
        },

        /**
         * Initialize the tool.
         *
         * @constructs ancestralFanChart
         */
        _create: function () {
            // Check dependencies
            this.checkDependencies();

            this.options.startPi = -(this.options.fanDegree / 360 * Math.PI);
            this.options.endPi = (this.options.fanDegree / 360 * Math.PI);

            if (this.options.width > $(window).width() - 25) {
                this.options.width = $(window).width() - 25;
            }

            this.options.radius = this.options.width >> 1;

            // Scale the angles linear across the circle
            this.options.x = d3.scale.linear().range([this.options.startPi, this.options.endPi]);

            // Start bootstrapping
            this.bootstrap();
            this.initChart(this.options.data);
            this.placeArcs();

            // Adjust size of svg
            var bbox = this.config.visual.node().getBBox();
            var radius = bbox.width >> 1;

            d3.select(this.config.visual.node().parentNode)
                .attr('width', bbox.width + (this.options.padding << 1))
                .attr('height', bbox.height + (this.options.padding << 1));

            this.config.visual.attr(
                'transform',
                'translate(' + [radius + this.options.padding, radius + this.options.padding] + ')'
            );
        },

        /**
         * Check widget dependencies
         *
         * @returns {boolean}
         * @private
         */
        checkDependencies: function () {
            // Confirm d3 is available [check minimum version]
            if (typeof d3 !== 'object' || !d3.hasOwnProperty('version')) {
                console.error('d3 error: d3 is not available');
                console.info(typeof d3);
                return false;
            }

            return true;
        },

        /**
         * Bootstrap all requirement for all charts
         *
         * @private
         */
        bootstrap: function () {

            // Default configuration
            this.config = {
                elements: {
                    chart: this.element.find('#fan-chart')
                }
            };
        },

        /**
         * Initialize the chart.
         *
         * @private
         */
        initChart: function (data) {
            this.config.visual = d3
                .select('#fan-chart')
                .append('svg')
                .attr('width', this.options.width + (this.options.padding << 1))
                .attr('height', this.options.height + (this.options.padding << 1))
                .attr('text-rendering', 'geometricPrecision')
                .attr('text-anchor', 'middle')
                .append('g')
                .attr('class', 'group');

            this.config.nodes = d3.layout.partition()
                .sort(null) // prevent reordering of data
                .value(function (d) {
                    return d.depth;
                })
                .nodes(data);
        },

        /**
         * Call all the methods required to draw the arcs and labels.
         */
        placeArcs: function () {
            this.drawBorderCenterCircle();
            this.drawBorderArcs();
            this.setArcLabels();
            this.setLabels();
        },

        /**
         * Get the start angle.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        startAngle: function (d) {
            return Math.max(this.options.startPi, Math.min(2 * this.options.endPi, this.options.x(d.x)));
        },

        /**
         * Get the end angle.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        endAngle: function (d) {
            return Math.max(this.options.startPi, Math.min(2 * this.options.endPi, this.options.x(d.x + d.dx)));
        },

        /**
         * Get the inner radius depending on the depth of an element.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        innerRadius: function (d) {
            return [0, 65, 130, 195, 260, 325, 440, 555, 670][d.depth];
        },

        /**
         * Get the outer radius depending on the depth of an element.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        outerRadius: function (d) {
            return [65, 130, 195, 260, 325, 440, 555, 670, 775][d.depth];
        },

        /**
         * Get the center radius.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        centerRadius: function (d) {
            return (this.innerRadius(d) + this.outerRadius(d)) >> 1;
        },

        /**
         * Whether to show empty cell of the chart or not.
         *
         * @param {object} d D3 data object
         *
         * @return {boolean}
         */
        hideEmptyCells: function (d) {
            return !this.options.hideEmptyCells || (d.id !== '');
        },

        /**
         * Draws the center circle of the fan chart.
         */
        drawBorderCenterCircle: function () {
            var that = this;

            var arcGenerator = d3.svg.arc()
                .startAngle(0)
                .endAngle(Math.PI * 2)
                .innerRadius(function (d) {
                    return that.innerRadius(d);
                })
                .outerRadius(function (d) {
                    return that.outerRadius(d);
                });

            var borderArcs = this.config.visual
                .append('g')
                .attr('class', 'arcs')
                .data(
                    // Remove all not required data
                    this.config.nodes.filter(function (d) {
                        return d.depth === 0;
                    })
                )
                .append('g')
                .attr('class', 'arc');

            this.drawBorders(borderArcs, arcGenerator);
        },

        /**
         * Draws the borders of the single arcs.
         */
        drawBorderArcs: function () {
            var that = this;

            var arcGenerator = d3.svg.arc()
                .startAngle(function (d) {
                    return that.startAngle(d);
                })
                .endAngle(function (d) {
                    return that.endAngle(d);
                })
                .innerRadius(function (d) {
                    return that.innerRadius(d);
                })
                .outerRadius(function (d) {
                    return that.outerRadius(d);
                });

            var borderArcs = this.config.visual
                .select('g.arcs')
                .selectAll('g.arc')
                .data(
                    // Remove all not required data
                    this.config.nodes.filter(function (d) {
                        return that.hideEmptyCells(d);
                    })
                )
                .enter()
                .append('g')
                .attr('class', 'arc');

            // Add title element containing the full name of the individual
            borderArcs.append('title')
                .text(function (d) {
                    // Return name or remove empty element
                    return (d.id !== '') ? d.name : this.remove();
                });

            this.drawBorders(borderArcs, arcGenerator);
        },

        /**
         * Draws the borders using the given arc generator.
         *
         * @param {object}   borderArcs   Elements selected
         * @param {function} arcGenerator Arc generator
         */
        drawBorders: function (borderArcs, arcGenerator) {
            borderArcs.append('path')
                .attr('fill', function (d) {
                    return d.color;
                })
                .attr('d', arcGenerator);
        },

        /**
         * Truncates the text of the current element depending on its depth
         * in the chart.
         *
         * @param {int} padding Left/Right padding of text
         *
         * @returns {string} Truncated text
         */
        truncate: function (padding) {
            var that = this;

            return function (d) {
                // Modifier of available width depending on fan degrees
                var widthMod = that.options.fanDegree / 360;

                // Depending on the depth of an entry in the chart the available width differs
                var availableWidth = 110;

                if (d.depth === 1) {
                    availableWidth = 280 * widthMod;
                }

                if (d.depth === 2) {
                    availableWidth = 230 * widthMod;
                }

                if (d.depth === 3) {
                    availableWidth = 160 * widthMod;
                }

                if (d.depth === 4) {
                    availableWidth = 110 * widthMod;
                }

                var self = d3.select(this),
                    textLength = self.node().getComputedTextLength(),
                    text = self.text();

                while ((textLength > (availableWidth - (padding << 1))) && (text.length > 0)) {
                    // Remove last char
                    text = text.slice(0, -1);

                    // Recalculate the text width
                    textLength = self
                        .text(text + '...')
                        .node()
                        .getComputedTextLength();
                }
            };
        },

        /**
         * Get the first names of an person.
         *
         * @param {object} d D3 data object
         *
         * @return {string}
         */
        getFirstNames: function (d) {
            return d.name.substr(0, d.name.lastIndexOf(' '));
        },

        /**
         * Get the last name of an person.
         *
         * @param {object} d D3 data object
         *
         * @return {string}
         */
        getLastName: function (d) {
            return d.name.substr(d.name.lastIndexOf(' ') + 1);
        },

        /**
         * Get the last name of an person.
         *
         * @param {object} d D3 data object
         *
         * @return {string}
         */
        getTimespan: function (d) {
            if (d.born || d.died) {
                return d.born + '-' + d.died;
            }

            // Remove empty element
            return null;
        },

        /**
         * Append a new "textPath" element to the given "text" element.
         *
         * @param {object} text D3 text object
         *
         * @return {object} D3 textPath object
         */
        appendTextPath: function (text) {
            return text.append('textPath')
                .attr('startOffset', '25%')
                .attr('xlink:href', function (ignore, i) {
                    return '#label-' + i;
                });
        },

        /**
         * Get the scaled font size.
         *
         * @param {number} fontSize Base font size used to calculate scaled one
         *
         * @return {string}
         */
        getFontSize: function (fontSize) {
            var fontSize = fontSize || this.options.fontSize;
            return (fontSize * this.options.fontScale / 100) + 'px';
        },

        appendPathToArc: function (index, entry, label, position, textPathClass) {
            textPathClass = textPathClass || null;

            var that = this;

            var labelArc = d3.svg.arc()
                .startAngle(function (d) {
                    var sAngle = that.startAngle(d);

                    if ((that.options.fanDegree !== 360) || (d.depth <= 1)) {
                        return sAngle;
                    }

                    var eAngle = that.endAngle(d);

                    // Flip names for better readability depending on position in chart
                    if (((sAngle >= (90 * Math.PI / 180)) && (eAngle <= (180 * Math.PI / 180))) ||
                        ((sAngle >= (-180 * Math.PI / 180)) && (eAngle <= (-90 * Math.PI / 180)))
                    ) {
                        return eAngle;
                    }

                    return sAngle;
                })
                .endAngle(function (d) {
                    var eAngle = that.endAngle(d);

                    if ((that.options.fanDegree !== 360) || (d.depth <= 1)) {
                        return eAngle;
                    }

                    var sAngle = that.startAngle(d);

                    // Flip names depending on position in chart
                    if (((sAngle >= (90 * Math.PI / 180)) && (eAngle <= (180 * Math.PI / 180))) ||
                        ((sAngle >= (-180 * Math.PI / 180)) && (eAngle <= (-90 * Math.PI / 180)))
                    ) {
                        return sAngle;
                    }

                    return eAngle;
                })
                .innerRadius(function (d) {
                    var arcRadius = that.outerRadius(d) - that.innerRadius(d);
                    var radius    = that.outerRadius(d) - ((100 - position) * arcRadius / 100);

                    return radius;
                })
                .outerRadius(function (d) {
                    var arcRadius = that.outerRadius(d) - that.innerRadius(d);
                    var radius    = that.outerRadius(d) - ((100 - position) * arcRadius / 100);

                    return radius;
                });

            // Append a path so we could use it to write the label along it
            entry.append('path')
                .attr('d', labelArc)
                .attr('id', function (d, i) {
                    return 'label-' + index + '-' + d.id;
                })
//                .style('stroke', 'red')
//                .style('stroke-width', 1)
                ;

            var text = entry.append('text')
                .style('font-size', function (d) {
                    return that.getFontSize(13 - d.depth);
                });

            // First names
            var textPath = text.append('textPath')
                .attr('class', textPathClass)
                .attr('startOffset', '25%')
                .attr('xlink:href', function (d, i) {
                    return '#label-' + index + '-' + d.id;
                });

            textPath.append('tspan')
                .attr('dominant-baseline', 'middle')
//                .attr('dy', '0.25em')
                .text(label)
                .each(that.truncate(5));
        },

        /**
         * Set the arc labels.
         */
        setArcLabels: function () {
            var that = this;

            var entry = this.config.visual
                .append('g')
                .attr('class', 'labels')
                .selectAll('g.label')
                .data(
                    // Remove all not required data
                    this.config.nodes.filter(function (d) {
                        return (d.id !== '') && (d.depth > 0) && (d.depth < that.options.nameSwitchTreshold);
                    })
                )
                .enter()
                .append('g')
                .attr('class', 'label');

            // Add title element containing the full name of the individual
            entry.append('title')
                .text(function (d) {
                    // Return name or remove empty element
                    return (d.id !== '') ? d.name : this.remove();
                });

            entry.each(function (d) {
console.log(d);
                that.appendPathToArc(0, d3.select(this), that.getFirstNames(d), 70);
                that.appendPathToArc(1, d3.select(this), that.getLastName(d), 52);

                var timespan = that.getTimespan(d);

                if (timespan) {
                    that.appendPathToArc(2, d3.select(this), timespan, 25, 'date');
                }
            });

//            var labelArc = d3.svg.arc()
//                .startAngle(function (d) {
//                    var sAngle = that.startAngle(d);
//
//                    if ((that.options.fanDegree !== 360) || (d.depth <= 1)) {
//                        return sAngle;
//                    }
//
//                    var eAngle = that.endAngle(d);
//
//                    // Flip names for better readability depending on position in chart
//                    if (((sAngle >= (90 * Math.PI / 180)) && (eAngle <= (180 * Math.PI / 180))) ||
//                        ((sAngle >= (-180 * Math.PI / 180)) && (eAngle <= (-90 * Math.PI / 180)))
//                    ) {
//                        return eAngle;
//                    }
//
//                    return sAngle;
//                })
//                .endAngle(function (d) {
//                    var eAngle = that.endAngle(d);
//
//                    if ((that.options.fanDegree !== 360) || (d.depth <= 1)) {
//                        return eAngle;
//                    }
//
//                    var sAngle = that.startAngle(d);
//
//                    // Flip names depending on position in chart
//                    if (((sAngle >= (90 * Math.PI / 180)) && (eAngle <= (180 * Math.PI / 180))) ||
//                        ((sAngle >= (-180 * Math.PI / 180)) && (eAngle <= (-90 * Math.PI / 180)))
//                    ) {
//                        return sAngle;
//                    }
//
//                    return eAngle;
//                })
//                .innerRadius(function (d) {
//                    var arcRadius    = (that.outerRadius(d) - that.innerRadius(d)) >> 1;
//                    var centerRadius = that.innerRadius(d) + (arcRadius >> 1);
//
//                    return centerRadius;
//                })
//                .outerRadius(function (d) {
//                    var arcRadius    = (that.outerRadius(d) - that.innerRadius(d)) >> 1;
//                    var centerRadius = that.innerRadius(d) + (arcRadius >> 1);
//
//                    return centerRadius;
//                });
//
//            // Append a path so we could use it to write the label along it
//            entry.append('path')
//                .attr('d', labelArc)
//                .attr('id', function (ignore, i) {
//                    return 'label-' + i;
//                })
//                .style('stroke', 'red')
//                .style('stroke-width', 1);
//
//            var text = entry.append('text')
//                .style('font-size', function (d) {
//                    return that.getFontSize(13 - d.depth);
//                });
//
//            // First names
//            var textPath1 = text.append('textPath')
//                .attr('startOffset', '25%')
//                .attr('xlink:href', function (ignore, i) {
//                    return '#label-' + i;
//                });
//
//            textPath1.append('tspan')
//                .attr('dominant-baseline', 'middle')
////                .attr('dy', '0.25em')
//                .text(function (d) {
//                    return that.getFirstNames(d);
//                })
//                .each(that.truncate(5));


//            // Append a path so we could use it to write the label along it
//            entry.append('path')
//                .attr('d', labelArc2)
//                .attr('id', function (ignore, i) {
//                    return 'label-2' + i;
//                })
//                .style('stroke', 'red')
//                .style('stroke-width', 1);

//            var text = entry.append('text')
//                .style('font-size', function (d) {
//                    return that.getFontSize(13 - d.depth);
//                });
//
//            // Last name
//            var textPath2 = text.append('textPath')
//                .attr('startOffset', '25%')
//                .attr('xlink:href', function (ignore, i) {
//                    return '#label-2' + i;
//                });
//
//            textPath2.append('tspan')
//                .attr('dominant-baseline', 'middle')
////                .attr('dy', '1.25em')
//                .text(function (d) {
//                    return that.getLastName(d);
//                })
//                .each(that.truncate(5));

//            // Dates
//            var textPath3 = this.appendTextPath(text)
//                .attr('class', 'date');
//
//            textPath3.append('tspan')
//                .attr('dominant-baseline', 'middle')
////                .attr('dy', '1.25em')
//                .text(function (d) {
//                    if (d.born || d.died) {
//                        return d.born + '-' + d.died;
//                    }
//
//                    // Remove empty element
//                    return this.remove();
//                });
        },

        /**
         * Get new D3 text element.
         *
         * @param {object} group D3 group (g) object
         *
         * @return {object} D3 text object
         */
        getText: function (group) {
            var that = this;

            return group
                .append('text')
                .attr('dominant-baseline', 'middle')
                .style('font-size', function (d) {
                    if (d.depth >= (that.options.nameSwitchTreshold + 1)) {
                        return that.getFontSize(14 - d.depth);
                    }

                    return that.getFontSize(13 - d.depth);
                });
        },

        /**
         * Transform the D3 text elements in the group. Rotate each text element
         * depending on its offset, so that they are equally positioned inside
         * the arc.
         *
         * @param {object} group D3 group object
         */
        transformText: function (group) {
            var that = this;

            group.each(function () {
                var textElements = d3.select(this).selectAll('text');
                var countElements = textElements.size();
                var offset = 0;

                textElements.each(function (d, i) {
                    if (countElements === 1) {
                        offset = 0;
                    }

                    if (countElements === 2) {
                        offset = 0.5;
                    }

                    if (countElements === 3) {
                        offset = 1;
                    }

                    var mapIndexToOffset = d3.scale
                        .linear()
                        .domain([0, countElements - 1])
                        .range([-offset, offset]);

                    var offsetRotate = (i <= 1 ? 1.25 : 1.75);

                    if (d.depth === 6) {
                        offsetRotate = 1.00;
                    }

                    if (d.depth === 7) {
                        offsetRotate = 0.75;
                    }

                    if (d.depth === 8) {
                        offsetRotate = 0.5;
                    }

                    offsetRotate *= that.options.fontScale / 100;

                    var text = d3.select(this);

                    // Name of center person should not be rotated in any way
                    if (d.depth === 0) {
                        text.attr('dy', (mapIndexToOffset(i) * offsetRotate) + 'em');
                    } else {
                        text.attr('transform', function (d) {
                            var multangle = d.depth === 1 ? 90 : 180;
                            var angle = that.options.x(d.x + d.dx / 2) * multangle / Math.PI - 90;
                            var rotate = angle - (mapIndexToOffset(i) * offsetRotate * (angle > -90 ? -1 : 1));
                            var transX = (that.innerRadius(d) + that.outerRadius(d)) / 2;

                            return 'rotate(' + rotate + ') '
                                + 'translate(' + transX + ') '
                                + 'rotate(' + (angle > -90 ? 0 : -180) + ')';
                        });
                    }
                });
            });
        },

        /**
         * Set the labels of the outer arc of the chart.
         */
        setLabels: function () {
            var that = this;
            var group = this.config.visual
                .append('g')
                .attr('class', 'labels')
                .selectAll('g.label')
                .data(
                    // Remove all not required data
                    that.config.nodes.filter(function (d) {
                        return (d.id !== '') && (d.depth < 1 || d.depth >= that.options.nameSwitchTreshold);
                    })
                )
                .enter()
                .append('g')
                .attr('class', 'label');

            // Add title element containing the full name of the individual
            group.append('title')
                .text(function (d) {
                    // Return name or remove empty element
                    return (d.id !== '') ? d.name : this.remove();
                });

            // Create a text element for first name, last name and the dates
            var textEnter1 = this.getText(group);
            var textEnter2 = this.getText(group);
            var textEnter3 = this.getText(group);

            textEnter1
                .text(function (d) {
                    return that.getFirstNames(d);
                })
                .each(that.truncate(5));

            textEnter2
                .text(function (d) {
                    return that.getLastName(d);
                })
                .each(that.truncate(5));

            textEnter3
                .attr('class', 'date')
                .style('font-size', function (d) {
                    return that.getFontSize(13 - d.depth);
                })
                .text(function (d) {
                    // Do not show dates in the outer circles, not enough space
                    if (d.depth >= 6) {
                        return this.remove();
                    }

                    if (d.born || d.died) {
                        return d.born + '-' + d.died;
                    }

                    // Remove empty element
                    return this.remove();
                });

            this.transformText(group);
        }
    });
}(jQuery));
