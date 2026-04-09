/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import {SEX_FEMALE, SEX_MALE} from "../hierarchy";

/**
 * This class computes family-branch colors for person arcs. The two
 * base colors (paternal / maternal) are configurable via the chart
 * settings. Sub-branches derive their hue from the base color with
 * slight positional offsets. Saturation decreases and lightness
 * increases with depth so outer rings become more pastel.
 *
 * Designed to work for up to 10 generations.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class FamilyColor
{
    /**
     * Constructor.
     *
     * @param {Configuration} configuration The application configuration
     */
    constructor(configuration)
    {
        this._configuration = configuration;

        // Convert the configured hex colors to HSL once
        this._paternalHsl = FamilyColor.hexToHsl(configuration.paternalColor);
        this._maternalHsl = FamilyColor.hexToHsl(configuration.maternalColor);
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
    getColor(datum)
    {
        // Empty segments keep their default gray appearance
        if (datum.data.data.xref === "") {
            return null;
        }

        // Fixed reference so colors at a given depth stay identical
        // regardless of how many generations are displayed.
        const maxGenerations = 10;
        const saturationStep = 3.5;
        const lightnessStep  = 3;

        // Center node: sex-based hue at depth 0 of the same curve
        if (datum.depth === 0) {
            let baseHsl;

            if (datum.data.data.sex === SEX_MALE) {
                baseHsl = this._paternalHsl;
            } else if (datum.data.data.sex === SEX_FEMALE) {
                baseHsl = this._maternalHsl;
            } else {
                return "hsl(0, 0%, 92%)";
            }

            const minSaturation = Math.max(20, baseHsl[1] - (maxGenerations - 1) * saturationStep);
            const maxLightness  = Math.min(90, baseHsl[2] + (maxGenerations - 1) * lightnessStep);

            return "hsl(" + baseHsl[0] + ", " + Math.max(10, minSaturation - saturationStep) + "%, " + Math.min(93, maxLightness + lightnessStep) + "%)";
        }

        // Depth 1: two main branches get their own hue from their own position.
        // Depth 2+: hue comes from the parent (= child in genealogical terms),
        // so both parents of the same child share the same hue.
        let refNode = datum;

        if (datum.depth >= 2 && datum.parent) {
            refNode = datum.parent;
        }

        const refMidpoint = (refNode.x0 + refNode.x1) / 2;
        const ownMidpoint = (datum.x0 + datum.x1) / 2;
        const isPaternal  = ownMidpoint < 0.5;

        // Derive hue from the configured base color ± 30° spread
        const baseHsl = isPaternal ? this._paternalHsl : this._maternalHsl;
        const half    = isPaternal ? refMidpoint / 0.5 : (refMidpoint - 0.5) / 0.5;
        const hue     = baseHsl[0] + (half - 0.5) * 60;

        // Saturation increases with depth (inner = pastel, outer = vivid)
        const minSaturation = Math.max(20, baseHsl[1] - (maxGenerations - 1) * saturationStep);
        const saturation    = minSaturation + (datum.depth - 1) * saturationStep;

        // Lightness decreases with depth (inner = light, outer = deeper)
        const maxLightness = Math.min(90, baseHsl[2] + (maxGenerations - 1) * lightnessStep);
        const lightness    = maxLightness - (datum.depth - 1) * lightnessStep;

        return "hsl(" + hue + ", " + saturation + "%, " + lightness + "%)";
    }

    /**
     * Converts a hex color string to an [h, s, l] array.
     *
     * @param {string} hex The hex color (e.g. "#3b82b0")
     *
     * @return {number[]} [hue (0-360), saturation (0-100), lightness (0-100)]
     */
    static hexToHsl(hex)
    {
        hex = hex.replace(/^#/, "");

        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;

        const max   = Math.max(r, g, b);
        const min   = Math.min(r, g, b);
        const delta = max - min;

        let h = 0;
        let s = 0;
        let l = (max + min) / 2;

        if (delta !== 0) {
            s = l > 0.5
                ? delta / (2 - max - min)
                : delta / (max + min);

            if (max === r) {
                h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
            } else if (max === g) {
                h = ((b - r) / delta + 2) * 60;
            } else {
                h = ((r - g) / delta + 4) * 60;
            }
        }

        return [
            Math.round(h),
            Math.round(s * 100),
            Math.round(l * 100)
        ];
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
    static getMarriageColor(datum)
    {
        if (datum.depth === 0) {
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
