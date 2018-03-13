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
            generations: 6,

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
            padding: 10,

            // Left/Right padding of text
            textPadding: 2,

            // Relative position offsets in percent (0 = inner radius, 100 = outer radius)
            positions: [70, 52, 25],

            // Whether to hide empty segments of chart or not
            hideEmptySegments: false,

            // Duration of update animation if clicked on a person
            updateDuration: 1250,

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

            // Helper method to create a ongoing id
            this.options.id = (function () { var i = 1; return function () { return i++; }})();

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
                xref: '',
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
                .scaleExtent([0.5, 5.0])
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
                .attr('version', '1.1')
                .attr('xmlns', 'http://www.w3.org/2000/svg')
                .attr('xmlns:xlink', 'http://www.w3.org/1999/xlink')
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
                        });
                    }
                }, this))
                .on('touchend', $.proxy(function () {
                    if (d3.event.touches.length < 2) {
                        that.hideTooltipOverlay(0, 800);
                    }
                }, this))
                .on('touchmove', $.proxy(function () {
                    if (d3.event.touches.length >= 2) {
                        // Hide tooltip on more than 2 fingers
                        that.hideTooltipOverlay();
                    } else {
                        // Show tooltip if less than 2 fingers are used
                        that.showTooltipOverlay(this.options.labels.move);
                    }
                }, this))
                .on('click', $.proxy(this.doStopPropagation, this), true);

            // Filter stuff
            var defs = this.config.svg
                .append('defs');

            // Append filter element
            var filter = defs.append('filter')
                .attr('id', 'dropshadow');

            // Append gaussian blur to filter
            filter.append('feGaussianBlur')
                .attr('in', 'SourceAlpha')
                .attr('stdDeviation', 3);

            // Append offset filter to result of gaussion blur filter
            filter.append('feOffset')
                .attr('dx', 3)
                .attr('dy', 1);

            // Merge result with original image
            var feMerge = filter.append('feMerge');

            // First layer result of blur and offset
            feMerge.append('feMergeNode');

            // Original image on top
            feMerge.append('feMergeNode')
                .attr('in', 'SourceGraphic');
            // End filter stuff

            // Add an overlay with tooltip
            this.config.overlay = this.config.parent
                .append('div')
                .attr('class', 'overlay')
                .style('opacity', 0);

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
                .append('g');

            this.config.visual
                .append('g')
                .attr('class', 'personGroup')
                .attr('filter', 'url(#dropshadow)');

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
                });
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
                .style('opacity', 0);
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
         * Update/Calculate the viewBox attribute of the SVG element.
         */
        updateViewBox: function () {
            // Get bounding boxes
            var svgBoundingBox    = this.config.visual.node().getBBox();
            var clientBoundingBox = this.config.parent.node().getBoundingClientRect();

            // View box should have at least the same width/height as the parent element
            var viewBoxWidth  = Math.max(clientBoundingBox.width, svgBoundingBox.width);
            var viewBoxHeight = Math.max(clientBoundingBox.height, svgBoundingBox.height, this.options.minHeight);

            // Calculate offset to center chart inside svg
            var offsetX = (viewBoxWidth - svgBoundingBox.width) / 2;
            var offsetY = (viewBoxHeight - svgBoundingBox.height) / 2;

            // Adjust view box dimensions by padding and offset
            var viewBoxLeft = Math.ceil(svgBoundingBox.x - offsetX - this.options.padding);
            var viewBoxTop  = Math.ceil(svgBoundingBox.y - offsetY - this.options.padding);

            // Final width/height of view box
            viewBoxWidth  = Math.ceil(viewBoxWidth + (this.options.padding * 2));
            viewBoxHeight = Math.ceil(viewBoxHeight + (this.options.padding * 2));

            // Set view box attribute
            this.config.svg
                .attr('viewBox', [
                    viewBoxLeft,
                    viewBoxTop,
                    viewBoxWidth,
                    viewBoxHeight
                ]);

            // Adjust rectangle position
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
         * Add title element to the person element containing the full name of the individual.
         *
         * @param {object} person Parent element used to append the title too
         * @param {object} d      D3 data object
         *
         * @return {void}
         */
        addTitleToPerson: function (person, d) {
            person
                .insert('title', ':first-child')
                .text(function () {
                    // Return name or remove empty title element
                    return (d.data.xref !== '') ? d.data.name : this.remove();
                });
        },

        /**
         * Append arc element to the person element.
         *
         * @param {object} person Parent element used to append the arc too
         * @param {object} d      D3 data object
         *
         * @param {void}
         */
        addArcToPerson: function (person, d) {
            var that = this;

            // Arc generator
            var arcGen = d3.arc()
                .startAngle(function () {
                    return (d.depth === 0) ? 0 : that.startAngle(d);
                })
                .endAngle(function () {
                    return (d.depth === 0) ? (Math.PI * 2) : that.endAngle(d);
                })
                .innerRadius(that.innerRadius(d))
                .outerRadius(that.outerRadius(d));

            // Append arc
            var arcGroup = person.append('g')
                .attr('class', 'arc');

            var path = arcGroup
                .append('path')
                .style('fill', function () {
                    return 'rgb(245, 245, 245)';
                })
                .style('stroke-width', function () {
                    return '2px';
                    return (d.depth >= 9) ? '1px' : '5px';
                })
                .style('stroke', function () {
                    return 'rgb(225, 225, 225)';
                })
                .attr('d', arcGen);

//console.log(that.startAngle(d) * 180 / Math.PI * 2);

//            var dg = that.startAngle(d) * 180 / Math.PI * 2;

//            if (dg === 210.0 || dg === -210.0) {
//                path
//                    .style('stroke-dasharray', function () {
//                        return '0, ' + ((that.endAngle(d) - that.startAngle(d)) * that.outerRadius(d)) + ', ' + (that.outerRadius(d) - that.innerRadius(d)) + ', 1000'
//                    });
//            }
        },

        /**
         * Append labels (initial hidden).
         *
         * @param {object} parent Parent element used to append the label element too
         *
         * @param {object} Newly added label element
         */
        addLabelToPerson: function (parent) {
            return parent
                .append('g')
                .attr('class', 'label')
                .style('fill', this.options.fontColor);
        },

        /**
         * Add "text" element to given parent element.
         *
         * @param {object} parent Parent element used to append the "text" element
         *
         * @param {object} Newly added label element
         */
        appendTextToLabel: function (parent, d) {
            return parent
                .append('text')
                .attr('dominant-baseline', 'middle')
                .style('font-size', this.getFontSize(d));
        },

        /**
         * Append "textPath" element.
         *
         * @param {object} parent Parent element used to append the "textPath" element
         * @param {string} refId  Id of reference element
         *
         * @return {object} D3 textPath object
         */
        appendTextPath: function (parent, refId) {
            return parent.append('textPath')
                .attr('xlink:href', function () {
                    return '#' + refId;
                })
                .attr('startOffset', '25%');
        },

        /**
         * Append the arc paths to the label element.
         *
         * @param {object} label Label element used to append the arc path
         * @param {object} d     D3 data object
         *
         * @param {void}
         */
        addArcPathToLabel: function (label, d) {
            var that = this;

            // Inner labels
            if (this.isInnerLabel(d)) {
                var text     = this.appendTextToLabel(label, d);
                var timeSpan = this.getTimeSpan(d);

                // Create a path for each line of text as mobile devices
                // won't display <tspan> elements in the right position
                var path1 = this.appendPathToLabel(label, 0, d);
                var path2 = this.appendPathToLabel(label, 1, d);

                this.appendTextPath(text, path1.attr('id'))
                    .text(this.getFirstNames(d))
                    .each(this.truncate(d, 0));

                this.appendTextPath(text, path2.attr('id'))
                    .text(this.getLastName(d))
                    .each(this.truncate(d, 1));

                if (timeSpan) {
                    var path3 = this.appendPathToLabel(label, 2, d);

                    this.appendTextPath(text, path3.attr('id'))
                        .attr('class', 'chart-date')
                        .text(timeSpan)
                        .each(this.truncate(d, 2));
                }

            // Outer labels
            } else {
                var name     = d.data.name;
                var timeSpan = that.getTimeSpan(d);

                // Return first name for inner circles
                if (d.depth < 7) {
                    name = that.getFirstNames(d);
                }

                // Create the text elements for first name, last name and
                // the birth/death dates
                that.appendOuterArcText(d, label, name);

                // The outer most circles show the name and do not distinguish between first name, last name and dates
                if (d.depth < 7) {
                    // Add last name
                    that.appendOuterArcText(d, label, that.getLastName(d));

                    // Add dates
                    if ((d.depth < 6) && timeSpan) {
                        that.appendOuterArcText(d, label, timeSpan, 'chart-date');
                    }
                }

                // Rotate outer labels in right position
                that.transformOuterText(label, d);
            }
        },

        addPersonData: function (person, d) {
            if (!this.options.hideEmptySegments || (d.data.xref !== '')) {
                this.addArcToPerson(person, d);
            }

            if (d.data.xref !== '') {
                this.addTitleToPerson(person, d);

                // Append labels (initial hidden)
                var label = this.addLabelToPerson(person);

                this.addArcPathToLabel(label, d);
            }

            // Hovering
            person
                .on('mouseover', function () {
                    d3.select(this).classed('hover', true);
                })
                .on('mouseout', function () {
                    d3.select(this).classed('hover', false);
                });
        },

        /**
         * Adds an color overlay for each arc.
         *
         * @return {object} Color group object
         */
        addColorGroup: function () {
            var that = this;

            // Arc generator
            var arcGen = d3.arc()
                .startAngle(function (d) {
                    return (d.depth === 0) ? 0 : that.startAngle(d);
                })
                .endAngle(function (d) {
                    return (d.depth === 0) ? (Math.PI * 2) : that.endAngle(d);
                })
                .innerRadius(function (d) {
                    return that.outerRadius(d) - 3;
                })
                .outerRadius(function (d) {
                    return that.outerRadius(d) + 2;
                });

            var colorGroup = this.config.svg
                .select('g')
                .append('g')
                .attr('class', 'colorGroup')
                .style('opacity', 0);

            colorGroup
                .selectAll('g.colorGroup')
                .data(this.config.nodes)
                .enter()
                .filter(function (d) {
                    return (d.data.xref !== '');
                })
                .append('path')
                .style('fill', function (d) {
                    return d.data.color;
                })
                .attr('d', arcGen);

            return colorGroup;
        },

        /**
         * Create the arc elements for each individual in the data list.
         *
         * @return {void}
         */
        createArcElements: function () {
            var that        = this;
            var personGroup = this.config.svg.select('g.personGroup');

            personGroup.selectAll('g.person')
                .data(this.config.nodes)
                .enter()
                .each(function (entry) {
                    var person = personGroup
                        .append('g')
                        .attr('class', 'person')
                        .attr('id', 'person-' + that.options.id())
                        .on('click', null);

                    that.addPersonData(person, entry);
                });

            this.bindClickEventListener();
            this.addColorGroup()
                .style('opacity', 1);
        },

        /**
         * This method bind the "click" event listeners to a "person" element.
         */
        bindClickEventListener: function () {
            var personGroup = this.config.svg
                .select('g.personGroup')
                .selectAll('g.person')
                .data(this.config.nodes)
                .filter(function (d) {
                    return (d.data.xref !== '');
                })
                .classed('available', true);

            // Trigger method on click
            personGroup
                .on('click', $.proxy(this.personClick, this));
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
         * Method triggers either the "update" or "individual" method on the click on an person.
         *
         * @param {object} d D3 data object
         */
        personClick: function (d) {
            // Trigger either "update" or "individual" method on click depending on person in chart
            (d.depth === 0) ? this.individual(d) : this.update(d);
        },

        /**
         * Helper method to execute callback method after all transitions are done
         * of a selection.
         *
         * @param {object}   transition D3 transition object
         * @param {function} callback   Callback method
         */
        endall: function (transition, callback) {
            var n = 0;

            transition
                .on('start', function() { ++n; })
                .on('end', function() {
                    if (!--n) {
                        callback.apply(transition);
                    }
                });
        },

        /**
         * Update the chart with data loaded from AJAX.
         *
         * @param {object} d D3 data object
         */
        update: function (d) {
            var that = this;

            that.config.svg
                .selectAll('g.person')
                .on('click', null);

            d3.json(
                this.options.updateUrl + d.data.xref,
                function (data) {
                    // Initialize the new loaded data
                    that.initData(data);

                    // Clone all elements (only the container)
                    that.config.svg
                        .selectAll('g.person')
                        .clone()
                        .classed('new', true)
                        .style('opacity', 0);

                    // Flag all old elements which are subject to change
                    that.config.svg
                        .selectAll('g.person:not(.new)')
                        .data(that.config.nodes)
                        .each(function (entry) {
                            var person = d3.select(this);

                            person.classed(
                                'changed',
                                person.classed('available') | (entry.data.xref !== '')
                            );
                        });

                    // Flag all new elements which are subject to change
                    that.config.svg
                        .selectAll('g.person.new')
                        .data(that.config.nodes)
                        .each(function (entry) {
                            var person = d3.select(this);

                            person.classed(
                                'changed',
                                person.classed('available') | (entry.data.xref !== '')
                            );

                            person.classed(
                                'available',
                                (entry.data.xref !== '')
                            );

                            that.addPersonData(person, entry);
                        });

                    // Remove all cloned but not changed elements
                    that.config.svg
                        .selectAll('g.person.new:not(.changed)')
                        .remove();

                    that.addColorGroup()
                        .classed('new', true);

                    // Fade out all old elements which will change
                    that.config.svg
                        .selectAll('g.person:not(.new).changed, g.colorGroup:not(.new)')
                        .transition()
                        .duration(that.options.updateDuration)
                        .style('opacity', 0)
                        .call(that.endall, function () {
                            that.config.svg
                                .selectAll('g.person:not(.new).changed, g.colorGroup:not(.new)')
                                .remove();
                        });

                    // Fade in all new changed elements
                    that.config.svg
                        .selectAll('g.person.new.changed, g.colorGroup.new')
                        .transition()
                        .duration(that.options.updateDuration)
                        .style('opacity', 1)
                        .call(that.endall, function () {
                            that.config.svg
                                .selectAll('g.person.new.changed, g.colorGroup.new')
                                .classed('new', false)
                                .classed('changed', false)
                                .attr('style', null);

                            // Add click handler after all transitions are done
                            that.bindClickEventListener();
                        });
                }
            );
        },

        /**
         * Redirect the current page the the individual page.
         *
         * @param {object} d D3 data object
         */
        individual: function (d) {
            window.location = this.options.individualUrl + d.data.xref;
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
         * @param {object} d     D3 data object
         * @param {int}    index Index position of element in parent container.
         *
         * @returns {string} Truncated text
         */
        truncate: function (d, index) {
            var that           = this;
            var availableWidth = this.getAvailableWidth(d, index);

            return function () {
                // Depending on the depth of an entry in the chart the available width differs
                var self       = d3.select(this);
                var textLength = self.node().getComputedTextLength();
                var text       = self.text();

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
         * Calculate the available text width. Depending on the depth of an entry in
         * the chart the available width differs.
         *
         * @param {object} d     D3 data object
         * @param {int}    index Index position of element in parent container.
         *
         * @returns {int} Calculated available width
         */
        getAvailableWidth: function (d, index) {
            // Calc length of the arc
            if (d.depth >= 1 && d.depth < 5) {
                return this.arcLength(d, this.getTextOffset(index || 1, d));
            }

            // Depending on the depth of an entry in the chart the available width differs
            return 110;
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
         * @param {object} label Parent container element, D3 group element
         * @param {int}    index Index position of element in parent container. Required to create a unique path id.
         * @param {object} d     D3 data object
         *
         * @return {object} D3 path object
         */
        appendPathToLabel: function (label, index, d) {
            var that     = this;
            var personId = d3.select(label.node().parentNode).attr('id');

            // Create arc generator for path segments
            var arcGenerator = d3.arc()
                .startAngle(function () {
                    return that.isPositionFlipped(d)
                        ? that.endAngle(d)
                        : that.startAngle(d);
                })
                .endAngle(function () {
                    return that.isPositionFlipped(d)
                        ? that.startAngle(d)
                        : that.endAngle(d);
                })
                .innerRadius(function () {
                    return that.relativeRadius(d, that.getTextOffset(index, d));
                })
                .outerRadius(function () {
                    return that.relativeRadius(d, that.getTextOffset(index, d));
                });

            // Append a path so we could use it to write the label along it
            return label.append('path')
                .attr('id', personId + '-' + index)
                .attr('d', arcGenerator);
        },

        /**
         * Append "textPath" element.
         *
         * @param {object} parent  Parent element used to append the "textPath" element
         * @param {string} refId  Id of reference element
         * @param {string} text   Text to display
         *
         * @return {object} D3 textPath object
         */
        appendTextPathToText: function (parent, refId, text) {
            return parent.append('textPath')
                .attr('xlink:href', function () {
                    return '#' + refId;
                })
                .attr('startOffset', '25%')
                .text(text);
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
        appendOuterArcText: function (d, group, label, textClass) {
            var that = this;

            group.append('text')
                .attr('class', textClass || null)
                .attr('dominant-baseline', 'middle')
                .style('font-size', function () {
                    return that.getFontSize(d);
                })
                .text(label)
                .each(this.truncate(d));
        },

        /**
         * Transform the D3 text elements in the group. Rotate each text element
         * depending on its offset, so that they are equally positioned inside
         * the arc.
         *
         * @param {object} label D3 label group object
         * @param {object} d     D3 data object
         *
         * @return {void}
         */
        transformOuterText: function (label, d) {
            var that          = this;
            var textElements  = label.selectAll('text');
            var countElements = textElements.size();

            textElements.each(function (ignore, i) {
                var offsets = [0, -0.025, 0.5, 1.15];
                var offset  = offsets[countElements];

                var mapIndexToOffset = d3.scaleLinear()
                    .domain([0, countElements - 1])
                    .range([-offset, offset]);

                // Slight increase in the y axis' value so the texts may not overlay
                var offsetRotate = (i <= 1 ? 1.25 : 1.75);

                if (d.depth === 0) {
                    offsetRotate = 1.0;
                }

                if (d.depth === 6) {
                    offsetRotate = 1.0;
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
                    text.attr('transform', function () {
                        var dx     = d.x1 - d.x0;
                        var angle  = that.options.x(d.x0 + (dx / 2)) * 180 / Math.PI;
                        var rotate = angle - (mapIndexToOffset(i) * offsetRotate * (angle > 0 ? -1 : 1)) - 90;

                        return 'rotate(' + rotate + ') '
                            + 'translate(' + that.centerRadius(d) + ') '
                            + 'rotate(' + (angle > 0 ? 0 : 180) + ')';
                    });
                }
            });
        }
    });
}(jQuery));
