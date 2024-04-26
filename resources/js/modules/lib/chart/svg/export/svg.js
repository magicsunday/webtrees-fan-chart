/**
 * This file is part of the package magicsunday/webtrees-descendants-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import * as d3 from "../../../d3";
import Export from "../export";

/**
 * Export the chart as raw SVG image.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-descendants-chart/
 */
export default class SvgExport extends Export
{
    /**
     * Replaces all CSS variables in the given CSS string with its computed style equivalent.
     *
     * @param {String} css
     *
     * @returns {String}
     */
    replaceCssVariables(css)
    {
        // Match all CSS selectors and their content
        const regexSelector = new RegExp("\\s*([^,}\\\/\\s].*)(?<!\\s).*{([\\s\\S]*?)}", "g");

        // Match all properties containing an CSS variable
        const regexVariables = new RegExp("\\s*([a-zA-Z0-9-_]+)??[\\s:=]*\\s*(\\bvar[(]-{2}[^)].+[)]+);", "g");

        let matchesSelector;
        let replacedCss = css;

        // Match all CSS selectors and their content
        while ((matchesSelector = regexSelector.exec(css)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (matchesSelector.index === regexSelector.lastIndex) {
                regexSelector.lastIndex++;
            }

            // Use the selector to look up the element in the DOM
            const element = document.querySelector(matchesSelector[1].trim());

            let matchesVariables;

            // Match all properties of the previous matched selector and check if it contains an CSS variable
            while ((matchesVariables = regexVariables.exec(matchesSelector[2])) !== null) {
                // This is necessary to avoid infinite loops with zero-width matches
                if (matchesVariables.index === regexVariables.lastIndex) {
                    regexVariables.lastIndex++;
                }

                // If the element was not found, remove the CSS variable and its property
                if (element === null) {
                    replacedCss = replacedCss.replace(matchesVariables[0], "");
                    continue;
                }

                // Get the computed style of the property
                const computedFillProperty = window
                    .getComputedStyle(element)
                    .getPropertyValue(matchesVariables[1]);

                // Replace the variable property with the computed style
                if (computedFillProperty !== "") {
                    replacedCss = replacedCss.replace(matchesVariables[2], computedFillProperty);
                }
            }
        }

        return replacedCss;
    }

    /**
     * Returns an unique sorted list of class names from all SVG elements.
     *
     * @param {NodeListOf<Element>} elements
     *
     * @returns {String[]}
     */
    extractClassNames(elements)
    {
        let classes = {};

        return Array.prototype
            .concat
            .apply(
                [],
                [...elements].map(function (element) {
                    return [...element.classList];
                })
            )
            // Reduce the list of classNames to a unique list
            .filter(name => !classes[name] && (classes[name] = true))
            .sort();
    }

    /**
     * Copies recursively all the styles from the list of container elements from the source
     * to the destination node.
     *
     * @param {String[]}           cssFiles
     * @param {SVGGraphicsElement} destinationNode
     * @param {String}             containerClassName The container class name
     *
     * @returns {Promise<SVGGraphicsElement>}
     */
    copyStylesInline(cssFiles, destinationNode, containerClassName)
    {
        // Assign class wt-global so theme related styles are correctly set in export
        destinationNode.classList.add("wt-global");

        const elementsWithClass = destinationNode.querySelectorAll("[class]");
        const usedClasses = this.extractClassNames(elementsWithClass);
        usedClasses.push("wt-global", containerClassName);

        const style = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "style"
        );

        let cssMap = new Map();

        return new Promise(resolve => {
            Promise
                .all(cssFiles.map(url => d3.text(url)))
                .then((filesData) => {
                    filesData.forEach(data => {
                        const classList = "\\." + usedClasses.join("|\\.");
                        const regex = new RegExp("(([^,}]*)(" + classList + "))\\b(?!-)[^}]*}", 'g')

                        let matches;

                        while ((matches = regex.exec(data)) !== null) {
                            // This is necessary to avoid infinite loops with zero-width matches
                            if (matches.index === regex.lastIndex) {
                                regex.lastIndex++;
                            }

                            // Store all matches CSS rules (merge duplicates into same entry)
                            cssMap.set(
                                JSON.stringify(matches[0]),
                                matches[0]
                            );
                        }
                    });

                    // Convert the CSS map to the final CSS string
                    let finalCss = [...cssMap.values()].flat().join("\n");

                    // Remove parent container selector as the CSS is included directly in the SVG element
                    finalCss = this.replaceCssVariables(finalCss);
                    finalCss = finalCss.replaceAll("." + containerClassName + " ", "");

                    style.appendChild(document.createTextNode(finalCss));
                    destinationNode.prepend(style);

                    resolve(destinationNode);
                });
        })
    }

    /**
     * Converts the given SVG into an object URL. Resolves to the object URL.
     *
     * @param {SVGGraphicsElement} svg The SVG element
     *
     * @returns {Promise<String>}
     */
    convertToObjectUrl(svg)
    {
        return new Promise(resolve => {
            let data = (new XMLSerializer()).serializeToString(svg);
            let DOMURL = window.URL || window.webkitURL || window;
            let svgBlob = new Blob([ data ], { type: "image/svg+xml;charset=utf-8" });
            let url = DOMURL.createObjectURL(svgBlob);
            let img = new Image();

            img.onload = () => {
                resolve(url);
            };

            img.src = url;
        });
    }

    /**
     * Clones the SVG element.
     *
     * @param {SVGGraphicsElement} svg
     *
     * @returns {Promise<SVGGraphicsElement>}
     */
    cloneSvg(svg)
    {
        return new Promise(resolve => {
            let newSvg = svg.cloneNode(true);

            resolve(newSvg);
        })
    }

    /**
     * Saves the given SVG as SVG image file.
     *
     * @param {Svg}      svg                The source SVG object
     * @param {String[]} cssFiles           The CSS files used together with the SVG
     * @param {String}   containerClassName The container class name
     * @param {String}   fileName           The output file name
     */
    svgToImage(svg, cssFiles, containerClassName, fileName)
    {
        this.cloneSvg(svg.get().node())
            .then(newSvg => this.copyStylesInline(cssFiles, newSvg, containerClassName))
            .then(newSvg => this.convertToObjectUrl(newSvg))
            .then(objectUrl => this.triggerDownload(objectUrl, fileName))
            .catch(() => {
                console.log("Failed to save chart as SVG image");
            });
    }
}
