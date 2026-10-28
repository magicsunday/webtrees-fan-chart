/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * Wires the help button of the toolbar to its popover: a click toggles the
 * popover, the state is exposed through aria-expanded on the button, and Escape
 * closes an open popover. The button points to the popover with aria-controls.
 * A page without a help button is left alone.
 */
export function initHelpPopover() {
    const button = document.querySelector(".btn-help");
    const popoverId = button?.getAttribute("aria-controls");
    const popover = popoverId ? document.getElementById(popoverId) : null;

    if (!button || !popover) {
        return;
    }

    /**
     * Shows or hides the popover and mirrors the state on the button.
     *
     * @param {boolean} open Whether the popover is shown
     */
    const setOpen = (open) => {
        popover.classList.toggle("d-none", !open);
        button.setAttribute("aria-expanded", String(open));
    };

    button.addEventListener("click", () => {
        setOpen(popover.classList.contains("d-none"));
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !popover.classList.contains("d-none")) {
            setOpen(false);
        }
    });
}
