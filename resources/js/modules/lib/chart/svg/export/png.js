/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import Export from "../export";

/**
 * Exports the fan chart as a PNG image. Clones the SVG, inlines all external
 * images as base64, copies computed styles for text/path elements, sizes the
 * canvas to at least A3 at 300 DPI, and triggers a download.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class PngExport extends Export {
    /**
     * Recursively copies computed styles from source to destination for the
     * container element types listed (svg, g, text, textPath). Leaf elements
     * have every computed style property copied individually. Necessary because
     * the cloned SVG rendered to a canvas has no stylesheet access.
     *
     * @param {Element} sourceNode      The original live SVG element
     * @param {Element} destinationNode The corresponding node in the clone
     *
     * @private
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
     * Computes a viewBox that wraps the SVG's bounding box with 50 px padding
     * on each side. Used to set the exported image dimensions.
     *
     * @param {SVGGraphicsElement} svg The live SVG element (not the clone)
     *
     * @return {number[]} [x, y, width, height]
     *
     * @private
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
     * Creates and returns an off-screen canvas element sized to the given dimensions.
     *
     * @param {number} width  Canvas width in pixels
     * @param {number} height Canvas height in pixels
     *
     * @return {HTMLCanvasElement}
     *
     * @private
     */
    createCanvas(width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        return canvas;
    }

    /**
     * Serializes the SVG to a Blob, renders it onto a canvas with a white
     * background, and resolves with the resulting PNG data URL (using the
     * octet-stream MIME type to force a download in all browsers).
     *
     * @param {SVGGraphicsElement} svg    The SVG element to render (typically a clone)
     * @param {number}             width  Canvas width in pixels
     * @param {number}             height Canvas height in pixels
     *
     * @return {Promise<string>} Resolves to a PNG data URL
     *
     * @private
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
     * Returns a shallow deep-clone of the SVG DOM node wrapped in a Promise,
     * allowing it to be chained in the export promise pipeline.
     *
     * @param {SVGGraphicsElement} svg The live SVG element to clone
     *
     * @return {Promise<SVGGraphicsElement>}
     *
     * @private
     */
    cloneSvg(svg) {
        return new Promise(resolve => {
            const newSvg = svg.cloneNode(true);

            resolve(newSvg);
        });
    }

    /**
     * Full export pipeline: clones the SVG, inlines images, copies styles,
     * sizes the canvas to at least A3 at 300 DPI, converts to a PNG data URL,
     * and triggers a download. Logs a warning on failure but does not throw.
     *
     * @param {Svg}    svg      The source Svg wrapper object
     * @param {string} fileName The suggested download filename
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
