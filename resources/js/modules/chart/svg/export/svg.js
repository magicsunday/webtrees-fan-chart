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

        //
        // $(document).ready(function() {
        //     $.when($.get("test.css"))
        //         .done(function(response) {
        //             $('<style />').text(response).appendTo($('head'));
        //             $('div').html(response);
        //         });
        // })

        // let containerElements = ["svg", "g", "text", "textPath"];
        //
        // for (let i = 0; i < destinationNode.childNodes.length; ++i) {
        //     let child = destinationNode.childNodes[i];
        //
        //     if (containerElements.indexOf(child.tagName) !== -1) {
        //         this.copyStylesInline(sourceNode.childNodes[i], child);
        //         continue;
        //     }
        //
        //     let computedStyle = window.getComputedStyle(sourceNode.childNodes[i]);
        //
        //     // let computedStyle = sourceNode.childNodes[i].currentStyle
        //     //    || ((sourceNode.childNodes[i] instanceof Element) && window.getComputedStyle(sourceNode.childNodes[i]));
        //
        //     if (computedStyle === null) {
        //         continue;
        //     }
        //
        //     for (let j = 0; j < computedStyle.length; ++j) {
        //         child.style.setProperty(computedStyle[j], computedStyle.getPropertyValue(computedStyle[j]));
        //     }
        // }
    }

    /**
     *
     * @param {Svg}    svg     The source SVG object
     * @param {string} size    The paper size format of the output image (A3, A4 or A5)
     * @param {string} cssFile The CSS file used together with the SVG
     */
    svgToImage(svg, size, cssFile)
    {
        let fileName = "fan-chart.svg";

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
