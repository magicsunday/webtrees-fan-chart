/**
 * See LICENSE.md file for further details.
 */

/**
 * This class handles the configuration of the application.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Config
{
    /**
     * Constructor.
     */
    constructor()
    {
        this._parent  = null;
        this._svg     = null;
        this._svgDefs = null;
        this._visual  = null;
    }

    /**
     * Returns the parent element selection.
     *
     * @return {Selection}
     */
    get parent()
    {
        return this._parent;
    }

    /**
     * Sets parent element selection.
     *
     * @param {Selection} value The selection to use as parent
     */
    set parent(value)
    {
        this._parent = value;
    }

    /**
     * Returns the SVG selection.
     *
     * @return {Selection}
     */
    get svg()
    {
        return this._svg;
    }

    /**
     * Sets the SVG selection.
     *
     * @param {Selection} value The selection to use
     */
    set svg(value)
    {
        this._svg = value;
    }

    /**
     * Returns the SVG defs selection.
     *
     * @return {Selection}
     */
    get svgDefs()
    {
        return this._svgDefs;
    }

    /**
     * Sets the SVG defs selection.
     *
     * @param {Selection} value The selection to use
     */
    set svgDefs(value)
    {
        this._svgDefs = value;
    }

    /**
     * Returns the visual selection.
     *
     * @return {Selection}
     */
    get visual()
    {
        return this._visual;
    }

    /**
     * Sets the visual selection.
     *
     * @param {Selection} value The selection to use
     */
    set visual(value)
    {
        this._visual = value;
    }
}
