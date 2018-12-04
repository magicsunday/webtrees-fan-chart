/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
// import { config } from "./config";
import * as d3 from "./d3";

export const SEX_MALE   = "M";
export const SEX_FEMALE = "F";

/**
 * Initialize the hierarchical chart data.
 *
 * @param {Object} data JSON encoded data
 *
 * @public
 */
export class Hierarchy
{
    /**
     * Constructor.
     *
     * @param {Object} options
     */
    constructor(options)
    {
        this.options = options;
    }

    /**
     *
     * @param {Array} data
     *
     * @public
     */
    init(data)
    {
        // Get the greatest depth
        // const getDepth       = ({children}) => 1 + (children ? Math.max(...children.map(getDepth)) : 0);
        // const maxGenerations = getDepth(data);

        // Construct root node from the hierarchical data
        let root = d3.hierarchy(
            data,
            data => {
                // Fill up the missing children to the requested number of generations
                // if (!data.children && (data.generation < maxGenerations)) {
                if (!data.children && (data.generation < this.options.generations)) {
                    data.children = [
                        this.createEmptyNode(data.generation + 1, SEX_MALE),
                        this.createEmptyNode(data.generation + 1, SEX_FEMALE)
                    ];
                }

                // Add missing parent record if we got only one
                if (data.children && (data.children.length < 2)) {
                    if (data.children[0].sex === SEX_MALE) {
                        data.children.push(
                            this.createEmptyNode(data.generation + 1, SEX_FEMALE)
                        );
                    } else {
                        data.children.unshift(
                            this.createEmptyNode(data.generation + 1, SEX_MALE)
                        );
                    }
                }

                return data.children;
            })
            // Calculate number of leaves
            .count();

        // Create partition layout
        let partitionLayout = d3.partition();

        // Map the node data to the partition layout
        this.nodes = partitionLayout(root).descendants();

        // Create unique ids for each element
        this.nodes.forEach(entry => {
            entry.data.id = this.options.id();
        });

        this.options.id(true);
    }

    /**
     * Returns the nodes.
     *
     * @returns {Array|*}
     *
     * @public
     */
    getNodes()
    {
        return this.nodes;
    }

    /**
     * Create an empty child node object.
     *
     * @param {Number} generation Generation of the node
     * @param {String} sex        The sex of the individual
     *
     * @return {Object}
     *
     * @private
     */
    createEmptyNode(generation, sex)
    {
        return {
            id         : 0,
            xref       : "",
            sex        : sex,
            name       : "",
            generation : generation,
            color      : this.options.defaultColor,
            colors     : [[], []]
        };
    }
}
