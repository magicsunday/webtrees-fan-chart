/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import LabelRenderer from "./label-renderer";
import TooltipRenderer from "./tooltip-renderer";
import {SEX_FEMALE, SEX_MALE} from "../hierarchy";

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
     * @param {ArcFactory}    arcFactory    Factory for creating arc generators
     * @param {Geometry}      geometry      Geometry helper instance
     * @param {Object}        layout        Pre-calculated geometry layout
     * @param {Selection}     person
     * @param {Object}        children
     */
    constructor(svg, configuration, arcFactory, geometry, layout, person, children)
    {
        this._svg           = svg;
        this._configuration = configuration;
        this._arcFactory    = arcFactory;
        this._geometry      = geometry;
        this._layout        = layout;

        this._labelRenderer   = new LabelRenderer(this._svg, this._configuration, this._geometry);
        this._tooltipRenderer = new TooltipRenderer(this._svg, this._configuration, this._geometry);

        this.init(person, children);
    }

    /**
     * Initialize the required elements.
     *
     * @param {Selection} person
     * @param {Object}    datum
     */
    init(person, datum)
    {
        if (person.classed("new") && this._configuration.hideEmptySegments) {
            this.addArcToPerson(person, datum);
        } else {
            if (!person.classed("new")
                && !person.classed("update")
                && !person.classed("remove")
                && ((datum.data.data.xref !== "") || !this._configuration.hideEmptySegments)
            ) {
                this.addArcToPerson(person, datum);
            }
        }

        if (datum.data.data.xref !== "") {
            this.addTitleToPerson(person, datum.data.data.name);

            this._labelRenderer.render(person, datum, this._layout);
            this.addColorGroup(person, datum);

            this._tooltipRenderer.bind(person, datum);
        }
    }

    /**
     * Adds a color overlay for each arc.
     *
     * @param {Selection} person
     * @param {Object}    datum   The D3 data object
     */
    addColorGroup(person, datum)
    {
        let arcGenerator = this._arcFactory.createOverlayArc(datum, this._layout, this._configuration.colorArcWidth);

        let color = person
            .append("g")
            .attr("class", "color");

        let path = color.append("path")
            .attr("fill", () => {
                if (this._configuration.showColorGradients) {
                    // Innermost circle (first generation)
                    if (!datum.depth) {
                        return "rgb(225, 225, 225)";
                    }

                    return "url(#grad-" + datum.id + ")";
                }

                return null;
            })
            .attr("d", arcGenerator);

        if (!this._configuration.showColorGradients) {
            path.attr(
                "class",
                datum.data.data.sex === SEX_FEMALE ? "female" : (datum.data.data.sex === SEX_MALE ? "male" : "unknown")
            );
        }
    }

    /**
     * Appends the arc element to the person element.
     *
     * @param {Selection} person The parent element used to append the arc too
     * @param {Object}    datum  The D3 data object
     *
     * @private
     */
    addArcToPerson(person, datum)
    {
        let arcGenerator = this._arcFactory.createPrimaryArc(datum, this._layout);

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
}
