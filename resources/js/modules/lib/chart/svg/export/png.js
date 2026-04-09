/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import Export from "../export";

/**
 * Export the chart as PNG image.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class PngExport extends Export {
    /**
     * Copies recursively all the styles from the list of container elements from the source
     * to the destination node.
     *
     * @param {Element} sourceNode
     * @param {Element} destinationNode
     */
    copyStylesInline(sourceNode, destinationNode) {
        const containerElements = ["svg", "g", "text", "textPath"];

        for (let i = 0; i < destinationNode.children.length; ++i) {
            const element = destinationNode.children[i];

            if (containerElements.indexOf(element.tagName) !== -1) {
                this.copyStylesInline(sourceNode.children[i], element);
                continue;
            }

            const computedStyle = window.getComputedStyle(sourceNode.children[i]);

            for (let j = 0; j < computedStyle.length; ++j) {
                element.style.setProperty(computedStyle[j], computedStyle.getPropertyValue(computedStyle[j]));
            }
        }
    }

    /**
     * Returns the view-box of the SVG. Mainly used to apply a padding around the chart.
     *
     * @param {SVGGraphicsElement} svg The SVG element
     *
     * @returns {number[]}
     */
    calculateViewBox(svg) {
        // Get bounding box
        const boundingBox = svg.getBBox();
        const padding = 50; // Padding on each side

        // Return calculated view box
        return [
            boundingBox.x - padding,
            boundingBox.y - padding,
            boundingBox.width + (padding * 2),
            boundingBox.height + (padding * 2),
        ];
    }

    /**
     *
     * @param {number} width
     * @param {number} height
     *
     * @returns {HTMLCanvasElement}
     */
    createCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        return canvas;
    }

    /**
     * Converts the given SVG into a PNG image. Resolves to the PNG data URL.
     *
     * @param {SVGGraphicsElement} svg    The SVG element
     * @param {number}             width  The width of the image
     * @param {number}             height The height of the image
     *
     * @returns {Promise<String>}
     */
    convertToDataUrl(svg, width, height) {
        return new Promise(resolve => {
            const data = (new XMLSerializer()).serializeToString(svg);
            const DOMURL = window.URL || window.webkitURL || window;
            const svgBlob = new Blob([ data ], { type: "image/svg+xml;charset=utf-8" });
            const url = DOMURL.createObjectURL(svgBlob);
            const img = new Image();

            img.onload = () => {
                const canvas = this.createCanvas(width, height);
                const ctx = canvas.getContext("2d");

                ctx.fillStyle = "rgb(255,255,255)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                DOMURL.revokeObjectURL(url);

                const imgURI = canvas
                    .toDataURL("image/png")
                    .replace("image/png", "image/octet-stream");

                resolve(imgURI);
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
    cloneSvg(svg) {
        return new Promise(resolve => {
            const newSvg = svg.cloneNode(true);

            resolve(newSvg);
        });
    }

    /**
     * Saves the given SVG as PNG image file.
     *
     * @param {Svg}    svg      The source SVG object
     * @param {string} fileName The file name
     */
    svgToImage(svg, fileName) {
        // 300 DPI (good quality for printing) / 96 DPI (common browser)
        //let scale = 300 / dpi();

        // Paper sizes (width, height) in pixel at 300 DPI/PPI
        const paperSize = {
            "A3": [4960, 3508],
            "A4": [3508, 2480],
            "A5": [2480, 1748],
        };

        this.cloneSvg(svg.node())
            .then(newSvg => this.inlineImages(newSvg))
            .then(newSvg => {
                this.copyStylesInline(svg.node(), newSvg);

                const viewBox = this.calculateViewBox(svg.node());
                const width = Math.max(paperSize["A3"][0], viewBox[2]);
                const height = Math.max(paperSize["A3"][1], viewBox[3]);

                newSvg.setAttribute("width", "" + width);
                newSvg.setAttribute("height", "" + height);
                newSvg.setAttribute("viewBox", "" + viewBox);

                return this.convertToDataUrl(newSvg, width, height);
            })
            .then(imgURI => this.triggerDownload(imgURI, fileName))
            .catch(() => {
                console.log("Failed to save chart as PNG image");
            });
    }
}
