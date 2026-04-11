/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Registers a drop-shadow SVG filter definition (#drop-shadow) in the given
 * <defs> element. The filter is applied via CSS ("filter: url(#drop-shadow)")
 * because Chrome does not support CSS filter on SVG elements via the stylesheet
 * (Chromium issue #109224).
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Filter {
    /**
     * * @param {Selection} defs The D3 selection of the SVG <defs> element
     */
    constructor(defs) {
        // Create the <svg:defs> element
        this._element = defs;

        // Filter is set in CSS via "filter: url(#drop-shadow);"

        // Chrome still does not support filtering SVG elements using CSS other than the root
        // https://bugs.chromium.org/p/chromium/issues/detail?id=109224
        const filter = this._element
            .append("filter")
            .attr("id", "drop-shadow");

        filter.append("feDropShadow")
            .attr("stdDeviation", "7 7")
            .attr("dx", "0")
            .attr("dy", "0")
            .attr("flood-opacity", "0.3")
            .attr("flood-color", "rgb(0,0,0)");
    }

    /**
     * Returns the <defs> D3 selection passed to the constructor.
     *
     * @return {Selection}
     */
    get() {
        return this._element;
    }
}
