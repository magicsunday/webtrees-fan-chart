/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import PngExport from "./export/png";
import SvgExport from "./export/svg";

/**
 * The file export factory.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class ExportFactory {
    /**
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
     * @returns {PngExport|SvgExport}
     */
    createExport(type) {
        const ExportClass = ExportFactory.EXPORT_TYPES[type];

        if (!ExportClass) {
            throw new Error(`Unknown export type: ${type}`);
        }

        return new ExportClass();
    }
}
