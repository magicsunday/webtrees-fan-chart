/** global: window */
/** global: console */
/** global: Math */
/** global: d3 */
/** global: jQuery */
/** global: $ */

(function ($) {
    'use strict';

    $.widget('rso.ancestralFanChart', {
        options: {
            nameSwitchTreshold: 5,

            // 2 = full circle, 3 = fan, 4 = half circle
            fanStyle: 2,

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
         * @returns void
         * @constructs ancestralFanChart
         */
        _create: function () {
            // Check dependencies
            this.checkDependencies();

            this.options.startPi = -Math.PI * 2 / this.options.fanStyle;
            this.options.endPi = Math.PI * 2 / this.options.fanStyle;

            if (this.options.width > $(window).width() - 25) {
                this.options.width = $(window).width() - 25;
            }

            this.options.radius = this.options.width >> 1;
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
         * @return void
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
         * @return void
         * @private
         */
        initChart: function (data) {
            this.config.visual = d3
                .select('#fan-chart')
                .append('svg:svg')
                .attr('width', this.options.width) // + (padding << 1))
                .attr('height', this.options.height) //+ (padding << 1))
                .attr('text-rendering', 'geometricPrecision')
                .attr('text-anchor', 'middle')

                .append('g')
                .attr('class', 'group');

            this.config.nodes = d3.layout.partition()
                .sort(null)
                .value(function (d) {
                    return d.depth;
                })
                .nodes(data);
        },

        placeArcs: function () {
            this.drawBorderCenterCircle();
            this.drawBorderArcs();
            this.setArcLabels();
            this.setLabels();
        },

        /**
         *
         */
        startAngle: function (d) {
            return Math.max(this.options.startPi, Math.min(2 * this.options.endPi, this.options.x(d.x)));
        },

        /**
         *
         */
        endAngle: function (d) {
            return Math.max(this.options.startPi, Math.min(2 * this.options.endPi, this.options.x(d.x + d.dx)));
        },

        /**
         *
         */
        innerRadius: function (d) {
            return [0, 65, 130, 195, 260, 325, 440, 555, 670][d.depth];
        },

        /**
         *
         */
        outerRadius: function (d) {
            return [65, 130, 195, 260, 325, 440, 555, 670, 775][d.depth];
        },

        /**
         *
         * @param d
         * @returns {Number}
         */
        centerRadius: function (d) {
            return (this.innerRadius(d) + this.outerRadius(d)) >> 1;
        },

        /**
         * Draws the center circle of the fan chart.
         *
         * @return void
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

            var borderArcs = this.config
                .visual
                .append('g')
                .attr('class', 'border-arcs')
                .selectAll('g.border-arc')
                .data(
                    this.config.nodes.filter(function (d) {
                        return d.depth === 0;
                    })
                )
                .enter()
                .append('g')
                .attr('class', 'border-arc');

            this.drawBorders(borderArcs, arcGenerator);
        },

        /**
         * Draws the borders of the single arcs.
         *
         * @return void
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
                .append('g')
                .attr('class', 'border-arcs')
                .selectAll('g.border-arc')
                .data(
                    this.config.nodes.filter(function (d) {
                        return d.depth > 0;
                    })
                )
                .enter()
                .append('g')
                .attr('class', 'border-arc');

            // Add title element containing the full name of the individual
            borderArcs.append('title')
                .text(function (d) {
                    return d.name;
                });

            this.drawBorders(borderArcs, arcGenerator);
        },

        /**
         * Draws the borders using the given arc generator.
         *
         * @param borderArcs   Elements selected
         * @param arcGenerator Arc generator
         *
         * @return void
         */
        drawBorders : function (borderArcs, arcGenerator) {
            borderArcs.append('path')
                .attr('fill', function (d) {
                    return d.color;
                })
                .attr('d', arcGenerator)
                .style('stroke', '#ebebeb')
                .style('stroke-width', 3);
        },

        /**
         *
         */
        getFirstNames: function (d) {
            return d.name.substr(0, d.name.lastIndexOf(' '));
        },

        /**
         *
         */
        getLastName: function (d) {
            return d.name.substr(d.name.lastIndexOf(' ') + 1);
        },

        /**
         *
         */
        setArcLabels: function () {
            var that = this;

            var entry = this.config.visual
                .append('g')
                .attr('class', 'labels')
                .selectAll('g.arc-labels')
                .data(
                    this.config.nodes.filter(function (d) {
                        return d.depth > 0 && d.depth < that.options.nameSwitchTreshold;
                    })
                )
                .enter()
                .append('g')
                .attr('class', 'arc-labels');

            // Add title element containing the full name of the individual
            entry.append('title')
                .text(function (d) {
                    return d.name;
                });

            var labelArc = d3.svg.arc()
                .startAngle(function (d) {
                    var sAngle = that.startAngle(d);

                    if ((that.options.fanStyle !== 2) || (d.depth <= 1)) {
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

                    if ((that.options.fanStyle !== 2) || (d.depth <= 1)) {
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
                    return that.centerRadius(d);
                })
                .outerRadius(function (d) {
                    return that.centerRadius(d);
                });

            entry.append('path')
                .attr('d', labelArc)
                .attr('id', function (ignore, i) {
                    return 'arc-label-' + i;
                });

            var label = entry.append('text')
                .attr('dominant-baseline', 'middle')
                .style('font-size', function (d) {
                    return '' + (14 - d.depth) + 'px';
                });

            // First names
            var textPath1 = label.append('textPath');

            textPath1.attr('startOffset', '25%')
                .attr('xlink:href', function (ignore, i) {
                    return '#arc-label-' + i;
                })
                .style('fill', '#000');

            textPath1.append('tspan')
                .attr('dy', '-1.1em')
                .text(function (d) {
                    return that.getFirstNames(d);
                })
                .each(that.truncate(5));

            // Last name
            var textPath2 = label.append('textPath');

            textPath2.attr('startOffset', '25%')
                .attr('xlink:href', function (ignore, i) {
                    return '#arc-label-' + i;
                })
                .style('fill', '#000');

            textPath2.append('tspan')
                .attr('dy', '0em')
                .text(function (d) {
                    return that.getLastName(d);
                })
                .each(that.truncate(5));


            // Date
            var textPath3 = label.append('textPath');

            textPath3.attr('startOffset', '25%')
                .attr('xlink:href', function (ignore, i) {
                    return '#arc-label-' + i;
                })
                .style('fill', '#7f7f7f');

            textPath3.append('tspan')
                .attr('dy', '1.6em')
                .style('font-size', function (d) {
                    return '' + (13 - d.depth) + 'px';
                })

                .style('font-weight', 'normal')
                .text(function (d) {
                    if (d.born || d.died) {
                        return d.born + '-' + d.died;
                    }

                    // Remove empty element
                    return this.remove();
                });
        },

        /**
         *
         * @param text
         *
         * @returns
         */
        getText: function (text) {
            var that = this;
            var textEnter = text
                .append('text')
                .attr('dominant-baseline', 'middle')
                .style('font-size', function (d) {
                    if (d.depth >= (that.options.nameSwitchTreshold + 1)) {
                        return '8px';
                    }

                    return '' + (13 - d.depth) + 'px';
                });

            return textEnter;
        },

        /**
         *
         * @param group
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

                    var text = d3.select(this);

                    var offsetRotate = i === 0 ? 1.1 : (i === 1 ? 1.1 : 1.6);

                    if (d.depth === 8) {
                        offsetRotate = 0.5;
                    }

                    // Name of center person should not be rotated in any way
                    if (d.depth === 0) {
                        text.attr('dy', (mapIndexToOffset(i) * offsetRotate) + 'em');
                    }

                    if (d.depth > 0) {
                        text.attr('transform', function (d) {
                            var multangle = d.depth === 1 ? 90 : 180,
                                angle = that.options.x(d.x + d.dx / 2) * multangle / Math.PI - 90,
                                rotate = angle - (mapIndexToOffset(i) * offsetRotate * (angle > -90 ? -1 : 1));

                            var transX = (that.innerRadius(d) + that.outerRadius(d)) / 2;

                            return 'rotate(' + rotate + ')'
                                + 'translate(' + transX + ')'
                                + 'rotate(' + (angle > -90 ? 0 : -180) + ')';
                        });
                    }
                });
            });
        },

        /**
         * Truncate the text of the current element.
         *
         * @param {int} padding Left/Right padding of text
         *
         * @returns {string} Truncated text
         */
        truncate : function (padding) {
            var that = this;

            return function (d) {
                // Modifier of available width depending on fan style
                var widthMod = 2.0 / that.options.fanStyle;

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

                var self       = d3.select(this),
                    textLength = self.node().getComputedTextLength(),
                    text       = self.text();

                while ((textLength > (availableWidth - (padding << 1))) && (text.length > 0)) {
                    // Remove last char
                    text = text.slice(0, -1);

                    // Recalculate the text width
                    textLength = self
                        .text(text + '...')
                        .node()
                        .getComputedTextLength();
                }
            }
        },

        /**
         *
         */
        setLabels: function () {
            var that = this;
            var text = this.config.visual
                .append('g')
                .attr('class', 'labels')
                .selectAll('g.simple-labels')
                .data(
                    that.config.nodes.filter(function (d) {
                        return d.depth < 1 || d.depth >= that.options.nameSwitchTreshold;
                    })
                )
                .enter()
                .append('g')
                .attr('class', 'simple-labels');

            // Add title element containing the full name of the individual
            text.append('title')
                .text(function (d) {
                    return d.name;
                });

            var textEnter1 = this.getText(text);
            var textEnter2 = this.getText(text);
            var textEnter3 = this.getText(text);

            textEnter1
                .text(function(d) {
                    return that.getFirstNames(d);
                })
                .each(that.truncate(5));

            textEnter2
                .text(function (d) {
                    return that.getLastName(d);
                })
                .each(that.truncate(5));

            textEnter3
                .style('font-size', function (d) {
                    return '' + (13 - d.depth) + 'px';
                })
                .style('font-weight', 'normal')
                .style('fill', '#7f7f7f')
                .text(function (d) {
                    // Remove empty element
                    if (d.depth >= 6) {
                        return this.remove();
                    }

                    if (d.born || d.died) {
                        return d.born + '-' + d.died;
                    }

                    // Remove empty element
                    return this.remove();
                });

            this.transformText(text);
        }
    });
}(jQuery));
