/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import { config } from "./config";
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
export function initData(data) {
    // Construct root node from the hierarchical data
    let root = d3.hierarchy(
        data,
        function (d) {

            // Fill up the missing children to the requested number of generations
            if (!d.children && (d.generation < rso.options.generations)) {
                return [
                    createEmptyNode(d.generation + 1, SEX_MALE),
                    createEmptyNode(d.generation + 1, SEX_FEMALE)
                ];
            }

            // Add missing parent record if we got only one
            if (d.children && (d.children.length < 2)) {
                if (d.children[0].sex === SEX_MALE) {
                    // Append empty node if we got an father
                    d.children.push(createEmptyNode(d.generation + 1, SEX_FEMALE));
                } else {
                    // Else prepend empty node
                    d.children.unshift(createEmptyNode(d.generation + 1, SEX_MALE));
                }
            }

            return d.children;
        })
        // Calculate number of leaves
        .count();

    // Create partition layout
    let partition = d3.partition();
    config.nodes = partition(root).descendants();

    // Create unique ids for each element
    config.nodes.forEach(function (entry) {
        entry.data.id = rso.options.id();
    });

    rso.options.id(true);
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
function createEmptyNode(generation, sex) {
    return {
        id         : 0,
        xref       : "",
        sex        : sex,
        name       : "",
        generation : generation,
        color      : rso.options.defaultColor,
        colors     : [[], []]
    };
}
