import { describe, it, expect, beforeEach } from "@jest/globals";
import { initHelpPopover } from "resources/js/modules/help-popover.js";

function setupDom({ panel = false } = {}) {
    document.body.innerHTML = `
        <input type="hidden" name="showDetailPanel" value="0">
        <input type="checkbox" name="showDetailPanel" value="1"${panel ? " checked" : ""}>
        <div class="position-relative d-inline-block">
            <button class="btn-help" aria-expanded="false" aria-controls="fan-chart-help-popover">
                Help
            </button>
            <div id="fan-chart-help-popover" class="help-popover d-none" role="region">
                <table>
                    <tr data-help-mode="tooltip"><td>Right-click</td></tr>
                    <tr data-help-mode="panel" class="d-none"><td>Click or Enter</td></tr>
                    <tr id="always"><td>Ctrl + scroll</td></tr>
                </table>
            </div>
        </div>
    `;
}

const checkbox = () => document.querySelector('input[type="checkbox"][name="showDetailPanel"]');
const rowHidden = (mode) =>
    document.querySelector(`[data-help-mode="${mode}"]`).classList.contains("d-none");

const button = () => document.querySelector(".btn-help");
const popover = () => document.getElementById("fan-chart-help-popover");
const pressKey = (key) => document.dispatchEvent(new KeyboardEvent("keydown", { key }));

describe("initHelpPopover", () => {
    beforeEach(() => {
        setupDom();
        initHelpPopover();
    });

    it("opens the popover on click and exposes the state on the button", () => {
        button().click();

        expect(popover().classList.contains("d-none")).toBe(false);
        expect(button().getAttribute("aria-expanded")).toBe("true");
    });

    it("closes the popover on the next click", () => {
        button().click();
        button().click();

        expect(popover().classList.contains("d-none")).toBe(true);
        expect(button().getAttribute("aria-expanded")).toBe("false");
    });

    it("closes an open popover on Escape", () => {
        button().click();

        pressKey("Escape");

        expect(popover().classList.contains("d-none")).toBe(true);
        expect(button().getAttribute("aria-expanded")).toBe("false");
    });

    it("keeps an open popover open on other keys", () => {
        button().click();

        pressKey("Enter");
        pressKey("a");

        expect(popover().classList.contains("d-none")).toBe(false);
        expect(button().getAttribute("aria-expanded")).toBe("true");
    });

    it("leaves a closed popover closed on Escape", () => {
        pressKey("Escape");

        expect(popover().classList.contains("d-none")).toBe(true);
        expect(button().getAttribute("aria-expanded")).toBe("false");
    });

    it("does nothing on a page without a help button", () => {
        document.body.innerHTML = "";

        expect(() => initHelpPopover()).not.toThrow();
        expect(() => pressKey("Escape")).not.toThrow();
    });
});

describe("initHelpPopover modes", () => {
    it("shows the tooltip entries while the detail panel is off", () => {
        setupDom();
        initHelpPopover();

        expect(rowHidden("tooltip")).toBe(false);
        expect(rowHidden("panel")).toBe(true);
    });

    it("shows the panel entries while the detail panel is on", () => {
        setupDom({ panel: true });
        initHelpPopover();

        expect(rowHidden("tooltip")).toBe(true);
        expect(rowHidden("panel")).toBe(false);
    });

    it("follows the checkbox of the detail panel", () => {
        setupDom();
        initHelpPopover();

        checkbox().checked = true;
        checkbox().dispatchEvent(new Event("change", { bubbles: true }));

        expect(rowHidden("tooltip")).toBe(true);
        expect(rowHidden("panel")).toBe(false);

        checkbox().checked = false;
        checkbox().dispatchEvent(new Event("change", { bubbles: true }));

        expect(rowHidden("tooltip")).toBe(false);
        expect(rowHidden("panel")).toBe(true);
    });

    it("reads the checkbox again when the popover opens", () => {
        setupDom();
        initHelpPopover();

        checkbox().checked = true;
        document.querySelector(".btn-help").click();

        expect(rowHidden("tooltip")).toBe(true);
        expect(rowHidden("panel")).toBe(false);
    });

    it("leaves the entries that apply to both modes alone", () => {
        setupDom({ panel: true });
        initHelpPopover();

        expect(document.getElementById("always").classList.contains("d-none")).toBe(false);
    });

    it("keeps the markup as rendered when the page has no detail panel checkbox", () => {
        setupDom();
        checkbox().remove();
        initHelpPopover();

        expect(rowHidden("tooltip")).toBe(false);
        expect(rowHidden("panel")).toBe(true);
    });
});
