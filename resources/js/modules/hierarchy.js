/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import * as d3 from "./d3.js";
import { MATH_DEG2RAD } from "./svg/geometry.js";

/**
 * @import Configuration from "./configuration.js"
 * @import FamilyColor from "./svg/family-color.js"
 * @import { HierarchyNode as D3HierarchyNode } from "d3-hierarchy"
 */

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
 * The individual record as serialised by the server (see NodeData::jsonSerialize()),
 * plus the two properties the client computes and writes back onto it.
 *
 * The server payload always carries every field. The properties marked optional
 * are the ones createEmptyNode() leaves out on client-side placeholder nodes, so
 * they read as undefined for unknown ancestors.
 *
 * @typedef {object} PersonData
 * @property {number}      id                      Sequential server-side record number
 * @property {string}      xref                    GEDCOM identifier, empty string for placeholders
 * @property {string}      url                     Link to the webtrees individual page
 * @property {string}      updateUrl               AJAX route that re-centers the chart on this person
 * @property {number}      generation              Ancestor generation, 1 for the central person
 * @property {string}      name                    Full name as a single string
 * @property {string[]}    firstNames              Given name parts, in display order
 * @property {string[]}    lastNames               Surname parts, in display order
 * @property {string}      preferredName           The given name part rendered underlined
 * @property {string}      alternativeName         Alternative (e.g. married or romanised) name
 * @property {boolean}     isAltRtl                Whether the alternative name is right-to-left
 * @property {string}      sex                     SEX_MALE, SEX_FEMALE or "U"
 * @property {string}      timespan                Birth/death lines, separated by "\n"
 * @property {boolean}     [isNameRtl]             Whether the primary name is right-to-left
 * @property {string}      [nickname]              GEDCOM NICK value, without quotes
 * @property {string}      [thumbnail]             URL of the highlight image
 * @property {string}      [silhouette]            URL of the sex-specific fallback image
 * @property {string}      [birth]                 Short birth date
 * @property {string}      [death]                 Short death date
 * @property {string}      [marriageDate]          Short marriage date of this individual
 * @property {string}      [marriageDateOfParents] Short marriage date of this individual's parents
 * @property {string}      [birthDateFull]         Full birth date for the tooltip
 * @property {string}      [deathDateFull]         Full death date for the tooltip
 * @property {string}      [marriageDateFull]      Full marriage date for the tooltip
 * @property {string}      [birthPlace]            Birth place for the tooltip
 * @property {string}      [deathPlace]            Death place for the tooltip
 * @property {string}      [marriagePlace]         Marriage place for the tooltip
 * @property {string|null} [familyColor]           Pre-computed HSL color string (set by applyFamilyColors)
 * @property {number|null} [imageSize]             Pre-computed thumbnail size in px (set by Person)
 */

/**
 * A node of the raw JSON tree the server sends, and the datum d3.hierarchy() is
 * built from. Only the "data" wrapper is always present; the relation arrays are
 * omitted when empty.
 *
 * @typedef {object} NodeDatum
 * @property {PersonData}  data                 The individual's record
 * @property {NodeDatum[]} [parents]            Father and mother, in that order
 * @property {NodeDatum[]} [partners]           Spouses of the central person
 * @property {NodeDatum[]} [children]           Children of a partner block
 * @property {NodeDatum[]} [unassignedChildren] Children without a known other parent
 */

/**
 * One angular block of the descendant sector: either a partner together with
 * that couple's children, or the children without a known other parent.
 *
 * @typedef {object} FamilyBlock
 * @property {string}         type     "family" or "unassigned"
 * @property {NodeDatum|null} partner  The partner node, null for the unassigned block
 * @property {NodeDatum[]}    children The block's children, youngest first
 * @property {number}         weight   Relative angular share of the descendant sector
 */

/**
 * A single node in the D3 partition hierarchy, as stored in Hierarchy._nodes.
 * Ancestor nodes come from d3.partition(); descendant nodes are synthetic and
 * appended by initDescendants().
 *
 * @typedef {object} HierarchyNode
 * @property {number}          id               Sequential integer, unique within one hierarchy
 * @property {number}          depth            Ancestor depth ≥ 0; partner = -1; child = -2
 * @property {number}          x0               Partition start fraction [0, 1]
 * @property {number}          x1               Partition end fraction [0, 1]
 * @property {HierarchyNode|null} parent        D3 parent node (null for root and synthetic nodes)
 * @property {HierarchyNode[]|null} children    D3 child nodes, or null for leaves
 * @property {number}          height           D3 partition height
 * @property {number}          value            D3 partition value
 * @property {NodeDatum}       data             Server payload wrapper for this node
 * @property {string}          [descendantType] "partner" | "child" — only on synthetic descendant nodes
 * @property {string}          [partnerXref]    Partner's GEDCOM xref — only on synthetic descendant nodes
 * @property {string}          [rootXref]       Central person's xref — only on synthetic descendant nodes
 * @property {number|null}     [syntheticParentId] Partner node id for child nodes, null otherwise
 */

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

        /** @type {HierarchyNode[]|null} */
        this._nodes = null;

        /**
         * The d3-hierarchy root. Distinct from our own HierarchyNode typedef:
         * d3 describes the node with its own interface, so the root getter
         * hands out a converted view (see the note in init()).
         *
         * @type {D3HierarchyNode<NodeDatum>|null}
         */
        this._root = null;
    }

    /**
     * Builds the D3 hierarchy from raw JSON data, pads missing parent slots
     * with empty nodes, applies a partition layout, and assigns sequential IDs.
     * Must be called before accessing nodes or root.
     *
     * @param {NodeDatum} datum The raw JSON chart data object from the server
     */
    init(datum) {
        // Construct root node from the hierarchical data
        this._root = d3
            .hierarchy(datum, (datum) => {
                // Build a parents array without mutating the original server JSON
                let parents = datum.parents;

                // Fill up the missing parents to the requested number of generations
                if (!parents && datum.data.generation < this._configuration.generations) {
                    parents = [
                        this.createEmptyNode(datum.data.generation + 1, SEX_MALE),
                        this.createEmptyNode(datum.data.generation + 1, SEX_FEMALE),
                    ];
                }

                // Add missing parent record if we got only one
                if (parents && parents.length < 2) {
                    parents = [...parents];

                    if (parents[0].data.sex === SEX_MALE) {
                        parents.push(this.createEmptyNode(datum.data.generation + 1, SEX_FEMALE));
                    } else {
                        parents.unshift(this.createEmptyNode(datum.data.generation + 1, SEX_MALE));
                    }
                }

                return parents;
            })
            // Calculate value properties of each node in the hierarchy
            .count();

        // Create partition layout
        const partitionLayout = d3.partition();

        // Map the node data to the partition layout. D3 describes the result
        // with its own node interface, whose readonly string `id` conflicts
        // with the numeric one assigned below, so take our own typed view.
        this._nodes = /** @type {HierarchyNode[]} */ (
            /** @type {unknown} */ (partitionLayout(this._root).descendants())
        );

        // Assign a unique ID to each node — d3 HierarchyNode `id` is a
        // readonly getter, so we attach our own property under a typed view.
        this._nodes.forEach((node, i) => {
            /** @type {any} */ (node).id = i;
        });

        // Append synthetic descendant nodes if enabled
        if (this._configuration.showDescendants) {
            this.initDescendants(datum);
        }
    }

    /**
     * Flat array of all partition nodes (root plus all descendants) in top-down
     * order, each augmented with a unique sequential id. Null until init() runs.
     *
     * @return {HierarchyNode[]|null}
     */
    get nodes() {
        return this._nodes;
    }

    /**
     * The root of the D3 partition hierarchy, exposed as our own typed view
     * (see the note in init() on the diverging `id` property). Null until
     * init() runs.
     *
     * @return {HierarchyNode|null}
     */
    get root() {
        return /** @type {HierarchyNode|null} */ (/** @type {unknown} */ (this._root));
    }

    /**
     * Creates synthetic D3-compatible nodes for the partners and children of
     * the central person and appends them to this._nodes. Also sets the
     * childScale on the configuration so Geometry can resolve angles for
     * negative depths.
     *
     * @param {NodeDatum} datum The raw JSON chart data object from the server
     *
     * @private
     */
    initDescendants(datum) {
        const partners = datum.partners || [];
        const unassignedChildren = datum.unassignedChildren || [];

        if (partners.length === 0 && unassignedChildren.length === 0) {
            this._configuration.childScale = null;

            return;
        }

        // Calculate the radian range for the descendant sector
        const gap = DESCENDANT_GAP_DEG * MATH_DEG2RAD;
        const fanDeg = this._configuration.fanDegree;

        const startPi = fanDeg === 90 ? 0 : -((fanDeg / 2) * MATH_DEG2RAD);
        const endPi = fanDeg === 90 ? fanDeg * MATH_DEG2RAD : (fanDeg / 2) * MATH_DEG2RAD;

        const startChildPi = endPi + gap;
        const endChildPi = Math.PI * 2 + startPi - gap;

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

        // Build family blocks with weights for angle distribution.
        // Reverse the block and children order so the oldest child appears
        // on the left and the youngest on the right (the descendant sector
        // runs right-to-left in radians, so reversing the data array
        // produces the natural left-to-right chronological reading order).
        const familyBlocks = [];

        for (const partner of [...partners].reverse()) {
            const children = (partner.children || []).slice().reverse();

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
                children: [...unassignedChildren].reverse(),
                weight: unassignedChildren.length,
            });
        }

        const totalWeight = familyBlocks.reduce((sum, block) => sum + block.weight, 0);

        // Check if proportional allocation gives < 20deg per partner arc.
        // If so, fall back to equal distribution.
        const minPartnerDeg = 20;
        let useEqualDistribution = false;

        if (totalWeight > 0) {
            const smallestPartnerDeg = (totalAngleDeg * 1) / totalWeight;

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
                    ? 1 / familyBlocks.length
                    : block.weight / totalWeight;
                const childFraction = blockFraction / block.children.length;

                smallestChildFraction = Math.min(smallestChildFraction, childFraction);
            }
        }

        /** @type {any} */ (this._configuration).smallestChildFraction = smallestChildFraction;

        this._createDescendantNodes(familyBlocks, rootXref, useEqualDistribution, totalWeight);
    }

    /**
     * Creates descendant D3 datum nodes for each family block (partner arcs at
     * depth -1, child arcs at depth -2) and pushes them into this._nodes.
     *
     * @param {FamilyBlock[]} familyBlocks          The family blocks to lay out
     * @param {string}        rootXref              The xref of the root individual
     * @param {boolean}       useEqualDistribution  Whether to distribute angles equally
     * @param {number}        totalWeight           Sum of all block weights
     *
     * @private
     */
    _createDescendantNodes(familyBlocks, rootXref, useEqualDistribution, totalWeight) {
        let nextId = this._nodes.length;
        let currentFraction = 0;

        for (const block of familyBlocks) {
            const blockFraction = useEqualDistribution
                ? 1 / familyBlocks.length
                : block.weight / totalWeight;

            const blockStart = currentFraction;
            const blockEnd = currentFraction + blockFraction;

            let partnerXref = "";
            let parentForChildren = null;

            if (block.partner) {
                partnerXref = block.partner.data.xref || "";
                parentForChildren = nextId++;

                this._nodes.push(
                    /** @type {any} */ ({
                        id: parentForChildren,
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
                    }),
                );
            }

            if (block.children.length > 0) {
                const childFraction = blockFraction / block.children.length;

                for (let i = 0; i < block.children.length; i++) {
                    this._nodes.push(
                        /** @type {any} */ ({
                            id: nextId++,
                            depth: -2,
                            x0: blockStart + i * childFraction,
                            x1: blockStart + (i + 1) * childFraction,
                            parent: null,
                            children: null,
                            height: 0,
                            value: 1,
                            data: block.children[i],
                            descendantType: "child",
                            partnerXref: partnerXref,
                            rootXref: rootXref,
                            syntheticParentId: parentForChildren,
                        }),
                    );
                }
            }

            currentFraction = blockEnd;
        }
    }

    /**
     * Assigns a familyColor property to every node's data payload. Must be
     * called after setPartnerMidpoints() and before any arc rendering so both
     * Person and Marriage can read the pre-computed colors.
     *
     * @param {FamilyColor} familyColor The color calculator instance
     */
    applyFamilyColors(familyColor) {
        this._nodes.forEach((datum) => {
            datum.data.data.familyColor = familyColor.getColor(datum);
        });
    }

    /**
     * Produces a minimal placeholder node so the partition layout always
     * receives two parent slots. The returned object has the same shape as a
     * real server node but with an empty xref and blank name fields.
     *
     * @param {number} generation Depth of the placeholder in the tree
     * @param {string} sex        SEX_MALE or SEX_FEMALE constant
     *
     * @return {NodeDatum}
     *
     * @private
     */
    createEmptyNode(generation, sex) {
        return {
            data: {
                id: 0,
                xref: "",
                url: "",
                updateUrl: "",
                generation: generation,
                name: "",
                firstNames: [],
                lastNames: [],
                preferredName: "",
                alternativeName: "",
                isAltRtl: false,
                sex: sex,
                timespan: "",
            },
        };
    }
}
