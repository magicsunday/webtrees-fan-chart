/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * The elements that a rendered name may be wrapped in, and the attributes that they carry. The name
 * markup of an individual holds span and q, and bdi is tolerated as well, since core uses it for the
 * names of other records. Every other element and every other attribute is left out, and an
 * attribute value outside its list is left out as well.
 *
 * @type {ReadonlyMap<string, ReadonlySet<string>>}
 */
const ALLOWED_ELEMENTS = new Map([
    ["span", new Set(["class", "dir", "translate"])],
    ["q", new Set(["class", "dir", "translate"])],
    ["bdi", new Set(["class", "dir", "translate"])],
]);

/**
 * The attributes whose value has to be one of a fixed list.
 *
 * @type {ReadonlyMap<string, ReadonlySet<string>>}
 */
const ALLOWED_VALUES = new Map([
    ["dir", new Set(["auto", "ltr", "rtl"])],
    ["translate", new Set(["yes", "no"])],
]);

/**
 * Copies the child nodes of a parsed node into the target. An element of the allowlist is created
 * anew in the document of the target with its allowed attributes, so no node of the parsed document
 * is adopted. Any other element is replaced by the copies of its own children, so its text stays
 * and an allowed element nested in it is kept. The content of a template element is not a child
 * of it and is dropped, and so is a comment or processing instruction.
 *
 * @param {Node} source The parsed node whose children are copied
 * @param {Node} target The node that receives the copies
 *
 * @private
 */
function copyChildren(source, target) {
    for (const child of source.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            target.appendChild(document.createTextNode(child.textContent ?? ""));
            continue;
        }

        if (child.nodeType !== Node.ELEMENT_NODE) {
            continue;
        }

        const element = /** @type {Element} */ (child);
        const allowedAttributes = ALLOWED_ELEMENTS.get(element.localName);

        if (allowedAttributes === undefined) {
            copyChildren(element, target);
            continue;
        }

        const copy = document.createElement(element.localName);

        for (const name of allowedAttributes) {
            const value = element.getAttribute(name);

            if (value !== null && (ALLOWED_VALUES.get(name)?.has(value) ?? true)) {
                copy.setAttribute(name, value);
            }
        }

        copyChildren(element, copy);
        target.appendChild(copy);
    }
}

/**
 * Replaces the content of the target with the given markup, reduced to the inline elements of a
 * rendered name. The markup is parsed into an inert document and copied node by node, so a
 * disallowed element never becomes an element of the page, and the target is never assigned through
 * innerHTML.
 *
 * @param {Element} target The element whose content is replaced
 * @param {string}  markup The markup of the server
 */
export function setInlineMarkup(target, markup) {
    const parsed = new DOMParser().parseFromString(markup, "text/html");
    const fragment = document.createDocumentFragment();

    copyChildren(parsed.body, fragment);
    target.replaceChildren(fragment);
}
