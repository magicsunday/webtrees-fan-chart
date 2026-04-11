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
 * Transforms the flat JSON tree received from the server into a D3 partition
 * hierarchy. Missing parents are filled in with empty placeholder nodes so
 * every individual always has two parents up to the configured generation
 * limit, keeping arc geometry consistent.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Hierarchy {
    /**
     * @param {Configuration} configuration The application configuration
     */
    constructor(configuration) {
        this._configuration = configuration;
        this._nodes = null;
        this._root = null;
    }

    /**
     * Builds the D3 hierarchy from raw JSON data, pads missing parent slots with
     * empty nodes, applies a partition layout, and assigns sequential IDs. Must
     * be called before accessing nodes or root.
     *
     * @param {Object} datum The raw JSON chart data object from the server
     */
    init(datum) {
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
     * Flat array of all partition nodes (root plus all descendants) in
     * top-down order, each augmented with a unique sequential id.
     *
     * @return {Array}
     */
    get nodes() {
        return this._nodes;
    }

    /**
     * @return {Object}
     */
    get root() {
        return this._root;
    }

    /**
     * Produces a minimal placeholder node so the partition layout always
     * receives two parent slots. The returned object has the same shape as a
     * real server node but with an empty xref and blank name fields.
     *
     * @param {number} generation Depth of the placeholder in the tree
     * @param {string} sex        SEX_MALE or SEX_FEMALE constant
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
