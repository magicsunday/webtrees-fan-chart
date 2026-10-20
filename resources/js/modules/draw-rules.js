/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import FamilyColor from "./svg/family-color.js";

/**
 * @import { Selection } from "d3-selection"
 * @import Configuration from "./configuration.js"
 * @import Hierarchy from "./hierarchy.js"
 * @import { HierarchyNode } from "./hierarchy.js"
 */

/**
 * The rules that the initial render and the update of the chart share. Both
 * paths differ in how they join and animate elements, but they must agree on
 * which records are drawn at all, so the decisions live here once.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */

/**
 * Tells whether a person arc is drawn for the datum. Empty records are only
 * left out when empty segments are hidden, because the arcs would not be
 * drawn correctly otherwise. Descendant nodes (depth below zero) are always
 * drawn, since an empty partner arc is a structural placeholder.
 *
 * @param {HierarchyNode}  datum
 * @param {Configuration} configuration
 *
 * @return {boolean}
 */
export function isDrawnPerson(datum, configuration) {
    return datum.data.data.xref !== "" || !configuration.hideEmptySegments || datum.depth < 0;
}

/**
 * Tells whether a marriage arc is drawn for the datum, which is the case for a
 * node with children inside the displayed generations.
 *
 * @param {HierarchyNode}  datum
 * @param {Configuration} configuration
 *
 * @return {boolean}
 */
export function isMarriageParent(datum, configuration) {
    return Boolean(datum.children) && datum.depth < configuration.generations - 1;
}

/**
 * Computes the family colors of the hierarchy and marks the chart accordingly.
 * The partner midpoints are always set, the colors are applied only when
 * family colors are shown. The mark lets the stylesheet keep the text dark on
 * the pastel arc backgrounds, which would turn white in a dark theme otherwise.
 *
 * @param {Hierarchy}                     hierarchy
 * @param {Selection<any, any, any, any>} visual
 * @param {Configuration}                 configuration
 */
export function applyFamilyColorMode(hierarchy, visual, configuration) {
    const familyColor = new FamilyColor(configuration);
    familyColor.setPartnerMidpoints(hierarchy.nodes);

    if (configuration.showFamilyColors) {
        hierarchy.applyFamilyColors(familyColor);
    }

    visual.classed("family-colors", configuration.showFamilyColors);
}
