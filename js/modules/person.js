/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "./d3";
import Text from "./arc/text";
import Geometry, {MATH_PI2} from "./geometry";

/**
 * This class handles the creation of the person elements of the chart.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
export default class Person
{
    /**
     * Constructor.
     *
     * @param {Config}    config    The configuration
     * @param {Options}   options
     * @param {Hierarchy} hierarchy
     * @param {Object}    person
     * @param {Object}    d
     */
    constructor(config, options, hierarchy, person, d)
    {
        this._config    = config;
        this._options   = options;
        this._hierarchy = hierarchy;
        this._geometry  = new Geometry(options);

        this.init(person, d);
    }

    /**
     * Initialize the required elements.
     *
     * @param {Object} person
     * @param {Object} d
     *
     * @public
     */
    init(person, d)
    {
        if (person.classed("new") && this._options.hideEmptySegments) {
            this.addArcToPerson(person, d);
        } else {
            if (!person.classed("new")
                && !person.classed("update")
                && !person.classed("remove")
                && ((d.data.xref !== "") || !this._options.hideEmptySegments)
            ) {
                this.addArcToPerson(person, d);
            }
        }

        if (d.data.xref !== "") {
            this.addTitleToPerson(person, d.data.name);

            // Append labels (initial hidden)
            let label = this.addLabelToPerson(person);

            let text = new Text(this._config, this._options);
            text.addLabel(label, d);
        }

        // Hovering
        person.on("mouseover", this.mouseover.bind(this))
            .on("mouseout", this.mouseout.bind(this));
    }

    /**
     * Handles the event when a pointing device is moved onto an element.
     *
     * @param {Object} datum
     * @param {Number} index
     * @param {Array}  nodes
     *
     * @private
     */
    mouseover(datum, index, nodes)
    {
        d3.select(nodes[index])
            .classed("hover", true);
    }

    /**
     * Handles the event when a pointing device is moved off an element.
     *
     * @param {Object} datum
     * @param {Number} index
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
     * @param {Object} person The parent element used to append the arc too
     * @param {Object} data   The D3 data object
     *
     * @private
     */
    addArcToPerson(person, data)
    {
        // Arc generator
        let arcGen = d3.arc()
            .startAngle(() => (data.depth === 0) ? 0 : this._geometry.startAngle(data))
            .endAngle(() => (data.depth === 0) ? MATH_PI2 : this._geometry.endAngle(data))
            .innerRadius(this._geometry.innerRadius(data))
            .outerRadius(this._geometry.outerRadius(data));

        // Append arc
        let arcGroup = person
            .append("g")
            .attr("class", "arc");

        let path = arcGroup
            .append("path")
            .attr("d", arcGen);

        // Hide arc initially if its new during chart update
        if (person.classed("new")) {
            path.style("opacity", 1e-6);
        }
    }

    /**
     * Add title element to the person element containing the full name of the individual.
     *
     * @param {Object} person The parent element used to append the title too
     * @param {String} value  The value to assign to the title
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
     * @param {Object} parent The parent element used to append the label element too
     *
     * @return {Object} Newly added label element
     *
     * @private
     */
    addLabelToPerson(parent)
    {
        return parent
            .append("g")
            .attr("class", "label")
            .style("fill", this._options.fontColor);
    }
}
