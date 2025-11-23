/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Text from "./text";

/**
 * Renders the labels for a person element.
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
     * @param {Geometry}      geometry      Geometry helper instance
     */
    constructor(svg, configuration, geometry)
    {
        this._svg           = svg;
        this._configuration = configuration;
        this._geometry      = geometry;
        this._text          = new Text(this._svg, this._configuration, this._geometry);
    }

    /**
     * Append all label nodes to the given parent selection.
     *
     * @param {Selection} parent The parent element used to append the label element to
     * @param {Object}    datum  The D3 data object
     * @param {Object}    layout Geometry layout descriptor
     *
     * @return {Selection}
     */
    render(parent, datum, layout)
    {
        const label = this.createLabelGroup(parent, datum);

        this._text.createLabels(label, datum, layout);

        return label;
    }

    /**
     * Create the label group with the correct font size.
     *
     * @param {Selection} parent The parent element used to append the label element to
     * @param {Object}    datum  The D3 data object
     *
     * @return {Selection}
     *
     * @private
     */
    createLabelGroup(parent, datum)
    {
        return parent
            .append("g")
            .attr("class", "wt-chart-box-name name")
            .style("font-size", this.getFontSize(datum) + "px");
    }

    /**
     * Calculate the scaled font size for a given node depth.
     *
     * @param {Object} datum The D3 data object
     *
     * @return {number}
     */
    getFontSize(datum)
    {
        let fontSize = this._configuration.fontSize;

        if (datum.depth >= (this._configuration.numberOfInnerCircles + 1)) {
            fontSize += 1;
        }

        return ((fontSize - datum.depth) * this._configuration.fontScale / 100.0);
    }
}
