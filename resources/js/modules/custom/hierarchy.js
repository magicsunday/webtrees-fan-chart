/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "../lib/d3";
import {MATH_DEG2RAD} from "./svg/geometry";

export const SEX_MALE = "M";
export const SEX_FEMALE = "F";

export const SYMBOL_BIRTH = "\u2605";
export const SYMBOL_DEATH = "\u2020";
export const SYMBOL_MARRIAGE = "\u26AD";
export const SYMBOL_ELLIPSIS = "\u2026";

/**
 * Angular gap in degrees between the ancestor fan and the descendant sector.
 * Applied on both sides.
 *
 * @type {number}
 */
export const DESCENDANT_GAP_DEG = 10;

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

        // Append synthetic descendant nodes if enabled
        if (this._configuration.showDescendants) {
            this.initDescendants(datum);
        }
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
     * Creates synthetic D3-compatible nodes for the partners and children
     * of the central person and appends them to this._nodes. Also sets
     * the childScale on the configuration so Geometry can resolve angles
     * for negative depths.
     *
     * @param {Object} datum The raw JSON chart data object from the server
     *
     * @private
     */
    initDescendants(datum) {
        const partners = datum.partners || [];
        const unassignedChildren = datum.unassignedChildren || [];

        if ((partners.length === 0) && (unassignedChildren.length === 0)) {
            this._configuration.childScale = null;

            return;
        }

        // Calculate the radian range for the descendant sector
        const gap = DESCENDANT_GAP_DEG * MATH_DEG2RAD;
        const fanDeg = this._configuration.fanDegree;

        const startPi = (fanDeg === 90) ? 0 : -(fanDeg / 2 * MATH_DEG2RAD);
        const endPi = (fanDeg === 90) ? (fanDeg * MATH_DEG2RAD) : (fanDeg / 2 * MATH_DEG2RAD);

        const startChildPi = endPi + gap;
        const endChildPi = (Math.PI * 2 + startPi) - gap;

        // Not enough room for descendants
        if (endChildPi <= startChildPi) {
            this._configuration.childScale = null;

            return;
        }

        // Create the linear scale: [0,1] fractions → descendant sector radians
        const childScale = d3.scaleLinear().domain([0, 1]).range([startChildPi, endChildPi]);
        this._configuration.childScale = childScale;

        const totalAngleDeg = (endChildPi - startChildPi) / MATH_DEG2RAD;
        const rootXref = datum.data.xref || "";

        // Build family blocks with weights for angle distribution
        const familyBlocks = [];

        for (const partner of partners) {
            const children = partner.children || [];

            familyBlocks.push({
                type: "family",
                partner: partner,
                children: children,
                weight: Math.max(1, children.length),
            });
        }

        if (unassignedChildren.length > 0) {
            familyBlocks.push({
                type: "unassigned",
                partner: null,
                children: unassignedChildren,
                weight: unassignedChildren.length,
            });
        }

        const totalWeight = familyBlocks.reduce((sum, block) => sum + block.weight, 0);

        // Check if proportional allocation gives < 20deg per partner arc.
        // If so, fall back to equal distribution.
        const minPartnerDeg = 20;
        let useEqualDistribution = false;

        if (totalWeight > 0) {
            const smallestPartnerDeg = totalAngleDeg * 1 / totalWeight;

            if (smallestPartnerDeg < minPartnerDeg) {
                useEqualDistribution = true;
            }
        }

        // Pre-compute the smallest child fraction across all partner groups
        // so getFontSize can apply a uniform cap to all children
        let smallestChildFraction = 1;

        for (const block of familyBlocks) {
            if (block.children.length > 0) {
                const blockFraction = useEqualDistribution
                    ? (1 / familyBlocks.length)
                    : (block.weight / totalWeight);
                const childFraction = blockFraction / block.children.length;

                smallestChildFraction = Math.min(smallestChildFraction, childFraction);
            }
        }

        this._configuration.smallestChildFraction = smallestChildFraction;

        let nextId = this._nodes.length;
        let currentFraction = 0;

        for (const block of familyBlocks) {
            const blockFraction = useEqualDistribution
                ? (1 / familyBlocks.length)
                : (block.weight / totalWeight);

            const blockStart = currentFraction;
            const blockEnd = currentFraction + blockFraction;

            if (block.partner) {
                const partnerXref = block.partner.data.xref || "";
                const partnerId = nextId++;

                this._nodes.push({
                    id: partnerId,
                    depth: -1,
                    x0: blockStart,
                    x1: blockEnd,
                    parent: null,
                    children: null,
                    height: 0,
                    value: 1,
                    data: block.partner,
                    descendantType: "partner",
                    partnerXref: partnerXref,
                    rootXref: rootXref,
                    syntheticParentId: null,
                });

                // Create child nodes (depth = -2), equally spaced under partner arc
                if (block.children.length > 0) {
                    const childFraction = blockFraction / block.children.length;

                    for (let i = 0; i < block.children.length; i++) {
                        const child = block.children[i];

                        this._nodes.push({
                            id: nextId++,
                            depth: -2,
                            x0: blockStart + (i * childFraction),
                            x1: blockStart + ((i + 1) * childFraction),
                            parent: null,
                            children: null,
                            height: 0,
                            value: 1,
                            data: child,
                            descendantType: "child",
                            partnerXref: partnerXref,
                            rootXref: rootXref,
                            syntheticParentId: partnerId,
                        });
                    }
                }
            } else {
                // Unassigned children (hidden spouse) at depth = -2
                const childFraction = blockFraction / block.children.length;

                for (let i = 0; i < block.children.length; i++) {
                    const child = block.children[i];

                    this._nodes.push({
                        id: nextId++,
                        depth: -2,
                        x0: blockStart + (i * childFraction),
                        x1: blockStart + ((i + 1) * childFraction),
                        parent: null,
                        children: null,
                        height: 0,
                        value: 1,
                        data: child,
                        descendantType: "child",
                        partnerXref: "",
                        rootXref: rootXref,
                        syntheticParentId: null,
                    });
                }
            }

            currentFraction = blockEnd;
        }
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
