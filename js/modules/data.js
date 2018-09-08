import { config } from "./config";
import * as d3 from './d3'

/**
 * Initialize the chart data.
 *
 * @param {object} data JSON encoded data
 *
 * @private
 */
export function initData(data) {
    // Construct root node
    let root = d3.hierarchy(
        data,
        function (d) {

            // Fill up the missing children to the requested number of generations
            if (!d.children && (d.generation < rso.options.generations)) {
                return [
                    createEmptyNode(d.generation + 1, 'M'),
                    createEmptyNode(d.generation + 1, 'F')
                ];
            }

            // Add missing parent record if we got only one
            if (d.children && (d.children.length < 2)) {
                if (d.children[0].sex === 'M') {
                    // Append empty node if we got an father
                    d.children.push(createEmptyNode(d.generation + 1, 'F'));
                } else {
                    // Else prepend empty node
                    d.children.unshift(createEmptyNode(d.generation + 1, 'M'));
                }
            }

            return d.children;
        })
        // Calculate number of leaves
        .count();

    let partition = d3.partition();
    config.nodes = partition(root).descendants();

    // Create unique id for each element
    config.nodes.forEach(function (entry) {
        entry.data.id = rso.options.id();
    });

    rso.options.id(true);
}

/**
 * Create an empty child node object.
 *
 * @param {number} generation Generation of the node
 * @param {string} sex
 *
 * @return {object}
 */
function createEmptyNode(generation, sex) {
    return {
        id         : 0,
        xref       : '',
        sex        : sex,
        name       : '',
        generation : generation,
        color      : rso.options.defaultColor,
        colors     : [[], []]
    };
}
