/**
 * See LICENSE.md file for further details.
 */
import * as d3 from "./d3";
import {SEX_FEMALE, SEX_MALE} from "./hierarchy";
import Geometry, {MATH_PI2} from "./geometry";

/**
 * This class handles the gradient coloring.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
export default class Gradient
{
    /**
     * Constructor.
     *
     * @param {Config}  config  The configuration
     * @param {Options} options
     */
    constructor(config, options)
    {
        this._config   = config;
        this._options  = options;
        this._geometry = new Geometry(options);
    }

    /**
     * Initializes the gradient fill.
     *
     * @param {object} d D3 data object
     *
     * @return {void}
     */
    init(d)
    {
        if (d.depth < 1) {
            return;
        }

        if (d.depth === 1) {
            // Define initial gradient colors starting with second generation
            let color1 = [64, 143, 222];
            let color2 = [161, 219, 117];

            if (d.data.sex === SEX_FEMALE) {
                color1 = [218, 102, 13];
                color2 = [235, 201, 33];
            }

            d.data.colors = [color1, color2];
        } else {
            // Calculate subsequent gradient colors
            let c = [
                Math.ceil((d.parent.data.colors[0][0] + d.parent.data.colors[1][0]) / 2.0),
                Math.ceil((d.parent.data.colors[0][1] + d.parent.data.colors[1][1]) / 2.0),
                Math.ceil((d.parent.data.colors[0][2] + d.parent.data.colors[1][2]) / 2.0),
            ];

            if (d.data.sex === SEX_MALE) {
                d.data.colors[0] = d.parent.data.colors[0];
                d.data.colors[1] = c;
            }

            if (d.data.sex === SEX_FEMALE) {
                d.data.colors[0] = c;
                d.data.colors[1] = d.parent.data.colors[1];
            }
        }

        // Add a new radial gradient
        let newGrad = this._config.svgDefs
            .append("svg:linearGradient")
            .attr("id", "grad-" + d.data.id);

        // Define start and stop colors of gradient
        newGrad.append("svg:stop")
            .attr("offset", "0%")
            .attr("stop-color", "rgb(" + d.data.colors[0].join(",") + ")");

        newGrad.append("svg:stop")
            .attr("offset", "100%")
            .attr("stop-color", "rgb(" + d.data.colors[1].join(",") + ")");
    }

    /**
     * Adds an color overlay for each arc.
     *
     * @param {Hierarchy} hierarchy
     *
     * @return {Object} Color group object
     */
    addColorGroup(hierarchy)
    {
        // Arc generator
        let arcGen = d3.arc()
            .startAngle((d) => (d.depth === 0) ? 0 : this._geometry.startAngle(d))
            .endAngle((d) => (d.depth === 0) ? MATH_PI2 : this._geometry.endAngle(d))
            .innerRadius((d) => this._geometry.outerRadius(d) - this._options.colorArcWidth)
            .outerRadius((d) => this._geometry.outerRadius(d) + 1);

        let colorGroup = this._config.svg
            .select("g")
            .append("g")
            .attr("class", "colorGroup")
            .style("opacity", 1e-6);

        colorGroup
            .selectAll("g.colorGroup")
            .data(hierarchy.nodes)
            .enter()
            .filter((d) => (d.data.xref !== ""))
            .append("path")
            .attr("fill", (d) => {
                if (this._options.showColorGradients) {
                    // Innermost circle (first generation)
                    if (!d.depth) {
                        return "rgb(225, 225, 225)";
                    }

                    return "url(#grad-" + d.data.id + ")";
                }

                return d.data.color;
            })
            .attr("d", arcGen);

        return colorGroup;
    }
}
