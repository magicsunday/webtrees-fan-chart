/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * @typedef {Object} LabelElementData
 * @property {string}  label       Display text for this name part
 * @property {boolean} isPreferred Whether this is the preferred given name
 * @property {boolean} isLastName  Whether this is a last/family name
 * @property {boolean} isNameRtl   Whether this name part is right-to-left
 */

const ELLIPSIS = "\u2026";

/**
 * Progressively removes trailing characters from the text content of a
 * tspan element until the rendered width fits within maxWidth, then
 * appends an ellipsis. If the text already fits, returns it unchanged.
 *
 * Note: the appended ellipsis character is not included in the width check,
 * so the final rendered text may slightly exceed maxWidth. All call sites
 * already subtract padding (e.g. textPadding * 2) before passing maxWidth,
 * which absorbs the extra width of the ellipsis.
 *
 * @param {Object} tspan    D3 selection of a <tspan> element
 * @param {number} maxWidth Maximum allowed rendered width in pixels
 *
 * @returns {string} The final (possibly truncated) text
 */
export function truncateToFit(tspan, maxWidth) {
    let text = tspan.text();
    const originalText = text;

    while ((tspan.node().getComputedTextLength() > maxWidth) && (text.length > 1)) {
        text = text.slice(0, -1).trim();
        tspan.text(text);
    }

    if (text !== originalText || tspan.node().getComputedTextLength() > maxWidth) {
        // If a single character still does not fit, clear the text entirely
        if (tspan.node().getComputedTextLength() > maxWidth) {
            text = "";
        }

        // Remove trailing dot before adding ellipsis
        if (text.endsWith(".")) {
            text = text.slice(0, -1).trim();
        }

        text += ELLIPSIS;
        tspan.text(text);
    }

    return text;
}

/**
 * Reduces name parts to initial-letter abbreviations until the joined string
 * fits within availableWidth. Abbreviation order: non-preferred given names
 * first (least important), then the preferred given name, then last names
 * (never dropped entirely).
 *
 * @param {LabelElementData[]} names          Name parts to truncate
 * @param {number}             availableWidth Maximum pixel width for the full name string
 * @param {Function}           measureFn      Callback (text: string) => number that returns rendered width
 *
 * @returns {LabelElementData[]}
 */
export function truncateNames(names, availableWidth, measureFn) {
    // Shallow clone each name object to avoid mutating the caller's data.
    // This is safe because all LabelElementData fields are primitives
    // (label: string, isPreferred: bool, isLastName: bool, isNameRtl: bool).
    const workNames = names.map(name => ({...name}));
    let text = workNames.map(item => item.label).join(" ");

    if (measureFn(text) <= availableWidth) {
        return workNames;
    }

    const abbreviate = (predicate) => {
        for (let i = workNames.length - 1; i >= 0; i--) {
            if (predicate(workNames[i]) && (measureFn(text) > availableWidth)) {
                workNames[i].label = workNames[i].label.slice(0, 1) + ".";
                text = workNames.map(item => item.label).join(" ");
            }
        }
    };

    // Non-preferred given names first (least important)
    abbreviate(name => (name.isPreferred === false) && (name.isLastName === false));

    // Then the preferred given name
    abbreviate(name => name.isPreferred === true);

    // Last names as final resort
    abbreviate(name => name.isLastName === true);

    return workNames;
}
