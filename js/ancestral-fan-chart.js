
var nameSwitchTreshold = 5;
var baseMod = 2; // 2 = full circle, 3 = fan, 4 = half circle

var startPi = -Math.PI * 2 / baseMod;
var endPi   =  Math.PI * 2 / baseMod;

var width = 800;
if (width > $(window).width() - 25) {
    width = $(window).width() - 25;
}
var height   = width,
    radius   = width >> 1,
    x        = d3.scale.linear().range([startPi, endPi]),
    padding  = 5,
    duration = 1000;

var div = d3.select('#fan-chart');

var svg = div.append('svg')
    .attr('width', width + (padding << 1))
    .attr('height', height + (padding << 1))
    .attr('text-rendering', 'geometricPrecision')
    .attr('text-anchor', 'middle')
    .append('g')
    .attr('class', 'group');


function getMinWidth()
{
    return 375 * 2;
}

/**
 *
 */
var startAngle = function(d)
{
    return Math.max(startPi, Math.min(2 * endPi, x(d.x)));
};

/**
 *
 */
var endAngle = function(d)
{
    return Math.max(startPi, Math.min(2 * endPi, x(d.x + d.dx)));
};

/**
 *
 */
var innerRadius = function(d)
{
    return [0, 65, 130, 195, 260, 325, 440, 555, 670][d.depth];
};

/**
 *
 */
var outerRadius = function(d)
{
    return [65, 130, 195, 260, 325, 440, 555, 670, 775][d.depth];
};

/**
 *
 * @param d
 * @returns {Number}
 */
function centerRadius(d)
{
    return (innerRadius(d) + outerRadius(d)) >> 1;
}


var partition = d3.layout.partition()
    .sort(null)
    .value(function(d) {
        return d.depth;
    });

var arc = d3.svg.arc()
    .startAngle(startAngle)
    .endAngle(endAngle)
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

var nodes = partition.nodes(chartData);


drawBorderCenterCircle();
drawBorderArcs()
setArcLabels();
setLabels();


/**
 * Draws the center circle of the fan chart.
 *
 * @return void
 */
function drawBorderCenterCircle()
{
    var arcGenerator = d3.svg.arc()
        .startAngle(0)
        .endAngle(Math.PI * 2)
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

    var borderArcs = svg
        .append('g')
        .attr('class', 'border-arcs')
        .selectAll('g.border-arc')
        .data(
            nodes.filter(function(d) {
                return d.depth === 0;
            })
        )
        .enter()
        .append('g')
        .attr('class', 'border-arc');

    drawBorders(borderArcs, arcGenerator);
}

/**
 * Draws the borders of the single arcs.
 *
 * @return void
 */
function drawBorderArcs()
{
    var arcGenerator = d3.svg.arc()
        .startAngle(startAngle)
        .endAngle(endAngle)
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

    var borderArcs = svg
        .append('g')
        .attr('class', 'border-arcs')
        .selectAll('g.border-arc')
        .data(
            nodes.filter(function(d) {
                return d.depth > 0;
            })
        )
        .enter()
        .append('g')
        .attr('class', 'border-arc');

    // Add title element containing the full name of the individual
    borderArcs.append('title')
        .text(function(d, i) {
            return d.name;
        });

    drawBorders(borderArcs, arcGenerator);
}

/**
 * Draws the borders using the given arc generator.
 *
 * @param borderArcs   Elements selected
 * @param arcGenerator Arc generator
 *
 * @return void
 */
function drawBorders(borderArcs, arcGenerator)
{
    borderArcs.append('path')
        .attr('fill', function(d) { return d.color; })
        .attr('d', arcGenerator)
        .style('stroke', '#ebebeb')
        .style('stroke-width', 3);
}

function getFirstNames(d)
{
    var name = d.name.substr(0, d.name.lastIndexOf(' '));

    if ((d.generation <= 5) && (name.length > 14)) {
        return name.substr(0, 14) + '...';
    }

    if (name.length > 18) {
        return name.substr(0, 18) + '...';
    }

    return name;
}

function getLastName(d)
{
    return d.name.substr(d.name.lastIndexOf(' ') + 1);
}

/**
 *
 */
function setArcLabels()
{
    var entry = svg
        .append('g')
        .attr('class', 'labels')
        .selectAll('g.arc-labels')
        .data(
            nodes.filter(function(d) {
                return d.depth > 0 && d.depth < nameSwitchTreshold;
            })
        )
        .enter()
        .append('g')
        .attr('class', 'arc-labels');

    // Add title element containing the full name of the individual
    entry.append('title')
        .text(function(d, i) {
            return d.name;
        });

    var labelArc = d3.svg.arc()
        .startAngle(function(d) {
            var sAngle = startAngle(d);

            if ((baseMod !== 2) || (d.generation <= 2)) {
                return sAngle;
            }

            var eAngle = endAngle(d);

            // Flip names for better readability depending on position in chart
            if (((sAngle >= (90 * Math.PI / 180)) && (eAngle <= (180 * Math.PI / 180)))
                || ((sAngle >= (-180 * Math.PI / 180)) && (eAngle <= (-90 * Math.PI / 180)))
            ) {
                return eAngle;
            }

            return sAngle;
        })
        .endAngle(function(d) {
            var eAngle = endAngle(d);

            if ((baseMod !== 2) || (d.generation <= 2)) {
                return eAngle;
            }

            var sAngle = startAngle(d);

            // Flip names depending on position in chart
            if (((sAngle >= (90 * Math.PI / 180)) && (eAngle <= (180 * Math.PI / 180)))
                || ((sAngle >= (-180 * Math.PI / 180)) && (eAngle <= (-90 * Math.PI / 180)))
            ) {
                return sAngle;
            }

            return eAngle;
        })
        .innerRadius(centerRadius)
        .outerRadius(centerRadius);

    entry.append('path')
        .attr('d', labelArc)
        .attr('id', function (d, i) {
            return 'arc-label-' + i;
        });

    var label = entry.append('text')
        .attr('dominant-baseline', 'middle')
        .style('font-size', function(d) {
            return '' + (14 - d.depth) + 'px';
        });

    // First names
    var textPath = label.append('textPath');

    textPath.attr('startOffset', '25%')
        .attr('xlink:href', function(d, i) {
            return '#arc-label-' + i;
        })
        .style('fill', '#000');

    textPath.append('tspan')
        .attr('dy', '-1.1em')
        .text(function(d) {
            return getFirstNames(d);
        });

    // Last name
    var textPath = label.append('textPath');

    textPath.attr('startOffset', '25%')
        .attr('xlink:href', function(d, i) {
            return '#arc-label-' + i;
        })
        .style('fill', '#000');

    textPath.append('tspan')
        .attr('dy', '0em')
        .text(function(d) {
            return getLastName(d);
        });


    // Date
    var textPath = label.append('textPath');

    textPath.attr('startOffset', '25%')
        .attr('xlink:href', function(d, i) {
            return '#arc-label-' + i;
        })
        .style('fill', '#7f7f7f');

    textPath.append('tspan')
        .attr('dy', '1.6em')
        .style('font-size', function(d) {
            return '' + (13 - d.depth) + 'px';
        })

        .style('font-weight', 'normal')
        .text(function(d) {
            if (d.born || d.died) {
                return d.born + '-' + d.died;
            }

            // Remove empty element
            return this.remove();
        });
}

/**
 *
 * @param text
 *
 * @returns
 */
function getText(text)
{
    var textEnter = text
        .append('text')
        .attr('dominant-baseline', 'middle')
        .style('font-size', function(d) {
            if (d.depth >= (nameSwitchTreshold + 1)) {
                return '8px';
            }

            return '' + (13 - d.depth) + 'px';
        });

    return textEnter;
}

/**
 *
 * @param group
 */
function transformText(group)
{
    group.each(function(d) {
        var textElements  = d3.select(this).selectAll('text');
        var countElements = textElements.size();

        textElements.each(function(d, i) {
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

            if (d.generation === 9) {
                offsetRotate = 0.5;
            }

            // Name of center person should not be rotated in any way
            if (d.depth === 0) {
                text.attr('dy', (mapIndexToOffset(i) * offsetRotate) + 'em');
            }

            if (d.depth > 0) {
                text.attr('transform', function(d) {
                    var multangle = d.depth == 1 ? 90 : 180,
                        angle = x(d.x + d.dx / 2) * multangle / Math.PI - 90,
                        rotate = angle - (mapIndexToOffset(i) * offsetRotate * (angle > -90 ? -1 : 1));

                    var transX = (innerRadius(d) + outerRadius(d)) / 2;

                    return 'rotate(' + rotate + ')translate(' + transX + ')rotate(' +
                        (angle > -90 ? 0 : -180) + ')';
                });
            }
        });
    });
}

/**
 *
 */
function setLabels()
{
    var text = svg
        .append('g')
        .attr('class', 'labels')
        .selectAll('g.simple-labels')
        .data(
            nodes.filter(function(d) {
                return d.depth < 1 || d.depth >= nameSwitchTreshold;
            })
        )
        .enter()
        .append('g')
        .attr('class', 'simple-labels');

    // Add title element containing the full name of the individual
    text.append('title')
        .text(function(d, i) {
            return d.name;
        });

    var textEnter1 = getText(text);
    var textEnter2 = getText(text);
    var textEnter3 = getText(text);

    textEnter1
        .text(function(d) {
            return getFirstNames(d);
        });

    textEnter2
        .text(function(d) {
            return getLastName(d)
        });

    textEnter3
        .style('font-size', function(d) {
            return '' + (13 - d.depth) + 'px';
        })
        .style('font-weight', 'normal')
        .style('fill', '#7f7f7f')
        .text(function(d) {
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

    transformText(text);
}


// Adjust size of svg
var bbox   = svg.node().getBBox(),
    radius = bbox.width >> 1;

d3.select(svg.node().parentNode)
    .attr('width', bbox.width + (padding << 1))
    .attr('height', bbox.height + (padding << 1))

svg.attr('transform', 'translate(' + [radius + padding, radius + padding] + ')');
