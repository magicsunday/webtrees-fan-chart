/**
 * See LICENSE.md file for further details.
 */

/**
 * Filter definition class
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Filter
{
    /**
     * Constructor.
     *
     * @param {Selection} defs The selected D3 parent element container
     */
    constructor(defs)
    {
        // Create the <svg:defs> element
        this._element = defs;

        // TODO: Set using filter: url(#drop-shadow);

        // let filter = this._element.append("filter")
        //     .attr("id", "drop-shadow")
        //     .attr("width", "200%")
        //     .attr("height", "200%")
        //     .attr("x", "-20%")
        //     .attr("y", "-20%")
        //     .attr("filterUnits", "objectBoundingBox")
        //     .attr("primitiveUnits", "userSpaceOnUse")
        //     .attr("color-interpolation-filters", "linearRGB");
        //
        // filter.append("feDropShadow")
        //     .attr("in", "SourceGraphic")
        //     .attr("stdDeviation", "8 8")
        //     .attr("x", "0%")
        //     .attr("y", "0%")
        //     .attr("width", "100%")
        //     .attr("height", "100%")
        //     .attr("dx", "0")
        //     .attr("dy", "0")
        //     .attr("flood-opacity", "0.2")
        //     .attr("result", "dropShadow")
        //     .style("flood-color", "rgb(0,0,0)");
    }

    /**
     * Returns the internal element.
     *
     * @return {Selection}
     */
    get()
    {
        return this._element;
    }
}
