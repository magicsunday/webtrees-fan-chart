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
        return new Promise(resolve => {
            Promise
                .all(cssFiles.map(url => d3.text(url)))
                .then((filesData) => {
                    filesData.forEach(data => {
                        // Remove parent container selector as the CSS is included directly in the SVG element
                        data = data.replace(new RegExp("." + containerClassName + " ", "g"), "");

                        let style = document.createElementNS("http://www.w3.org/2000/svg", "style");
                        style.appendChild(document.createTextNode(data));

                        destinationNode.prepend(style);
                    });

                    // Assign class wt-global so theme related styles are correctly set in export
                    destinationNode.classList.add("wt-global");

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
            let data    = (new XMLSerializer()).serializeToString(svg);
            let DOMURL  = window.URL || window.webkitURL || window;
            let svgBlob = new Blob([ data ], { type: "image/svg+xml;charset=utf-8" });
            let url     = DOMURL.createObjectURL(svgBlob);
            let img     = new Image();

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
