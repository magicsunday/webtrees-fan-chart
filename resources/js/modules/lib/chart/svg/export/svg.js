/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import Export from "../export";

/**
 * Export the chart as raw SVG image.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class SvgExport extends Export
{
    constructor()
    {
        super();

        // Styles to ignore
        this._obsoleteStyles = [
            'd',
            'cursor',
            'user-select',
            'block-size',
            'inline-size',
            'width',
            'height',
            'column-rule-color',
            'vertical-align',
            'border-collapse',
            'border-spacing',
            'place-content',
            'place-items',
            'place-self',
            'bottom',
            'top',
            'right',
            'left',
            'column-fill',
            'gap',
            'column-rule-style',
            'column-rule-width',
            'column-span',
            'empty-cells',
            'flex',
            'flex-flow',
            'grid-area',
            'order',
            'shape-image-threshold',
            'shape-margin',
            'shape-outside',
            'table-layout',
            'z-index'
        ];

        this._defaultStyles = {};
    }

    /**
     * Create a sandbox, used to query the default styles of an element.
     *
     * @param {Node} node
     *
     * @returns {Node}
     */
    createSandbox(node)
    {
        this._sandbox = document.createElement('iframe');
        this._sandbox.style.visibility = 'hidden';
        this._sandbox.style.position = 'fixed';

        document.body.appendChild(this._sandbox);

        this._sandbox.contentWindow.document.write(
            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Sandbox</title></head><body></body></html>'
        );

        return node;
    }

    /**
     * Returns the default style declaration of an element. To achieve this, a new element is created using
     * the tag name and added to the sandbox.
     *
     * @param {Node|Element} source
     *
     * @returns {CSSStyleDeclaration}
     */
    getDefaultComputedStyle(source)
    {
        if (this._defaultStyles[source.tagName]) {
            return this._defaultStyles[source.tagName];
        }

        const defaultElement = this._sandbox.contentWindow.document.createElement(source.tagName);
        defaultElement.textContent = '\u200b';

        this._sandbox.contentWindow.document.body.appendChild(defaultElement);
        const defaultStyleDeclaration = this._sandbox.contentWindow.getComputedStyle(defaultElement);
        this._sandbox.contentWindow.document.body.removeChild(defaultElement);

        this._defaultStyles[source.tagName] = defaultStyleDeclaration;
        return this._defaultStyles[source.tagName];
    }

    /**
     * Clones the style information of the source node and appends it to the target node.
     *
     * @param {Node|Element}        source
     * @param {Node|Element}        target
     * @param {CSSStyleDeclaration} parentStyleDeclaration
     *
     * @returns {Node}
     */
    cloneStyles(source, target, parentStyleDeclaration)
    {
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
                if (name.startsWith('--')) {
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
                    if (name === 'font-family') {
                        targetStyle.setProperty(name, '"Segoe UI", Arial, sans-serif');
                    }
                }
            });

        return Promise.resolve(target);
    }

    /**
     * Clones the passed node and its child nodes. Then the duplicated style information is
     * appended to the cloned node.
     *
     * @param {Node}                source
     * @param {CSSStyleDeclaration} sourceStyleDeclaration
     *
     * @returns {Promise<Node>}
     */
    createNodeDuplicate(source, sourceStyleDeclaration)
    {
        return Promise
            .resolve(source)
            .then(clone => clone.cloneNode(false))
            .then(clone => this.cloneChildren(source, clone))
            .then(clone => this.cloneStyles(source, clone, sourceStyleDeclaration));
    }

    /**
     * Clones all child nodes of the passed source parent node and adds the copy to the cloned parent.
     *
     * @param {Node} source
     * @param {Node} target
     *
     * @returns {Promise<Node>}
     */
    cloneChildren(source, target)
    {
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
     * Converts the given SVG into an object URL. Resolves to the object URL.
     *
     * @param {Node} svg The SVG element
     *
     * @returns {Promise<String>}
     */
    convertToObjectUrl(svg)
    {
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
     * Performs a cleanup task.
     *
     * @param {string} objectUrl
     *
     * @returns {string}
     */
    cleanUp(objectUrl)
    {
        // Remove the sandbox
        if (this._sandbox) {
            document.body.removeChild(this._sandbox);
            this._sandbox = null;
        }

        return objectUrl;
    }

    /**
     * Saves the given SVG as an SVG image file.
     *
     * @param {Svg}      svg                The source SVG object
     * @param {string[]} cssFiles           The CSS files used together with the SVG
     * @param {string}   containerClassName The container class name
     * @param {string}   fileName           The output file name
     */
    svgToImage(svg, cssFiles, containerClassName, fileName)
    {
        let node = svg.node();

        Promise
            .resolve(node)
            .then(node => this.createSandbox(node))
            .then(clone => clone.cloneNode(false))
            .then(clone => this.cloneStyles(node, clone, null))
            .then(clone => this.cloneChildren(node, clone))
            .then(clone => this.convertToObjectUrl(clone))
            .then(objectUrl => this.cleanUp(objectUrl))
            .then(objectUrl => this.triggerDownload(objectUrl, fileName))
            .catch((error) => {
                console.log("Failed to save chart as SVG image: " + error.message);
                console.log(error);
            });
    }
}
