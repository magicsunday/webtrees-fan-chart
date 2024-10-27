/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import {SEX_FEMALE, SEX_MALE} from "./hierarchy";

/**
 * This class handles the gradient coloring.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Gradient
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
    }

    /**
     * Initializes the gradient fill.
     *
     * @param {Object} data D3 data object
     *
     * @return {void}
     */
    init(datum)
    {
        if (datum.depth < 1) {
            return;
        }

        if (datum.depth === 1) {
            // Define initial gradient colors starting with second generation
            let color1 = [64, 143, 222];
            let color2 = [161, 219, 117];

            if (datum.data.data.sex === SEX_FEMALE) {
                color1 = [218, 102, 13];
                color2 = [235, 201, 33];
            }

            datum.data.data.colors = [ color1, color2 ];
        } else {
            // Calculate subsequent gradient colors
            let c = [
                Math.ceil((datum.parent.data.data.colors[0][0] + datum.parent.data.data.colors[1][0]) / 2.0),
                Math.ceil((datum.parent.data.data.colors[0][1] + datum.parent.data.data.colors[1][1]) / 2.0),
                Math.ceil((datum.parent.data.data.colors[0][2] + datum.parent.data.data.colors[1][2]) / 2.0),
            ];

            if (datum.data.data.sex === SEX_MALE) {
                datum.data.data.colors = [ datum.parent.data.data.colors[0], c];
            }

            if (datum.data.data.sex === SEX_FEMALE) {
                datum.data.data.colors = [ c, datum.parent.data.data.colors[1] ];
            }
        }

        // Add a new radial gradient
        let newGrad = this._svg.defs
            .append("svg:linearGradient")
            .attr("id", "grad-" + datum.id);

        // Define start and stop colors of gradient
        newGrad.append("svg:stop")
            .attr("offset", "0%")
            .attr("stop-color", "rgb(" + datum.data.data.colors[0].join(",") + ")");

        newGrad.append("svg:stop")
            .attr("offset", "100%")
            .attr("stop-color", "rgb(" + datum.data.data.colors[1].join(",") + ")");
    }
}
