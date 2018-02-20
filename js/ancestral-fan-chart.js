/*global
    window, console, Math, d3, jQuery
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
            // Number of generations to display
            generations: 5,

            // Default background color of an arc
            defaultColor: '#eee',

            nameSwitchThreshold: 5,

            // Default font size, color and scaling
            fontSize: 13,
            fontColor: '#000',
            fontScale: 100,

            // Degrees of the fan chart
            fanDegree: 360,

            startPi: -Math.PI,
            endPi: Math.PI,

            minHeight: 500,
            padding: 5,

            // Left/Right padding of text
            textPadding: 2,

            // Relative position offsets in percent (0 = inner radius, 100 = outer radius)
            positions: [70, 52, 25],

            x: null,

            updateUrl: '',
            individualUrl: ''
        },

        config: {
        },

        /**
         * Initialize the tool.
         *
         * @constructs ancestralFanChart
         */
        _create: function () {
            this.options.startPi = -(this.options.fanDegree / 360 * Math.PI);
            this.options.endPi = (this.options.fanDegree / 360 * Math.PI);

            // Scale the angles linear across the circle
            this.options.x = d3.scaleLinear().range([this.options.startPi, this.options.endPi]);

            // Start bootstrapping
            this.initChart();
            this.initData(this.options.data);
            this.createArcElements();
            this.updateViewBox();
        },

        /**
         * Create an empty child node object.
         *
         * @param {number} generation Generation of the node
         *
         * @return {object}
         */
        createEmptyNode: function (generation) {
            return {
                id: '',
                name: '',
                generation: generation,
                color: this.options.defaultColor
            };
        },

        /**
         * Initialize the chart.
         *
         * @private
         */
        initChart: function () {
            var that = this;

            this.config.zoom = d3.zoom()
                .scaleExtent([.5, 5])
                .on('zoom', $.proxy(this.doZoom, this));

            this.config.zoom.filter(function () {
                // Allow "wheel" event only while control key is pressed
                if (d3.event.type === 'wheel') {
                    if (that.config.zoomLevel && d3.event.ctrlKey) {
                        // Prevent zooming below lowest level
                        if ((that.config.zoomLevel <= 0.5) && (d3.event.deltaY > 0)) {
                            d3.event.preventDefault();
                            return false;
                        }

                        // Prevent zooming above highest level
                        if ((that.config.zoomLevel >= 5.0) && (d3.event.deltaY < 0)) {
                            d3.event.preventDefault();
                            return false;
                        }
                    }

                    return d3.event.ctrlKey;
                }

                // Allow "touchmove" event only with two fingers
                if (!d3.event.button && (d3.event.type === 'touchmove')) {
                    return d3.event.touches.length === 2;
                }

                return true;
            });

            // Parent container
            this.config.parent = d3
                .select('#fan_chart');

            // Add SVG element
            this.config.svg = this.config.parent
                .append('svg')
                .attr('width', '100%')
                .attr('height', '100%')
                .attr('text-rendering', 'geometricPrecision')
                .attr('text-anchor', 'middle')
                .on('contextmenu', function () {
                    d3.event.preventDefault();
                })
                .on('wheel', $.proxy(function () {
                    if (!d3.event.ctrlKey) {
                        that.showTooltipOverlay(this.options.labels.zoom, 300, function () {
                            that.hideTooltipOverlay(700, 800);
                        })
                    }
                }, this))
                .on('touchstart', $.proxy(function () {
                    // Show tooltip if less than 2 fingers are used
                    if (d3.event.touches.length < 2) {
                        that.showTooltipOverlay(this.options.labels.move, 300);
                    }
                }, this))
                .on('touchend', $.proxy(function () {
                    if (d3.event.touches.length < 2) {
                        that.hideTooltipOverlay(0, 800);
                    }
                }, this))
                .on('touchmove', $.proxy(function () {
                    // Hide tooltip on more than 2 fingers
                    if (d3.event.touches.length >= 2) {
                        that.hideTooltipOverlay();
                    } else {
                        // Show tooltip if less than 2 fingers are used
                        if (d3.event.touches.length < 2) {
                            that.showTooltipOverlay(this.options.labels.move);
                        }
                    }
                }, this))
                .on('click', $.proxy(this.doStopPropagation, this), true);

            // Add an overlay with tooltip
            this.config.overlay = this.config.parent
                .append('div')
                .attr('class', 'overlay')
                .style('opacity', 1e-6);

            // Add rectangle element
            this.config.svg
                .append('rect')
                .attr('class', 'background')
                .attr('width', '100%')
                .attr('height', '100%');

            // Bind click event on reset button
            var $resetButton = $(this.config.parent.node())
                .siblings('form')
                .find('input[type=reset]');

            d3.select($resetButton.get(0))
                .on('click', $.proxy(this.doReset, this));

            // Add group
            this.config.visual = this.config.svg
                .append('g')
                .attr('class', 'group');

            this.config.svg.call(this.config.zoom);
        },

        /**
         * Stop any pending transition and hide overlay immediately.
         *
         * @param {string}  text     Text to display in overlay
         * @param {int}     duration Duration of transition in msec
         * @param {closure} callback Callback method to execute on end of transition
         *
         * @private
         */
        showTooltipOverlay: function (text, duration, callback) {
            duration = duration || 0;

            this.config.overlay
                .select('p')
                .remove();

            this.config.overlay
                .append('p')
                .attr('class', 'tooltip')
                .text(text);

            this.config.overlay
                .transition()
                .duration(duration)
                .style('opacity', 1)
                .on('end', function() {
                    if (callback) {
                        callback();
                    }
                });;
        },

        /**
         * Stop any pending transition and hide overlay immediately.
         *
         * @param {int} delay    Delay in msec to wait before transition should start
         * @param {int} duration Duration of transition in msec
         *
         * @private
         */
        hideTooltipOverlay: function (delay, duration) {
            delay = delay || 0;
            duration = duration || 0;

            this.config.overlay
                .transition()
                .delay(delay)
                .duration(duration)
                .style('opacity', 1e-6);
        },

        /**
         * Prevent default click and stop propagation.
         *
         * @private
         */
        doStopPropagation: function () {
            if (d3.event.defaultPrevented) {
                d3.event.stopPropagation();
            }
        },

        /**
         * Reset chart to initial zoom level and position.
         *
         * @private
         */
        doReset: function () {
            this.config.svg
                .transition()
                .duration(750)
                .call(this.config.zoom.transform, d3.zoomIdentity);
        },

        /**
         * Zoom chart.
         *
         * @private
         */
        doZoom: function () {
            // Abort any action if only one finger is used on "touchmove" events
            if (d3.event.sourceEvent
                && (d3.event.sourceEvent.type === 'touchmove')
                && (d3.event.sourceEvent.touches.length < 2)
            ) {
                return;
            }

            this.config.zoomLevel = d3.event.transform.k;

            this.config.visual.attr(
                'transform',
                d3.event.transform
            );
        },

        /**
         * Initialize the chart data.
         *
         * @param {object} data JSON encoded data
         *
         * @private
         */
        initData: function (data) {
            var that = this;

            // Construct root node
            var root = d3.hierarchy(
                data,
                function (d) {
                    // Fill up the missing children to the requested number of generations
                    if (!d.children && (d.generation < that.options.generations)) {
                        return [
                            that.createEmptyNode(d.generation + 1),
                            that.createEmptyNode(d.generation + 1)
                        ];
                    }

                    // Add missing parent record if we got only one
                    if (d.children && (d.children.length < 2)) {
                        if (d.children[0].sex === 'M') {
                            // Append empty node if we got an father
                            d.children
                                .push(that.createEmptyNode(d.generation + 1));
                        } else {
                            // Else prepend empty node
                            d.children
                                .unshift(that.createEmptyNode(d.generation + 1));
                        }
                    }

                    return d.children;
                })
                // Calculate number of leaves
                .count();

            var partition = d3.partition();
            this.config.nodes = partition(root).descendants();
        },

        /**
         * Update the viewBox attribute of the SVG element.
         */
        updateViewBox: function () {
            var svgBoundingBox    = this.config.visual.node().getBBox();
            var clientBoundingBox = this.config.parent.node().getBoundingClientRect();

            // View box should have at least the same width/height as the parent element
            var width       = Math.max(clientBoundingBox.width, svgBoundingBox.width);
            var height      = Math.max(clientBoundingBox.height, svgBoundingBox.height, this.options.minHeight);

            var viewBoxLeft   = -Math.round((width / 2) + this.options.padding);
            var viewBoxTop    = Math.round(svgBoundingBox.y - this.options.padding);
            var viewBoxWidth  = Math.round(width + (this.options.padding * 2));
            var viewBoxHeight = Math.round(height + (this.options.padding * 2));

            // Set view box to actual width and height of svg
            this.config.svg
                .attr('viewBox', [
                    viewBoxLeft,
                    viewBoxTop,
                    viewBoxWidth,
                    viewBoxHeight
                ]);

            this.config.svg
                .select('rect')
                .attr('x', viewBoxLeft)
                .attr('y', viewBoxTop);
        },

        /**
         * Calculate the angle in radians.
         *
         * @param {number} value Value
         *
         * @returns {number}
         */
        calcAngle: function (value) {
            return Math.max(
                this.options.startPi,
                Math.min(this.options.endPi, this.options.x(value))
            );
        },

        /**
         * Get the start angle in radians.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        startAngle: function (d) {
            return this.calcAngle(d.x0);
        },

        /**
         * Get the end angle in radians.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        endAngle: function (d) {
            return this.calcAngle(d.x1);
        },

        /**
         * Get the inner radius depending on the depth of an element.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        innerRadius: function (d) {
            var data = [0, 65, 130, 195, 260, 325, 440, 555, 670, 785, 900];
            return data[d.depth];
        },

        /**
         * Get the outer radius depending on the depth of an element.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        outerRadius: function (d) {
            var data = [65, 130, 195, 260, 325, 440, 555, 670, 785, 900, 1015];
            return data[d.depth];
        },

        /**
         * Get the center radius.
         *
         * @param {object} d D3 data object
         *
         * @returns {number}
         */
        centerRadius: function (d) {
            return (this.innerRadius(d) + this.outerRadius(d)) / 2;
        },

        /**
         * Get an radius relative to the outer radius adjusted by the given
         * position in percent.
         *
         * @param {object} d        D3 data object
         * @param {number} position Percent offset (0 = inner radius, 100 = outer radius)
         *
         * @returns {number}
         */
        relativeRadius: function (d, position) {
            var outerRadius = this.outerRadius(d);
            return outerRadius - ((100 - position) * (outerRadius - this.innerRadius(d)) / 100);
        },

        /**
         * Get an radius relative to the outer radius adjusted by the given
         * position in percent.
         *
         * @param {object} d        D3 data object
         * @param {number} position Percent offset (0 = inner radius, 100 = outer radius)
         *
         * @returns {number}
         */
        arcLength: function (d, position) {
            return (this.endAngle(d) - this.startAngle(d)) * this.relativeRadius(d, position);
        },

        /**
         * Draws the borders of the single arcs.
         */
        createArcElements: function () {
            var personGroup = this.config.visual
                .selectAll('g.person')
                .data(this.config.nodes)
                .enter()
                .append('g')
                .attr('class', 'person');

            this.bindClickEventListener();
            this.appendTitle(personGroup);
            this.appendArc(personGroup);
            this.appendLabels(personGroup);

            // Show labels
            personGroup.selectAll('g.label')
                .attr('opacity', 1);
        },

        /**
         * This method bind the "click" event listeners to a "person" element.
         */
        bindClickEventListener: function () {
            // Remove any existing listener
            this.config.visual
                .selectAll('g.person')
                .style('cursor', 'grab')
                .on('click', null);

            var personGroup = this.config.visual
                .selectAll('g.person')
                .data(this.config.nodes)
                .filter(function (d) {
                    return (d.data.id !== '');
                })
                .style('cursor', 'pointer');

            // Trigger method on click
            personGroup
                .on('click', $.proxy(this.personClick, this));
        },

        /**
         * Append a title element containing the full name of the individual
         * to the person group.
         *
         * @param {object} parent Parent element used to append the title
         */
        appendTitle: function (parent) {
            // Add title element containing the full name of the individual
            parent.insert('title', ':first-child')
                .data(this.config.nodes)
                .text(function (d) {
                    // Return name or remove empty element
                    return (d.data.id !== '') ? d.data.name : this.remove();
                });
        },

        /**
         * Create an arc generator.
         *
         * @return {object}
         */
        createArcGenerator: function () {
            var that = this;

            return d3.arc()
                .startAngle(function (d) {
                    return (d.depth === 0) ? 0 : that.startAngle(d);
                })
                .endAngle(function (d) {
                    return (d.depth === 0) ? (Math.PI * 2) : that.endAngle(d);
                })
                .innerRadius(this.innerRadius)
                .outerRadius(this.outerRadius);
        },

        /**
         * Append a path element using the given arc generator.
         *
         * @param {object} parent Parent element used to append the new path
         */
        appendArc: function (parent) {
            parent.append('g')
                .attr('class', 'arc')
                .append('path')
                .attr('fill', function (d) {
                    return d.data.color;
                })
                .attr('d', this.createArcGenerator());
        },

        /**
         * Returns TRUE if the depth of the element is in the inner range. So labels should
         * be rendered along an arc path. Otherwise returns FALSE to indicate the element
         * is either the center one or on the outer arcs.
         *
         * @param {object} d D3 data object
         *
         * @return {bool}
         */
        isInnerLabel: function (d) {
            return ((d.depth > 0)
                && (d.depth < this.options.nameSwitchThreshold));
        },

        /**
         * Append the labels for an arc.
         *
         * @param {object} parent Parent element used to append the labels
         */
        appendLabels: function (parent) {
            var that = this;

            var group = parent
                .data(this.config.nodes)
                .filter(function (d) {
                    // Do not add emtpy elements
                    return (d.data.id !== '');
                })
                .append('g')
                .style('fill', this.options.fontColor)
                .attr('class', 'label');

            // Inner labels (initial hidden)
            var innerLabels = group
                .filter(function (d) {
                    return that.isInnerLabel(d);
                })
                .attr('opacity', 0);

            innerLabels.each(function (d) {
                var label    = d3.select(this);
                var timeSpan = that.getTimeSpan(d);

                // Create a path for each line of text as mobile devices
                // won't display <tspan> elements in the right position
                that.appendArcPath(label, 0);
                that.appendArcPath(label, 1);

                if (timeSpan) {
                    that.appendArcPath(label, 2);
                }

                // Append text element
                var text = label
                    .append('text')
                    .attr('dominant-baseline', 'middle')
                    .style('font-size', function (d) {
                        return that.getFontSize(d);
                    })
                    .style('fill', that.options.fontColor);

                // Append textPath elements along to create paths
                that.appendInnerArcTextPath(text, 0, that.getFirstNames(d));
                that.appendInnerArcTextPath(text, 1, that.getLastName(d));

                if (timeSpan) {
                    that.appendInnerArcTextPath(text, 2, timeSpan, 'chart-date');
                }
            });

            // Outer labels (initial hidden)
            var outerLabels = group
                .filter(function (d) {
                    return !that.isInnerLabel(d);
                })
                .attr('opacity', 0);

            outerLabels.each(function (d) {
                var label    = d3.select(this);
                var name     = d.data.name;
                var timeSpan = that.getTimeSpan(d);

                // Return first name for inner circles
                if (d.depth < 7) {
                    name = that.getFirstNames(d);
                }

                // Create the text elements for first name, last name and
                // the birth/death dates
                that.appendOuterArcText(label, name);

                // Outer circles only show the names
                if (d.depth < 7) {
                    // Add last name
                    that.appendOuterArcText(label, that.getLastName(d));

                    // Add dates
                    if ((d.depth < 6) && timeSpan) {
                        that.appendOuterArcText(label, timeSpan, 'chart-date');
                    }
                }
            });

            this.transformText(outerLabels);
        },

        /**
         * Method triggers either the "update" or "individual" method on the click on an person.
         *
         * @param {object} d D3 data object
         */
        personClick: function (d) {
            // Trigger either "update" or "individual" method on click depending on person in chart
            (d.depth === 0) ? this.individual(d) : this.update(d);
        },

        /**
         * Update the chart with data loaded from AJAX.
         *
         * @param {object} d D3 data object
         */
        update: function (d) {
            var that = this;

            d3.json(
                this.options.updateUrl + d.data.id,
                function (data) {
                    // Initialize the new loaded data
                    that.initData(data);

                    // Update the click event listeners
                    that.bindClickEventListener();

                    var personGroup = that.config.visual
                        .selectAll('g.person');

                    // Update the title
                    personGroup.select('title')
                        .remove();

                    that.appendTitle(personGroup);

                    // Update arc and labels
                    that.updateArcPath();
                    that.updateArcLabel();
                }
            );
        },

        /**
         * Method performs and update of the path values with an
         * animated transition.
         */
        updateArcPath: function () {
            var that = this;

            // Select all path elements and assign the data
            var path = d3.selectAll('g.arc')
                .select('path')
                .data(this.config.nodes);

            // Create path transition
            path.transition()
                .attr('fill', function (d) {
                    return d.data.color;
                })
                .duration(1000);
        },

        /**
         * Method performs and update of the path values with an
         * animated transition.
         */
        updateArcLabel: function () {
            var that = this;

            // Active transition counter
            var count = 0;

            // Fade out existing labels
            d3.selectAll('g.label')
                .transition()
                .duration(500)
                .attr('opacity', 0)
                .on('start', function () {
                    count += 1;
                })
                .on('end', function () {
                    count -= 1;

                    // Wait till all transitions finished
                    if (count === 0) {
                        // Remove all label groups once they are faded out
                        d3.selectAll('g.label').remove();

                        // Append new labels
                        that.appendLabels(d3.selectAll('g.person'));

                        // Fade in
                        d3.selectAll('g.label')
                            .transition()
                            .duration(500)
                            .attr('opacity', 1);
                    }
                });
        },

        /**
         * Redirect the current page the the individual page.
         *
         * @param {object} d D3 data object
         */
        individual: function (d) {
            window.location = this.options.individualUrl + d.data.id;
        },

        /**
         * Get the relative text offset for the labels.
         *
         * @param {int}    index Index position of element in parent container. Required to create a unique path id.
         * @param {object} d     D3 data object
         *
         * @return {int}
         */
        getTextOffset: function(index, d) {
            return this.isPositionFlipped(d)
                ? (100 - this.options.positions[index])
                : this.options.positions[index];
        },

        /**
         * Truncates the text of the current element depending on its depth
         * in the chart.
         *
         * @param {int} index Index position of element in parent container. Required to create a unique path id.
         *
         * @returns {string} Truncated text
         */
        truncate: function (index) {
            var that = this;

            return function (d) {
                // Depending on the depth of an entry in the chart the available width differs
                var availableWidth = 110;
                var posOffset      = that.getTextOffset(index || 1, d);

                // Calc length of the arc
                if (d.depth >= 1 && d.depth < 5) {
                    availableWidth = that.arcLength(d, posOffset);
                }

                var self = d3.select(this),
                    textLength = self.node().getComputedTextLength(),
                    text = self.text();

                while ((textLength > (availableWidth - (that.options.textPadding * 2))) && (text.length > 0)) {
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
            return d.data.name.substr(0, d.data.name.lastIndexOf(' '));
        },

        /**
         * Get the last name of an person.
         *
         * @param {object} d D3 data object
         *
         * @return {string}
         */
        getLastName: function (d) {
            return d.data.name.substr(d.data.name.lastIndexOf(' ') + 1);
        },

        /**
         * Get the time span label of an person. Returns null if label
         * should not be displayed due empty data.
         *
         * @param {object} d D3 data object
         *
         * @return {string}
         */
        getTimeSpan: function (d) {
            if (d.data.born || d.data.died) {
                return d.data.born + '-' + d.data.died;
            }

            return null;
        },

        /**
         * Get the scaled font size.
         *
         * @param {object} d D3 data object
         *
         * @return {string}
         */
        getFontSize: function (d) {
            var fontSize = this.options.fontSize;

            if (d.depth >= (this.options.nameSwitchThreshold + 1)) {
                fontSize += 1;
            }

            return ((fontSize - d.depth) * this.options.fontScale / 100) + 'px';
        },

        /**
         * Check for the 360 degree chart if the current arc labels
         * should be flipped for easier reading.
         *
         * @param {object} d D3 data object
         *
         * @return {boolean}
         */
        isPositionFlipped: function (d) {
            if ((this.options.fanDegree !== 360) || (d.depth <= 1)) {
                return false;
            }

            var sAngle = this.startAngle(d);
            var eAngle = this.endAngle(d);

            // Flip names for better readability depending on position in chart
            return ((sAngle >= (90 * Math.PI / 180)) && (eAngle <= (180 * Math.PI / 180)))
                || ((sAngle >= (-180 * Math.PI / 180)) && (eAngle <= (-90 * Math.PI / 180)));
        },

        /**
         * Append a path element to the given parent group element.
         *
         * @param {object} parent   Parent container element, D3 group element
         * @param {int}    index    Index position of element in parent container. Required to create a unique path id.
         */
        appendArcPath: function (parent, index) {
            var that = this;

            // Create arc generator for path segments
            var arcGenerator = d3.arc()
                .startAngle(function (d) {
                    return that.isPositionFlipped(d)
                        ? that.endAngle(d)
                        : that.startAngle(d);
                })
                .endAngle(function (d) {
                    return that.isPositionFlipped(d)
                        ? that.startAngle(d)
                        : that.endAngle(d);
                })
                .innerRadius(function (d) {
                    return that.relativeRadius(d, that.getTextOffset(index, d));
                })
                .outerRadius(function (d) {
                    return that.relativeRadius(d, that.getTextOffset(index, d));
                });

            // Append a path so we could use it to write the label along it
            parent.append('path')
                .attr('d', arcGenerator)
                .attr('id', function (d) {
                    return 'label-' + d.data.id + '-' + index;
                });
        },

        /**
         * Append textPath element with label along the referenced path.
         *
         * @param {object} parent        Parent container element, D3 text element
         * @param {int}    index         Index position of element in parent container
         * @param {string} label         Label to display
         * @param {string} textPathClass Optional class to set to the D3 textPath element
         */
        appendInnerArcTextPath: function (parent, index, label, textPathClass) {
            parent.append('textPath')
                .attr('class', textPathClass || null)
                .attr('startOffset', '25%')
                .attr('xlink:href', function (d) {
                    return '#label-' + d.data.id + '-' + index;
                })
                .text(label)
                .each(this.truncate(index));
        },

        /**
         * Append text element to the given group element.
         *
         * @param {object} group     D3 group (g) object
         * @param {string} label     Label to display
         * @param {string} textClass Optional class to set to the D3 text element
         *
         * @return {object} D3 text object
         */
        appendOuterArcText: function (group, label, textClass) {
            var that = this;

            group.append('text')
                .attr('class', textClass || null)
                .attr('dominant-baseline', 'middle')
                .style('font-size', function (d) {
                    return that.getFontSize(d);
                })
                .text(label)
                .each(this.truncate(5));
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
                        offset = -0.025;
                    }

                    if (countElements === 2) {
                        offset = 0.5;
                    }

                    if (countElements === 3) {
                        offset = 1.25;
                    }

                    var mapIndexToOffset = d3.scaleLinear()
                        .domain([0, countElements - 1])
                        .range([-offset, offset]);

                    // Slight increase in the y axis' value so the texts may not overlay
                    var offsetRotate = (i <= 1 ? 1.25 : 1.75);

                    if (d.depth === 0) {
                        offsetRotate = 1.00;
                    }

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
                            var dx     = d.x1 - d.x0;
                            var angle  = that.options.x(d.x0 + (dx / 2)) * 180 / Math.PI;
                            var rotate = angle - (mapIndexToOffset(i) * offsetRotate * (angle > 0 ? -1 : 1)) - 90;

                            return 'rotate(' + rotate + ') '
                                + 'translate(' + that.centerRadius(d) + ') '
                                + 'rotate(' + (angle > 0 ? 0 : 180) + ')';
                        });
                    }
                });
            });
        }
    });
}(jQuery));
