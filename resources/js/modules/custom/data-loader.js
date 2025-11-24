/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../lib/d3";

/**
 * Handles loading and normalizing chart data.
 */
export default class DataLoader
{
    /**
     * Loads hierarchy data from a remote endpoint.
     *
     * @param {string} url
     *
     * @returns {Promise<Object>}
     */
    fetchHierarchy(url)
    {
        return d3.json(url)
            .then((data) => this.normalize(data));
    }

    /**
     * Normalizes the hierarchy payload.
     *
     * @param {Object} payload
     *
     * @returns {Object}
     */
    normalize(payload)
    {
        return payload;
    }
}
