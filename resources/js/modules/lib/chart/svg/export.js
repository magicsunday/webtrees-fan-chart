/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * Base export class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Export {
    /**
     * Converts all external <image> href attributes in the given SVG node
     * to inline base64 data URIs so they survive serialization.
     *
     * @param {Node} svgNode The SVG (or cloned SVG) element
     *
     * @returns {Promise<Node>}
     */
    inlineImages(svgNode) {
        const images = svgNode.querySelectorAll("image");

        const promises = Array.from(images).map(img => {
            const href = img.getAttribute("href") || img.getAttributeNS("http://www.w3.org/1999/xlink", "href");

            if (!href || href.startsWith("data:")) {
                return Promise.resolve();
            }

            return fetch(href)
                .then(response => response.blob())
                .then(blob => new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        img.setAttribute("href", reader.result);
                        resolve();
                    };
                    reader.readAsDataURL(blob);
                }))
                .catch(() => {
                    // Silently skip images that cannot be fetched
                });
        });

        return Promise.all(promises).then(() => svgNode);
    }

    /**
     * Triggers the download by creating a new anchor element and simulate a mouse click on it.
     *
     * @param {string} imgURI   The image URI data stream
     * @param {string} fileName The file name to use in the download dialog
     */
    triggerDownload(imgURI, fileName) {
        const event = new MouseEvent("click", {
            view: window,
            bubbles: false,
            cancelable: true,
        });

        const anchor = document.createElement("a");
        anchor.setAttribute("download", fileName);
        anchor.setAttribute("href", imgURI);
        anchor.setAttribute("target", "_blank");
        anchor.dispatchEvent(event);
    }
}
