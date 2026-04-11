/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import Export from "../export";

/**
 * Exports the fan chart as a standalone SVG file. Deep-clones the live SVG
 * element while inlining all computed styles (excluding layout-only properties
 * that are meaningless in a static file) so the exported SVG renders correctly
 * in Inkscape and other viewers without the page stylesheet. External images
 * are inlined as base64 data URIs. Uses a hidden iframe as a sandbox to obtain
 * the browser's default style values for style-diffing.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class SvgExport extends Export {
    constructor() {
        super();

        // Styles to ignore
        this._obsoleteStyles = [
            "d",
            "cursor",
            "user-select",
            "block-size",
            "inline-size",
            "width",
            "height",
            "column-rule-color",
            "vertical-align",
            "border-collapse",
            "border-spacing",
            "place-content",
            "place-items",
            "place-self",
            "bottom",
            "top",
            "right",
            "left",
            "column-fill",
            "gap",
            "column-rule-style",
            "column-rule-width",
            "column-span",
            "empty-cells",
            "flex",
            "flex-flow",
            "grid-area",
            "order",
            "shape-image-threshold",
            "shape-margin",
            "shape-outside",
            "table-layout",
            "z-index",
        ];

        this._defaultStyles = {};
    }

    /**
     * Appends a hidden iframe to the document body that acts as a style sandbox.
     * The sandbox is used by getDefaultComputedStyle() to determine which styles
     * are browser defaults so they can be omitted from the exported SVG. Returns
     * node unchanged so the method can be chained in the promise pipeline.
     *
     * @param {Node} node The node being exported (passed through unchanged)
     *
     * @returns {Node}
     */
    createSandbox(node) {
        this._sandbox = document.createElement("iframe");
        this._sandbox.style.visibility = "hidden";
        this._sandbox.style.position = "fixed";

        document.body.appendChild(this._sandbox);

        this._sandbox.contentWindow.document.write(
            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Sandbox</title></head><body></body></html>',
        );

        return node;
    }

    /**
     * Returns the browser's default CSSStyleDeclaration for the given element's
     * tag name by creating a clean instance of that element in the sandbox.
     * Results are cached by tag name to avoid repeated DOM mutations.
     *
     * @param {Node|Element} source The element whose tag name is looked up
     *
     * @returns {CSSStyleDeclaration}
     */
    getDefaultComputedStyle(source) {
        if (this._defaultStyles[source.tagName]) {
            return this._defaultStyles[source.tagName];
        }

        const defaultElement = this._sandbox.contentWindow.document.createElement(source.tagName);
        defaultElement.textContent = "\u200b";

        this._sandbox.contentWindow.document.body.appendChild(defaultElement);
        const defaultStyleDeclaration = this._sandbox.contentWindow.getComputedStyle(defaultElement);
        this._sandbox.contentWindow.document.body.removeChild(defaultElement);

        this._defaultStyles[source.tagName] = defaultStyleDeclaration;

        return this._defaultStyles[source.tagName];
    }

    /**
     * Copies non-default, non-inherited computed styles from source to target.
     * Skips CSS variables, layout-only properties (from _obsoleteStyles), and
     * values that match either the browser default or the inherited parent value.
     * Forces a specific font-family on text elements for Inkscape compatibility.
     *
     * @param {Node|Element}        source                 The live source element
     * @param {Node|Element}        target                 The cloned target element
     * @param {CSSStyleDeclaration} parentStyleDeclaration The computed style of the source's parent, for inheritance diffing
     *
     * @returns {Node}
     */
    cloneStyles(source, target, parentStyleDeclaration) {
        if (!(target instanceof Element)) {
            return Promise.resolve(target);
        }

        const defaultStyleDeclaration = this.getDefaultComputedStyle(source);
        const sourceStyleDeclaration = window.getComputedStyle(source);
        const targetStyle = target.style;

        Array
            .from(sourceStyleDeclaration)
            .forEach((name) => {
                // Ignore CSS variables
                if (name.startsWith("--")) {
                    return;
                }

                // Ignore the following list of styles
                if (this._obsoleteStyles.indexOf(name) !== -1) {
                    return;
                }

                const sourceValue = sourceStyleDeclaration.getPropertyValue(name);
                const defaultValue = defaultStyleDeclaration[name];
                const parentValue = parentStyleDeclaration
                    ? parentStyleDeclaration.getPropertyValue(name)
                    : undefined;

                if (
                    ((sourceValue !== defaultValue) && (sourceValue !== parentValue))
                    || (parentStyleDeclaration && (sourceValue !== parentValue))
                ) {
                    const priority = sourceStyleDeclaration.getPropertyPriority(name);

                    if (priority) {
                        targetStyle.setProperty(name, sourceValue, priority);
                    } else {
                        targetStyle.setProperty(name, sourceValue);
                    }

                    // Force font family as native font stack may not work with Inkscape
                    if (name === "font-family") {
                        targetStyle.setProperty(name, '"Segoe UI", Arial, sans-serif');
                    }
                }
            });

        return Promise.resolve(target);
    }

    /**
     * Produces a deep clone of source with styles inlined: shallow-clones the
     * node, recursively clones children, then calls cloneStyles().
     *
     * @param {Node}                source                 The element to duplicate
     * @param {CSSStyleDeclaration} sourceStyleDeclaration The computed style of source's parent
     *
     * @returns {Promise<Node>}
     */
    createNodeDuplicate(source, sourceStyleDeclaration) {
        return Promise
            .resolve(source)
            .then(clone => clone.cloneNode(false))
            .then(clone => this.cloneChildren(source, clone))
            .then(clone => this.cloneStyles(source, clone, sourceStyleDeclaration));
    }

    /**
     * Sequentially duplicates each child of source (with inlined styles) and
     * appends the clones to target. Returns target once all children are done.
     *
     * @param {Node} source The element whose children are cloned
     * @param {Node} target The element to append cloned children to
     *
     * @returns {Promise<Node>}
     */
    cloneChildren(source, target) {
        let done = Promise.resolve();

        if (source.childNodes.length !== 0) {
            const sourceStyleDeclaration = window.getComputedStyle(source);

            Array
                .from(source.childNodes)
                .forEach((child) => {
                    done = done
                        .then(() => this.createNodeDuplicate(child, sourceStyleDeclaration))
                        .then((childClone) => {
                            if (childClone) {
                                target.appendChild(childClone);
                            }
                        });
                });
        }

        return done
            .then(() => target);
    }

    /**
     * Serializes the SVG to an SVG Blob and creates an object URL for it.
     * Resolves to the object URL once the browser has confirmed the Blob is
     * readable by loading it into a temporary Image element.
     *
     * @param {Node} svg The cloned, style-inlined SVG element
     *
     * @returns {Promise<string>} Resolves to a blob object URL
     */
    convertToObjectUrl(svg) {
        return new Promise(resolve => {
            const data = (new XMLSerializer()).serializeToString(svg);
            const domURL = window.URL || window.webkitURL || window;
            const svgBlob = new Blob([data], {type: "image/svg+xml;charset=utf-8"});
            const url = domURL.createObjectURL(svgBlob);
            const htmlImageElement = new Image();

            htmlImageElement.onload = () => {
                resolve(url);
            };

            htmlImageElement.src = url;
        });
    }

    /**
     * Removes the sandbox iframe from the document and returns the object URL
     * unchanged so it can be piped into triggerDownload().
     *
     * @param {string} objectUrl The blob URL to pass through
     *
     * @returns {string}
     */
    cleanUp(objectUrl) {
        // Remove the sandbox
        if (this._sandbox) {
            document.body.removeChild(this._sandbox);
            this._sandbox = null;
        }

        return objectUrl;
    }

    /**
     * Full SVG export pipeline: creates the style sandbox, deep-clones the
     * element with inlined styles, inlines images, converts to an object URL,
     * removes the sandbox, and triggers a download. Logs errors but does not
     * re-throw.
     *
     * @param {Svg}      svg                The source Svg wrapper object
     * @param {string[]} cssFiles           CSS files included in the page (currently unused, reserved for future embedding)
     * @param {string}   containerClassName The outer container CSS class (currently unused, reserved for future use)
     * @param {string}   fileName           The suggested download filename
     */
    svgToImage(svg, cssFiles, containerClassName, fileName) {
        const node = svg.node();

        Promise
            .resolve(node)
            .then(node => this.createSandbox(node))
            .then(clone => clone.cloneNode(false))
            .then(clone => this.cloneStyles(node, clone, null))
            .then(clone => this.cloneChildren(node, clone))
            .then(clone => this.inlineImages(clone))
            .then(clone => this.convertToObjectUrl(clone))
            .then(objectUrl => this.cleanUp(objectUrl))
            .then(objectUrl => this.triggerDownload(objectUrl, fileName))
            .catch((error) => {
                console.log("Failed to save chart as SVG image: " + error.message);
                console.log(error);
            });
    }
}
