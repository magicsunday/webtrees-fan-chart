/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * Abstract base class for chart export. Provides shared helpers for inlining
 * external images as base64 data URIs and for triggering a file download
 * via a programmatically created anchor element.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export default class Export {
    /**
     * Fetches each external <image href> in the SVG node and replaces it with
     * a base64 data URI. Images that fail to load have their href removed so
     * the exported file does not contain broken references. Resolves to the
     * same svgNode once all fetches have settled.
     *
     * @param {Node} svgNode The SVG element (or a clone) whose images to inline
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
                .then(response => {
                    if (!response.ok) {
                        throw new Error(response.status);
                    }

                    return response.blob();
                })
                .then(blob => new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        img.setAttribute("href", reader.result);
                        resolve();
                    };
                    reader.readAsDataURL(blob);
                }))
                .catch(() => {
                    // Remove href so exported file shows no broken image
                    img.removeAttribute("href");
                });
        });

        return Promise.all(promises).then(() => svgNode);
    }

    /**
     * Initiates a file download by creating a temporary <a> element with the
     * given href and filename, then dispatching a synthetic click on it.
     *
     * @param {string} imgURI   The data URI or object URL to download
     * @param {string} fileName The suggested filename shown in the save dialog
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
