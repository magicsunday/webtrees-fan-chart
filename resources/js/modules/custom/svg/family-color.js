/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import {
    depthHsl,
    familyBranchHsl,
    familyCenterHsl,
    hexToHsl,
} from "@magicsunday/webtrees-chart-lib";
import {SEX_FEMALE, SEX_MALE} from "../hierarchy.js";

/**
 * This class computes family-branch colors for person arcs. The two
 * base colors (paternal / maternal) are configurable via the chart
 * settings. Sub-branches derive their hue from the base color with
 * slight positional offsets. Saturation decreases and lightness
 * increases with depth so outer rings become more pastel.
 *
 * Designed to work for up to 10 generations. The HSL math primitives
 * (hexToHsl, depthBounds, depthHsl) live in @magicsunday/webtrees-chart-lib
 * so they can be shared with webtrees-pedigree-chart, which uses the same
 * paternal/maternal color scheme but a linear (not radial) geometry.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class FamilyColor {
    /**
     * @param {Configuration} configuration The application configuration
     */
    constructor(configuration) {
        this._configuration = configuration;

        // Convert the configured hex colors to HSL once
        this._paternalHsl = hexToHsl(configuration.paternalColor);
        this._maternalHsl = hexToHsl(configuration.maternalColor);
    }

    /**
     * Computes the family-branch color for a given datum. Both parents
     * of the same child share the same hue so couples appear as a
     * single colored family unit.
     *
     * @param {Object} datum The D3 partition datum
     *
     * @return {string|null} HSL color string, or null for the root node
     */
    getColor(datum) {
        // Empty ancestor segments keep their default gray appearance.
        // Empty partner arcs (unknown spouse) still get a family color.
        if ((datum.data.data.xref === "") && (datum.depth >= 0)) {
            return null;
        }

        // Descendants: each partner family gets its own hue via position-based rotation.
        // Children share their partner's hue at a slightly deeper depth.
        if (datum.depth < 0) {
            return this.getDescendantColor(datum);
        }

        // Center node: sex-based hue at depth 0
        if (datum.depth === 0) {
            if (datum.data.data.sex === SEX_MALE) {
                return familyCenterHsl(this._paternalHsl);
            }
            if (datum.data.data.sex === SEX_FEMALE) {
                return familyCenterHsl(this._maternalHsl);
            }
            return "hsl(0, 0%, 92%)";
        }

        // Depth 1: two main branches get their own hue from their own position.
        // Depth 2+: hue comes from the parent (= child in genealogical terms),
        // so both parents of the same child share the same hue.
        const refNode = (datum.depth >= 2 && datum.parent) ? datum.parent : datum;
        const refMidpoint = (refNode.x0 + refNode.x1) / 2;
        const isPaternal = refMidpoint < 0.5;
        const baseHsl = isPaternal ? this._paternalHsl : this._maternalHsl;
        const half = isPaternal ? refMidpoint / 0.5 : (refMidpoint - 0.5) / 0.5;

        return familyBranchHsl(baseHsl, datum.depth, half);
    }

    /**
     * Computes a family-branch color for descendant nodes. Each partner
     * family gets a unique hue derived from its angular position in the
     * descendant sector. Children share their partner's hue at a slightly
     * deeper saturation/lightness level.
     *
     * @param {Object} datum The D3 partition datum (depth < 0)
     *
     * @return {string} HSL color string
     *
     * @private
     */
    getDescendantColor(datum) {
        // Use the midpoint of the partner arc for hue derivation.
        // For children (depth -2), use the parent partner's midpoint.
        const partnerMidpoint = (datum.descendantType === "child" && datum.syntheticParentId)
            ? this._findPartnerMidpoint(datum.syntheticParentId)
            : (datum.x0 + datum.x1) / 2;

        // Blend between paternal and maternal base hues based on position,
        // producing pastel tones consistent with the ancestor color scheme.
        const patHue = this._paternalHsl[0];
        const matHue = this._maternalHsl[0];

        // Interpolate hue between the two base colors with a slight spread
        const hue = patHue + partnerMidpoint * ((matHue - patHue + 360) % 360);

        // Match the pastel range of inner ancestor rings
        const baseSat = (this._paternalHsl[1] + this._maternalHsl[1]) / 2;
        const baseLit = (this._paternalHsl[2] + this._maternalHsl[2]) / 2;
        const absDepth = Math.abs(datum.depth);

        return depthHsl(hue, [(patHue + matHue) / 2, baseSat, baseLit], absDepth);
    }

    /**
     * Finds the angular midpoint of a partner node by its ID.
     *
     * @param {string} partnerId The synthetic partner node ID
     *
     * @return {number} Midpoint in [0,1] range, or 0.5 as fallback
     *
     * @private
     */
    _findPartnerMidpoint(partnerId) {
        // Search through the hierarchy nodes for the partner
        // This is called from getColor which is invoked per-node during draw/update
        // where all nodes are available in the hierarchy
        return this._partnerMidpoints?.get(partnerId) ?? 0.5;
    }

    /**
     * Pre-computes partner midpoints for descendant color lookups.
     * Call once before computing colors for a new hierarchy.
     *
     * @param {Array} nodes All hierarchy nodes
     */
    setPartnerMidpoints(nodes) {
        this._partnerMidpoints = new Map();

        for (const node of nodes) {
            if (node.depth === -1) {
                this._partnerMidpoints.set(node.id, (node.x0 + node.x1) / 2);
            }
        }
    }

    /**
     * Returns the family color for a marriage arc. For the root node
     * (depth 0) this is the center node's own color since it spans
     * both lineages. For deeper nodes it is the first available
     * child's color (both parents share the same hue).
     *
     * @param {Object} datum The D3 data object
     *
     * @return {string|null}
     */
    static getMarriageColor(datum) {
        if (datum.depth === 0 || datum.depth < 0) {
            return datum.data.data.familyColor || null;
        }

        if (datum.children) {
            for (let i = 0; i < datum.children.length; i++) {
                if (datum.children[i].data.data.familyColor) {
                    return datum.children[i].data.data.familyColor;
                }
            }
        }

        return null;
    }

}
