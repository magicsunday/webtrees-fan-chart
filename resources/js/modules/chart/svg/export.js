/**
 * See LICENSE.md file for further details.
 */

import Svg from "./../svg";

/**
 * The class handles all the text and path elements.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Export
{
    /**
     * Copies recursively all the styles from the list of container elements from the source
     * to the desination node.
     *
     * @param {Node} sourceNode
     * @param {Node} destinationNode
     */
    copyStylesInline(sourceNode, destinationNode)
    {
        let containerElements = ["svg", "g", "text", "textPath"];

        for (let i = 0; i < destinationNode.childNodes.length; ++i) {
            let child = destinationNode.childNodes[i];

            if (containerElements.indexOf(child.tagName) !== -1) {
                this.copyStylesInline(sourceNode.childNodes[i], child);
                continue;
            }

            let computedStyle = window.getComputedStyle(sourceNode.childNodes[i]);

            // let computedStyle = sourceNode.childNodes[i].currentStyle
            //    || ((sourceNode.childNodes[i] instanceof Element) && window.getComputedStyle(sourceNode.childNodes[i]));

            if (computedStyle === null) {
                continue;
            }

            for (let j = 0; j < computedStyle.length; ++j) {
                child.style.setProperty(computedStyle[j], computedStyle.getPropertyValue(computedStyle[j]));
            }
        }
    }

    /**
     * Triggers the download by creating a new anchor element an simulate a mouse click on it.
     *
     * @param {string} imgURI   The image URI data stream
     * @param {string} fileName The file name to use in the download dialog
     */
    triggerDownload(imgURI, fileName)
    {
        let event = new MouseEvent("click", {
            view: window,
            bubbles: false,
            cancelable: true
        });

        let a = document.createElement("a");
        a.setAttribute("download", fileName);
        a.setAttribute("href", imgURI);
        a.setAttribute("target", "_blank");
        a.dispatchEvent(event);
    }

    /**
     * Returns the viewbox of the SVG. Mainly used to apply a padding around the chart.
     *
     * @param {SVGGraphicsElement} area
     *
     * @returns {number[]}
     */
    calculateViewBox(area)
    {
        // Get bounding box
        const boundingBox = area.getBBox();
        const padding     = 50;   // Padding on each side

        // Return calculated view box
        return [
            boundingBox.x - padding,
            boundingBox.y - padding,
            boundingBox.width + (padding * 2),
            boundingBox.height + (padding * 2)
        ];
    }

    /**
     *
     * @param {Svg}    svg  The source SVG object
     * @param {string} size The paper size format of the output image (A3, A4 or A5)
     */
    svgToImage(svg, size)
    {
        // Paper sizes (width, height) in pixel at 300 DPI/PPI
        const paperSize = {
            'A3': [4960, 3508],
            'A4': [3508, 2480],
            'A5': [2480, 1748]
        };

        let fileName = "fan-chart.png";

        let oldSvg = svg.get().node();
        let newSvg = svg.get().node().cloneNode(true);

        this.copyStylesInline(oldSvg, newSvg);

        const width  = paperSize[size][0];
        const height = paperSize[size][1];

        newSvg.setAttribute("width", width);
        newSvg.setAttribute("height", height);
        newSvg.setAttribute("viewBox", this.calculateViewBox(svg.visual.node()));

        let canvas    = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;

        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let data    = (new XMLSerializer()).serializeToString(newSvg);
        let DOMURL  = window.URL || window.webkitURL || window;
        let svgBlob = new Blob([ data ], { type: "image/svg+xml;charset=utf-8" });
        let url     = DOMURL.createObjectURL(svgBlob);
        let img     = new Image();

        img.onload = () => {
            ctx.drawImage(img, 0, 0);

            DOMURL.revokeObjectURL(url);

            if ((typeof navigator !== "undefined") && navigator.msSaveOrOpenBlob) {
                let blob = canvas.msToBlob();
                navigator.msSaveOrOpenBlob(blob, fileName);
            } else {
                let imgURI = canvas
                    .toDataURL("image/png")
                    .replace("image/png", "image/octet-stream");

                this.triggerDownload(imgURI, fileName);
            }
        };

        img.src = url;
    }
}
