/**
 * See LICENSE.md file for further details.
 */
import Update from "../update";

/**
 * This class handles the click events.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Click
{
    /**
     * Constructor.
     *
     * @param {Config}    config    The configuration
     * @param {Options}   options
     * @param {Hierarchy} hierarchy
     */
    constructor(config, options, hierarchy)
    {
        this._config    = config;
        this._options   = options;
        this._hierarchy = hierarchy;
    }

    /**
     * This method bind the "click" event listeners to a "person" element.
     *
     * @public
     */
    bindClickEventListener()
    {
        let personGroup = this._config.svg
            .select("g.personGroup")
            .selectAll("g.person")
            .data(this._hierarchy.nodes)
            .filter(d => (d.data.xref !== ""))
            .classed("available", true);

        // Trigger method on click
        personGroup.on("click", this.personClick.bind(this));
    }

    /**
     * Method triggers either the "update" or "individual" method on the click on an person.
     *
     * @param {Object} data The D3 data object
     *
     * @private
     */
    personClick(data)
    {
        // Trigger either "update" or "individual" method on click depending on person in chart
        (data.depth === 0) ? this.individual(data) : this.update(data);
    }

    /**
     * Redirect the current page the the individual page.
     *
     * @param {Object} d D3 data object
     *
     * @private
     */
    individual(d)
    {
        window.location = d.data.url;
    }

    /**
     * Redirect the current page the the individual page.
     *
     * @param {Object} d D3 data object
     *
     * @private
     */
    update(d)
    {
        let update = new Update(this._config, this._options, this._hierarchy);

        update.update(d, () => this.bindClickEventListener());
    }
}
