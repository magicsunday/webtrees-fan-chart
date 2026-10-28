/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Returns the duration of an animation, which is zero when the user prefers reduced motion. A
 * browser without media queries keeps the animation.
 *
 * @param {number} duration The duration of the animation in milliseconds
 *
 * @return {number}
 */
export function motionDuration(duration) {
    const reduced =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    return reduced ? 0 : duration;
}
