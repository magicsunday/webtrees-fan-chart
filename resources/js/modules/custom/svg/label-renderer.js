/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Geometry from "./geometry";
import Text from "./text";

/**
 * Thin coordinator that creates the label <g> for a person arc, applies the
 * depth-scaled font size, hides the group immediately during update transitions
 * to prevent a visual flash, then delegates the actual text element creation
 * to the Text class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class LabelRenderer {
    constructor(svg, configuration) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = new Geometry(this._configuration);
    }

    /**
     * Appends a <g class="wt-chart-box-name name"> to parent, sets its font
     * size from the depth-scaled geometry, then calls Text.createLabels() to
     * populate it. The group starts invisible when the parent is being updated
     * so the cross-fade transition controls its appearance.
     *
     * @param {Selection} parent The person <g> element to append the label group to
     * @param {Object}    datum  The D3 partition datum
     *
     * @return {Selection}
     */
    addLabel(parent, datum) {
        const label = parent
            .append("g")
            .attr("class", "wt-chart-box-name name")
            .style("font-size", this._geometry.getFontSize(datum) + "px");

        // Hide immediately during updates to prevent visual flash
        if (parent.classed("update")) {
            label.style("opacity", 1e-6);
        }

        const text = new Text(this._svg, this._configuration);
        text.createLabels(label, datum);

        return label;
    }
}
