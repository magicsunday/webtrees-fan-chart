/**
 * See LICENSE.md file for further details.
 */

import * as d3 from "./../../../d3";
import Svg from "./../../svg";
import Export from "./../export";

/**
 * Export the chart as raw SVG image.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class SvgExport extends Export
{
    /**
     * Copies recursively all the styles from the list of container elements from the source
     * to the desination node.
     *
     * @param {string} cssFile
     * @param {Node} destinationNode
     */
    copyStylesInline(cssFile, destinationNode, callback)
    {
        d3.text(cssFile)
            .then((data) => {
                // Remove parent container selector as the CSS is included directly into the SVG element
                data = data.replace(/#webtrees-fan-chart-container /g, "");

                let style = document.createElement("style");

                destinationNode.prepend(style);

                style.type = "text/css";
                style.appendChild(document.createTextNode(data));

                // Execute callback function after fetching the CSS file is done
                callback();
            });
    }

    /**
     * Saves the given SVG as SVG image file.
     *
     * @param {Svg}    svg      The source SVG object
     * @param {string} cssFile  The CSS file used together with the SVG
     * @param (String} fileName The file name
     */
    svgToImage(svg, cssFile, fileName)
    {
        let oldSvg = svg.get().node();
        let newSvg = svg.get().node().cloneNode(true);

        this.copyStylesInline(cssFile, newSvg, () => {
            let data    = (new XMLSerializer()).serializeToString(newSvg);
            let DOMURL  = window.URL || window.webkitURL || window;
            let svgBlob = new Blob([ data ], { type: "image/svg+xml;charset=utf-8" });
            let url     = DOMURL.createObjectURL(svgBlob);
            let img     = new Image();

            img.onload = () => {
                this.triggerDownload(url, fileName);
            };

            img.src = url;
        });
    }
}
