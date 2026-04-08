/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Geometry from "./geometry";
import Text from "./text";

/**
 * This class handles the creation of the label elements for person arcs.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class LabelRenderer
{
    /**
     * Constructor.
     *
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     */
    constructor(svg, configuration)
    {
        this._svg           = svg;
        this._configuration = configuration;
        this._geometry      = new Geometry(this._configuration);
    }

    /**
     * Appends a label group to a person element and fills it with text content.
     *
     * @param {Selection} parent The parent element used to append the label element to
     * @param {Object}    datum  The D3 data object
     *
     * @return {Selection} Newly added label element
     */
    addLabel(parent, datum)
    {
        let label = parent
            .append("g")
            .attr("class", "wt-chart-box-name name")
            .style("font-size", this._geometry.getFontSize(datum) + "px");

        // Hide immediately during updates to prevent visual flash
        if (parent.classed("update")) {
            label.style("opacity", 1e-6);
        }

        let text = new Text(this._svg, this._configuration);
        text.createLabels(label, datum);

        return label;
    }
}
