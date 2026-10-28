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
 * The entries marked with data-help-mode follow the checkbox of the detail
 * panel, so the popover describes the mode that the chart is in. A page without
 * a help button is left alone.
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

    const panelCheckbox = document.querySelector('input[type="checkbox"][name="showDetailPanel"]');

    /**
     * Shows the entries of the mode that the checkbox of the detail panel selects and
     * hides the entries of the other mode. Without the checkbox the markup stays as rendered.
     */
    const syncMode = () => {
        if (!panelCheckbox) {
            return;
        }

        const mode = /** @type {HTMLInputElement} */ (panelCheckbox).checked ? "panel" : "tooltip";

        popover.querySelectorAll("[data-help-mode]").forEach((entry) => {
            entry.classList.toggle("d-none", entry.getAttribute("data-help-mode") !== mode);
        });
    };

    syncMode();
    panelCheckbox?.addEventListener("change", syncMode);

    button.addEventListener("click", () => {
        syncMode();
        setOpen(popover.classList.contains("d-none"));
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !popover.classList.contains("d-none")) {
            setOpen(false);
        }
    });
}
