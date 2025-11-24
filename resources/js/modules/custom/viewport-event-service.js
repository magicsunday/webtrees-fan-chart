/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

/**
 * Utility for managing viewport-related events.
 */
export default class ViewportEventService
{
    /**
     * @param {object} options
     * @param {() => import("../lib/d3").Selection|null|undefined} options.getContainer Function resolving the chart container selection.
     * @param {() => void} options.onUpdateViewBox Callback for recalculating the view box.
     * @param {() => void} options.onCenter Callback for recentering the chart.
     * @param {Document} [options.documentRef]
     * @param {Window} [options.windowRef]
     */
    constructor({ getContainer, onUpdateViewBox, onCenter, documentRef = document, windowRef = window })
    {
        this._getContainer       = getContainer;
        this._onUpdateViewBox    = onUpdateViewBox;
        this._onCenter           = onCenter;
        this._document           = documentRef;
        this._window             = windowRef;
        this._boundFullscreenHandler = this.handleFullscreenChange.bind(this);
        this._boundResizeHandler = this.handleResize.bind(this);
    }

    /**
     * Register resize and fullscreen listeners.
     */
    register()
    {
        this._document.addEventListener("fullscreenchange", this._boundFullscreenHandler);
        this._window.addEventListener("resize", this._boundResizeHandler);
    }

    /**
     * Trigger view-box recalculation.
     */
    resize()
    {
        this._onUpdateViewBox?.();
    }

    /**
     * Recenter the chart through the provided callback.
     */
    center()
    {
        this._onCenter?.();
    }

    /**
     * Handle viewport resizing.
     *
     * @private
     */
    handleResize()
    {
        this.resize();
    }

    /**
     * React to fullscreen changes and adjust the view box if the chart is affected.
     *
     * @private
     */
    handleFullscreenChange()
    {
        const parentNode        = this._getContainer?.()?.node?.();
        const fullscreenElement = this._document.fullscreenElement;

        if (!parentNode) {
            return;
        }

        const exitedFullscreen       = fullscreenElement === null;
        const fullscreenContainsNode = fullscreenElement?.contains?.(parentNode) ?? false;
        const nodeContainsFullscreen = parentNode.contains?.(fullscreenElement) ?? false;
        const isFullscreenTarget = fullscreenElement === parentNode
            || fullscreenContainsNode
            || nodeContainsFullscreen;

        this._document.documentElement?.toggleAttribute("fullscreen", !exitedFullscreen && isFullscreenTarget);

        if (exitedFullscreen || isFullscreenTarget) {
            this.resize();
        }
    }
}
