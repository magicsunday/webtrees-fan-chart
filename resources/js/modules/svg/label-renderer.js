/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Text from "./text.js";

/**
 * @import { Selection } from "d3-selection"
 * @import Svg from "../svg.js"
 * @import Configuration from "../configuration.js"
 * @import Geometry from "./geometry.js"
 */

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
    /**
     * @param {Svg}           svg
     * @param {Configuration} configuration The application configuration
     * @param {Geometry}      geometry      Shared geometry instance for this render pass
     */
    constructor(svg, configuration, geometry) {
        this._svg = svg;
        this._configuration = configuration;
        this._geometry = geometry;
    }

    /**
     * Appends a <g class="wt-chart-box-name name"> to parent, sets its font
     * size from the depth-scaled geometry, then calls Text.createLabels() to
     * populate it. The group starts invisible when the parent is being updated
     * so the cross-fade transition controls its appearance.
     *
     * @param {Selection<any, any, any, any>} parent The person <g> element to append the label group to
     * @param {object}    datum  The D3 partition datum
     *
     * @return {Selection<any, any, any, any>}
     */
    addLabel(parent, datum) {
        const label = parent
            .append("g")
            .attr("class", "wt-chart-box-name name")
            .style("font-size", `${this._geometry.getFontSize(datum)}px`);

        const text = new Text(this._svg, this._configuration, this._geometry);
        text.createLabels(label, datum);

        return label;
    }
}
