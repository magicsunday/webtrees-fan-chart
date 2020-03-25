/**
 * See LICENSE.md file for further details.
 */

import * as d3 from "./../../d3";
import Configuration from "./../../configuration";
import Geometry from "./geometry";
import Svg from "./../svg";
import Text from "./text";

/**
 * This class handles the creation of the person elements of the chart.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Person
{
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Selection}     person
     * @param {Object}        data
     */
    constructor(svg, configuration, person, data)
    {
        this._svg           = svg;
        this._configuration = configuration;
        this._geometry      = new Geometry(this._configuration);

        this.init(person, data);
    }

    /**
     * Initialize the required elements.
     *
     * @param {Selection} person
     * @param {Object}    data
     */
    init(person, data)
    {
        if (person.classed("new") && this._configuration.hideEmptySegments) {
            this.addArcToPerson(person, data);
        } else {
            if (!person.classed("new")
                && !person.classed("update")
                && !person.classed("remove")
                && ((data.data.xref !== "") || !this._configuration.hideEmptySegments)
            ) {
                this.addArcToPerson(person, data);
            }
        }

        if (data.data.xref !== "") {
            this.addTitleToPerson(person, data.data.name);

            // Append labels (initial hidden)
            let text  = new Text(this._svg, this._configuration);
            let label = this.addLabelToPerson(person, data);

            text.createLabels(label, data);
            this.addColorGroup(person, data);

            // Hovering
            person
                .on("mouseover", this.mouseover.bind(this))
                .on("mouseout", this.mouseout.bind(this));
        }
    }

    /**
     * Adds an color overlay for each arc.
     *
     * @param {Selection} person
     * @param {Object}    data   The D3 data object
     */
    addColorGroup(person, data)
    {
        // Arc generator
        let arcGenerator = d3.arc()
            .startAngle(this._geometry.startAngle(data.depth, data.x0))
            .endAngle(this._geometry.endAngle(data.depth, data.x1))
            .innerRadius(this._geometry.outerRadius(data.depth) - this._configuration.colorArcWidth)
            .outerRadius(this._geometry.outerRadius(data.depth) + 1);
        // .innerRadius((data) => this._geometry.outerRadius(data.depth) - this._configuration.colorArcWidth - 2)
        // .outerRadius((data) => this._geometry.outerRadius(data.depth) - 1);

        arcGenerator.padAngle(this._configuration.padAngle)
            .padRadius(this._configuration.padRadius)
        //     .cornerRadius(this._configuration.cornerRadius - 2)
            ;

        let color = person
            .append("g")
            .attr("class", "color");

        color.append("path")
            .attr("fill", () => {
                if (this._configuration.showColorGradients) {
                    // Innermost circle (first generation)
                    if (!data.depth) {
                        return "rgb(225, 225, 225)";
                    }

                    return "url(#grad-" + data.data.id + ")";
                }

                return data.data.color;
            })
            .attr("d", arcGenerator);
    }

    /**
     * Handles the event when a pointing device is moved onto an element.
     *
     * @param {Object} datum
     * @param {number} index
     * @param {Array}  nodes
     *
     * @private
     */
    mouseover(datum, index, nodes)
    {
        // Use raise() to move element to the top, as in SVG the last element is always the
        // one drawn on top of the others.
        d3.select(nodes[index])
            .classed("hover", true)
            .raise();
    }

    /**
     * Handles the event when a pointing device is moved off an element.
     *
     * @param {Object} datum
     * @param {number} index
     * @param {Array}  nodes
     *
     * @private
     */
    mouseout(datum, index, nodes)
    {
        d3.select(nodes[index])
            .classed("hover", false);
    }

    /**
     * Appends the arc element to the person element.
     *
     * @param {Selection} person The parent element used to append the arc too
     * @param {Object}    data   The D3 data object
     *
     * @private
     */
    addArcToPerson(person, data)
    {
        // Create arc generator
        let arcGenerator = d3.arc()
            .startAngle(this._geometry.startAngle(data.depth, data.x0))
            .endAngle(this._geometry.endAngle(data.depth, data.x1))
            .innerRadius(this._geometry.innerRadius(data.depth))
            .outerRadius(this._geometry.outerRadius(data.depth));

        arcGenerator.padAngle(this._configuration.padAngle)
            .padRadius(this._configuration.padRadius)
            .cornerRadius(this._configuration.cornerRadius);

        // Append arc
        let arcGroup = person
            .append("g")
            .attr("class", "arc");

        let path = arcGroup
            .append("path")
            .attr("d", arcGenerator);

        // Hide arc initially if its new during chart update
        if (person.classed("new")) {
            path.style("opacity", 1e-6);
        }
    }

    /**
     * Add title element to the person element containing the full name of the individual.
     *
     * @param {Selection} person The parent element used to append the title too
     * @param {string}    value  The value to assign to the title
     *
     * @private
     */
    addTitleToPerson(person, value)
    {
        person
            .insert("title", ":first-child")
            .text(value);
    }

    /**
     * Append labels (initial hidden).
     *
     * @param {Selection} parent The parent element used to append the label element too
     * @param {Object}    data   The D3 data object
     *
     * @return {Selection} Newly added label element
     *
     * @private
     */
    addLabelToPerson(parent, data)
    {
        return parent
            .append("g")
            .attr("class", "label")
            .style("font-size", this.getFontSize(data) + "px")
            .style("fill", this._configuration.fontColor);
    }

    /**
     * Get the scaled font size.
     *
     * @param {Object} data The The D3 data object
     *
     * @return {number}
     */
    getFontSize(data)
    {
        let fontSize = this._configuration.fontSize;

        if (data.depth >= (this._configuration.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        return ((fontSize - data.depth) * this._configuration.fontScale / 100.0);
    }
}
