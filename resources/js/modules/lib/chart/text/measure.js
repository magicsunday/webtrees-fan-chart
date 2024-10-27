/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

let measureCanvas = null;

/**
 * Measures the given text and return its width depending on the used font (including size and weight).
 *
 * @param {string} text       The text whose length is to be determined
 * @param {string} fontFamily The font family used to calculate the length
 * @param {string} fontSize   The font size used to calculate the length
 * @param {number} fontWeight The font weight used to calculate the length
 *
 * @returns {number}
 */
export default function(text, fontFamily, fontSize, fontWeight = 400)
{
    if (measureCanvas === null) {
        measureCanvas = document.createElement("canvas");
    }

    const context = measureCanvas.getContext("2d");
    const font = `${fontWeight || ''} ${fontSize} ${fontFamily}`;

    if (context.font !== font) {
        context.font = font;
    }

    return context.measureText(text).width;
}
