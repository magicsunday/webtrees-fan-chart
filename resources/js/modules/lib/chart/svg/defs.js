/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * SVG definition class
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Defs
{
    /**
     * Constructor.
     *
     * @param {Selection} svg The selected D3 parent element container
     */
    constructor(svg)
    {
        // Create the <svg:defs> element
        this._element = svg.append("defs");
    }

    /**
     * Returns the internal element.
     *
     * @returns {selection}
     */
    get()
    {
        return this._element;
    }

    /**
     * @param {function|string} select
     *
     * @returns {Selection}
     */
    select(select)
    {
        return this._element.select(select);
    }

    /**
     * @param {string|function} name
     *
     * @returns {Selection}
     */
    append(name)
    {
        return this._element.append(name);
    }
}
