/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * @import { HierarchyNode } from "../hierarchy.js"
 *
 * @typedef {object} LabelElementData
 * @property {string}  label
 * @property {boolean} [isPreferred]
 * @property {boolean} [isLastName]
 * @property {boolean} [isNickname]
 * @property {boolean|undefined} [isNameRtl] Undefined when the payload does not carry the flag
 */

/**
 * Splits the names of a person into the parts that the arc labels render.
 * The functions are pure, they read the datum and nothing else.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */

/**
 * Splits the individual's name into two arrays: first names and last names,
 * preserving the order they appear in the full name string. Each entry
 * carries flags for preferred-name underline and last-name bold styling.
 * Returns [firstNamesArray, lastNamesArray].
 *
 * @param {HierarchyNode} datum The D3 partition datum
 *
 * @return {LabelElementData[][]}
 */
export function createNamesData(datum) {
    /**
     * Name groups keyed by the position of their first part in the full
     * name, so Object.values() returns them in name order.
     *
     * @type {Object<number, LabelElementData[]>}
     */
    const names = {};
    let minPosFirstnames = Number.MAX_SAFE_INTEGER;
    let minPosLastnames = Number.MAX_SAFE_INTEGER;

    let firstnameOffset = 0;
    /** @type {Map<number, LabelElementData>} */
    const firstnameMap = new Map();

    // Iterate over the individual name components and determine their position in the overall
    // name and insert the component at the corresponding position in the result object.
    for (const firstName of datum.data.data.firstNames) {
        const pos = datum.data.data.name.indexOf(firstName, firstnameOffset);

        if (pos !== -1) {
            firstnameOffset = pos + firstName.length;

            if (pos < minPosFirstnames) {
                minPosFirstnames = pos;
            }

            firstnameMap.set(pos, {
                label: firstName,
                isPreferred: firstName === datum.data.data.preferredName,
                isLastName: false,
                isNameRtl: datum.data.data.isNameRtl,
            });
        }
    }

    // Insert the optional nickname (e.g. "Chalky") into the first-names
    // group when getShowNicknames is enabled and the GEDCOM has a NICK.
    // Adding it to the firstname map keeps it inside the same slot as the
    // given names (text rendering iterates only [FIRST_NAMES, LAST_NAMES]
    // slots), and position-keyed iteration places it after the given names
    // before the surname slot starts.
    const nickname = datum.data.data.nickname;

    if (nickname && nickname !== "") {
        const nickQuoted = `"${nickname}"`;
        const nickPos = datum.data.data.name.indexOf(nickQuoted);

        if (nickPos !== -1) {
            firstnameMap.set(nickPos, {
                label: nickQuoted,
                isPreferred: false,
                isLastName: false,
                isNickname: true,
                isNameRtl: datum.data.data.isNameRtl,
            });
        }
    }

    names[minPosFirstnames] = [...firstnameMap].map(([, value]) => value);

    let lastnameOffset = 0;
    /** @type {Map<number, LabelElementData>} */
    const lastnameMap = new Map();

    for (const lastName of datum.data.data.lastNames) {
        let pos;

        // Check if last name already exists in first names list, in case first name equals last name
        do {
            pos = datum.data.data.name.indexOf(lastName, lastnameOffset);

            if (pos !== -1 && firstnameMap.has(pos)) {
                lastnameOffset = pos + lastName.length;
            }
        } while (pos !== -1 && firstnameMap.has(pos));

        if (pos !== -1) {
            lastnameOffset = pos;

            if (pos < minPosLastnames) {
                minPosLastnames = pos;
            }

            lastnameMap.set(pos, {
                label: lastName,
                isPreferred: false,
                isLastName: true,
                isNameRtl: datum.data.data.isNameRtl,
            });
        }
    }

    names[minPosLastnames] = [...lastnameMap].map(([, value]) => value);

    // Extract the values (keys don't matter anymore)
    return Object.values(names);
}

/**
 * Splits the alternative name into per-word LabelElementData entries, each
 * marked with the isAltRtl flag for correct bidirectional spacing.
 *
 * @param {HierarchyNode} datum The D3 partition datum
 *
 * @return {LabelElementData[]}
 */
export function createAlternativeNamesData(datum) {
    return datum.data.data.alternativeName.split(/\s+/).map((word) => ({
        label: word,
        isPreferred: false,
        isLastName: false,
        isNameRtl: datum.data.data.isAltRtl,
    }));
}
