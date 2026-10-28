import { describe, it, expect, beforeEach } from "@jest/globals";
import { initHelpPopover } from "resources/js/modules/help-popover.js";

function setupDom() {
    document.body.innerHTML = `
        <div class="position-relative d-inline-block">
            <button class="btn-help" aria-expanded="false" aria-controls="fan-chart-help-popover">
                Help
            </button>
            <div id="fan-chart-help-popover" class="help-popover d-none" role="region"></div>
        </div>
    `;
}

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
