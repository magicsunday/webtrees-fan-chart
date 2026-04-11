/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../lib/d3";

export const SEX_MALE = "M";
export const SEX_FEMALE = "F";

export const SYMBOL_BIRTH = "\u2605";
export const SYMBOL_DEATH = "\u2020";
export const SYMBOL_MARRIAGE = "\u26AD";
export const SYMBOL_ELLIPSIS = "\u2026";

/**
 * This class handles the hierarchical data.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Hierarchy {
    /**
     * Constructor.
     *
     * @param {Configuration} configuration The application configuration
     */
    constructor(configuration) {
        this._configuration = configuration;
        this._nodes = null;
        this._root = null;
    }

    /**
     * Initialize the hierarchical chart data.
     *
     * @param {Object} datum The JSON encoded chart data
     */
    init(datum) {
        // Get the greatest depth
        // const getDepth       = ({parents}) => 1 + (parents ? Math.max(...parents.map(getDepth)) : 0);
        // const maxGenerations = getDepth(datum);

        // Construct root node from the hierarchical data
        this._root = d3.hierarchy(
            datum,
            datum => {
                // Build a parents array without mutating the original server JSON
                let parents = datum.parents;

                // Fill up the missing parents to the requested number of generations
                if (!parents && (datum.data.generation < this._configuration.generations)) {
                    parents = [
                        this.createEmptyNode(datum.data.generation + 1, SEX_MALE),
                        this.createEmptyNode(datum.data.generation + 1, SEX_FEMALE),
                    ];
                }

                // Add missing parent record if we got only one
                if (parents && (parents.length < 2)) {
                    parents = [...parents];

                    if (parents[0].data.sex === SEX_MALE) {
                        parents.push(
                            this.createEmptyNode(datum.data.generation + 1, SEX_FEMALE),
                        );
                    } else {
                        parents.unshift(
                            this.createEmptyNode(datum.data.generation + 1, SEX_MALE),
                        );
                    }
                }

                return parents;
            })
            // Calculate value properties of each node in the hierarchy
            .count();

        // Create partition layout
        const partitionLayout = d3.partition();

        // Map the node data to the partition layout
        this._nodes = partitionLayout(this._root)
            .descendants();

        // Assign a unique ID to each node
        this._nodes.forEach((node, i) => {
            node.id = i;
        });
    }

    /**
     * Returns the nodes.
     *
     * @return {Array}
     */
    get nodes() {
        return this._nodes;
    }

    /**
     * Returns the root note.
     *
     * @returns {Individual}
     *
     * @public
     */
    get root() {
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
    createEmptyNode(generation, sex) {
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
                timespan        : "",
            },
        };
    }
}
