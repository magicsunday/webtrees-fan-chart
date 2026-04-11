/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import PngExport from "./export/png";
import SvgExport from "./export/svg";

/**
 * Instantiates the correct export handler (PNG or SVG) for a given type string.
 * New export formats can be added by extending EXPORT_TYPES without modifying
 * call sites.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class ExportFactory {
    /**
     * Registry mapping type strings to their export handler constructors.
     *
     * @type {Object<string, Function>}
     */
    static EXPORT_TYPES = {
        png: PngExport,
        svg: SvgExport,
    };

    /**
     * Creates an export instance for the given type.
     *
     * @param {string} type The export type ("png" or "svg")
     *
     * @return {PngExport|SvgExport}
     */
    createExport(type) {
        const ExportClass = ExportFactory.EXPORT_TYPES[type];

        if (!ExportClass) {
            throw new Error(`Unknown export type: ${type}`);
        }

        return new ExportClass();
    }
}
