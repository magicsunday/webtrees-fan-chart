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
     */
    init(data)
    {
        let self = this;

        // Get the greatest depth
        const getDepth       = ({children}) => 1 + (children ? Math.max(...children.map(getDepth)) : 0);
        const maxGenerations = getDepth(data);

        // Construct root node from the hierarchical data
        let root = d3.hierarchy(
            data,
            d => {
                // Fill up the missing children to the requested number of generations
                if (!d.children && (d.generation < maxGenerations)) {
                    return [
                        self.createEmptyNode(d.generation + 1, SEX_MALE),
                        self.createEmptyNode(d.generation + 1, SEX_FEMALE)
                    ];
                }

                // Add missing parent record if we got only one
                if (d.children && (d.children.length < 2)) {
                    if (d.children[0].sex === SEX_MALE) {
                        // Append empty node if we got an father
                        d.children.push(self.createEmptyNode(d.generation + 1, SEX_FEMALE));
                    } else {
                        // Else prepend empty node
                        d.children.unshift(self.createEmptyNode(d.generation + 1, SEX_MALE));
                    }
                }

                return d.children;
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
     */
    getNodes()
    {
        return this.nodes;
    }

    /**
     * Create an empty child node object.
     *
     * @param {Number} generation Generation of the node
     * @param {String} sex
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
