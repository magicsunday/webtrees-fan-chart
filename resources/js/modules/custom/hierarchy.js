/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../lib/d3";
import {MATH_DEG2RAD} from "./svg/geometry.js";

export const SEX_MALE   = "M";
export const SEX_FEMALE = "F";

/**
 * This class handles the hierarchical data.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Hierarchy
{
    /**
     * Constructor.
     *
     * @param {Configuration} configuration The application configuration
     */
    constructor(configuration)
    {
        this._configuration = configuration;
        this._nodes         = null;
        this._hierarchy     = null;
        this._root          = null;
    }

    /**
     * @return {number}
     */
    get startPi()
    {
        if (this._configuration.fanDegree === 90) {
            return 0;
        }

        return -(this._configuration.fanDegree / 2 * MATH_DEG2RAD);
    }

    /**
     * @return {number}
     */
    get endPi()
    {
        if (this._configuration.fanDegree === 90) {
            return (this._configuration.fanDegree * MATH_DEG2RAD);
        }

        return (this._configuration.fanDegree / 2 * MATH_DEG2RAD);
    }

    /**
     * Initialize the hierarchical chart data.
     *
     * @param {Object} data The JSON encoded chart data
     */
    init(data)
    {
        // Get the greatest depth
        // const getDepth       = ({parents}) => 1 + (parents ? Math.max(...parents.map(getDepth)) : 0);
        // const maxGenerations = getDepth(data);

        // Construct the hierarchical data
        this._hierarchy = d3.hierarchy(
            data,
            data => {
                // Fill up the missing parents to the requested number of generations
                // if (!data.data.parents && (data.data.generation < maxGenerations)) {
                if (!data.parents && (data.data.generation < this._configuration.generations)) {
                    data.parents = [
                        this.createEmptyNode(data.data.generation + 1, SEX_MALE),
                        this.createEmptyNode(data.data.generation + 1, SEX_FEMALE)
                    ];
                }

                // Add missing parent record if we got only one
                if (data.parents && (data.parents.length < 2)) {
                    if (data.parents[0].data.sex === SEX_MALE) {
                        data.parents.push(
                            this.createEmptyNode(data.data.generation + 1, SEX_FEMALE)
                        );
                    } else {
                        data.parents.unshift(
                            this.createEmptyNode(data.data.generation + 1, SEX_MALE)
                        );
                    }
                }

                return data.parents;
            })
            // Calculate value properties of each node in the hierarchy
            .count();

        // Compute the layout
        this._root  = d3.partition().size([2 * -this.startPi, this._hierarchy.height + 1])(this._hierarchy);
        this._nodes = this._root.descendants();

        // Assign a unique ID to each node
        this._root.each((d, i) => {
            d.current = d;
            d.id = i;
        });

console.log(this._root);
    }

    /**
     * Returns the nodes.
     *
     * @return {Array}
     */
    get nodes()
    {
        return this._nodes;
    }

    /**
     * Returns the root note.
     *
     * @returns {Individual}
     *
     * @public
     */
    get root()
    {
        return this._root;
    }

    /**
     * Create an empty child node object.
     *
     * @param {number} generation Generation of the node
     * @param {string} sex        The sex of the individual
     *
     * @return {Object}
     *
     * @private
     */
    createEmptyNode(generation, sex)
    {
        return {
            data: {
                id              : 0,
                xref            : "",
                url             : "",
                updateUrl       : "",
                generation      : generation,
                name            : "",
                firstNames      : [],
                lastNames       : [],
                preferredName   : "",
                alternativeName : "",
                isAltRtl        : false,
                sex             : sex,
                timespan        : ""
            }
        };
    }
}
