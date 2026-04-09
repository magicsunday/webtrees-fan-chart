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
     * Saturation decrease per generation (percentage points).
     * @type {number}
     */
    static SATURATION_STEP = 3.5;

    /**
     * Lightness increase per generation (percentage points).
     * @type {number}
     */
    static LIGHTNESS_STEP = 3;

    /**
     * Fixed generation reference so colors at a given depth stay
     * identical regardless of how many generations are displayed.
     * @type {number}
     */
    static MAX_GENERATIONS_REF = 10;

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
     * Computes the min-saturation and max-lightness bounds for the
     * given base HSL color across the full generation range.
     *
     * @param {number[]} baseHsl [h, s, l] base color
     *
     * @return {{minSaturation: number, maxLightness: number}}
     *
     * @private
     */
    static _depthBounds(baseHsl)
    {
        const span = FamilyColor.MAX_GENERATIONS_REF - 1;

        return {
            minSaturation: Math.max(20, baseHsl[1] - span * FamilyColor.SATURATION_STEP),
            maxLightness:  Math.min(90, baseHsl[2] + span * FamilyColor.LIGHTNESS_STEP),
        };
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

            const {minSaturation, maxLightness} = FamilyColor._depthBounds(baseHsl);

            return "hsl(" + baseHsl[0] + ", " + Math.max(10, minSaturation - FamilyColor.SATURATION_STEP) + "%, " + Math.min(93, maxLightness + FamilyColor.LIGHTNESS_STEP) + "%)";
        }

        // Depth 1: two main branches get their own hue from their own position.
        // Depth 2+: hue comes from the parent (= child in genealogical terms),
        // so both parents of the same child share the same hue.
        let refNode = datum;

        if ((datum.depth >= 2) && datum.parent) {
            refNode = datum.parent;
        }

        const refMidpoint = (refNode.x0 + refNode.x1) / 2;
        const isPaternal  = refMidpoint < 0.5;

        // Derive hue from the configured base color ± 30° spread
        const baseHsl = isPaternal ? this._paternalHsl : this._maternalHsl;
        const half    = isPaternal ? refMidpoint / 0.5 : (refMidpoint - 0.5) / 0.5;
        const hue     = ((baseHsl[0] + (half - 0.5) * 60) % 360 + 360) % 360;

        const {minSaturation, maxLightness} = FamilyColor._depthBounds(baseHsl);

        // Saturation increases with depth (inner = pastel, outer = vivid)
        const saturation = minSaturation + (datum.depth - 1) * FamilyColor.SATURATION_STEP;

        // Lightness decreases with depth (inner = light, outer = deeper)
        const lightness = maxLightness - (datum.depth - 1) * FamilyColor.LIGHTNESS_STEP;

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
        if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) {
            return [0, 0, 50];
        }

        hex = hex.replace(/^#/, "");

        const red   = parseInt(hex.substring(0, 2), 16) / 255;
        const green = parseInt(hex.substring(2, 4), 16) / 255;
        const blue  = parseInt(hex.substring(4, 6), 16) / 255;

        const max   = Math.max(red, green, blue);
        const min   = Math.min(red, green, blue);
        const delta = max - min;

        let hue        = 0;
        let saturation = 0;
        let lightness  = (max + min) / 2;

        if (delta !== 0) {
            saturation = lightness > 0.5
                ? delta / (2 - max - min)
                : delta / (max + min);

            if (max === red) {
                hue = ((green - blue) / delta + ((green < blue) ? 6 : 0)) * 60;
            } else if (max === green) {
                hue = ((blue - red) / delta + 2) * 60;
            } else {
                hue = ((red - green) / delta + 4) * 60;
            }
        }

        return [
            Math.round(hue),
            Math.round(saturation * 100),
            Math.round(lightness * 100)
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
