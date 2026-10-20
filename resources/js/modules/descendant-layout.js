/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * The result of laying out the descendant sector, computed by the hierarchy and
 * read by the geometry. Keeping it apart from the configuration leaves the
 * configuration a read-only holder of user settings.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class DescendantLayout {
    constructor() {
        /**
         * D3 linear scale mapping descendant fractions in [0, 1] to radians,
         * or null while no descendant sector is laid out.
         *
         * @type {((fraction: number) => number)|null}
         */
        this.childScale = null;

        /**
         * Narrowest child arc as a fraction of the whole descendant sector, or 0
         * while no descendant sector is laid out. Geometry uses it to cap all
         * child font sizes uniformly.
         *
         * @type {number}
         */
        this.smallestChildFraction = 0;

        /**
         * True when the child arcs are too narrow for places, so that they show
         * the compact year range instead of the regular timespan.
         *
         * @type {boolean}
         */
        this.compactChildren = false;
    }

    /**
     * Clears all results, as when no descendant sector is laid out.
     */
    reset() {
        this.childScale = null;
        this.smallestChildFraction = 0;
        this.compactChildren = false;
    }
}
