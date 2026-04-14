import { describe, it, expect } from "@jest/globals";
import { truncateToFit, truncateNames } from "resources/js/modules/custom/svg/text-truncation";

function createMockTspan(initialWidth, charWidth = 8) {
    let text = "";
    let width = initialWidth;

    return {
        node: () => ({
            getComputedTextLength: () => width,
        }),
        text: (newText) => {
            if (newText === undefined) return text;
            text = newText;
            width = newText.length * charWidth;

            return undefined;
        },
        getText: () => text,
    };
}

describe("truncateToFit", () => {
    it("does not truncate text that fits", () => {
        const tspan = createMockTspan(50);

        tspan.text("Hello");

        const result = truncateToFit(tspan, 100);

        expect(result).toBe("Hello");
    });

    it("truncates text that exceeds maxWidth and appends ellipsis", () => {
        const tspan = createMockTspan(200, 10);

        tspan.text("A very long name that does not fit");

        const result = truncateToFit(tspan, 50);

        expect(result.endsWith("\u2026")).toBe(true);
        expect(result.length).toBeLessThan("A very long name that does not fit".length);
    });

    it("returns only ellipsis for single-char text that does not fit", () => {
        const tspan = createMockTspan(100, 100);

        tspan.text("X");

        const result = truncateToFit(tspan, 10);

        expect(result).toBe("\u2026");
    });

    it("removes trailing dot before appending ellipsis", () => {
        const tspan = createMockTspan(200, 10);

        tspan.text("Name with trailing.");

        const result = truncateToFit(tspan, 80);

        expect(result.endsWith(".\u2026")).toBe(false);
        expect(result.endsWith("\u2026")).toBe(true);
    });

    it("appends ellipsis even when truncated text may slightly exceed maxWidth", () => {
        const tspan = createMockTspan(50, 10);

        tspan.text("ABCDE");

        const result = truncateToFit(tspan, 40);

        expect(result.endsWith("\u2026")).toBe(true);
        // The truncated body (without ellipsis) must be shorter than the original text
        expect(result.slice(0, -1).length).toBeLessThan("ABCDE".length);
    });
});

describe("truncateNames", () => {
    function makeName(label, isPreferred = false, isLastName = false) {
        return { label, isPreferred, isLastName, isNameRtl: false };
    }

    it("returns names unchanged when they fit", () => {
        const names = [
            makeName("Karl"),
            makeName("Franz"),
            makeName("Rico", true),
            makeName("Sonntag", false, true),
        ];

        const result = truncateNames(names, 999, () => 100);

        expect(result.map(n => n.label)).toEqual(["Karl", "Franz", "Rico", "Sonntag"]);
    });

    it("abbreviates non-preferred given names first", () => {
        const names = [
            makeName("Karl"),
            makeName("Franz"),
            makeName("Rico", true),
            makeName("Sonntag", false, true),
        ];

        const measureFn = (text) => text.length * 10;

        // "Karl Franz Rico Sonntag" = 220px, "Sonntag Rico Franz K." = 210px,
        // "Sonntag Rico F. K." = 180px <= 180 — so only the non-preferred names get abbreviated
        const result = truncateNames(names, 180, measureFn);

        expect(result.map(n => n.label)).toEqual(["K.", "F.", "Rico", "Sonntag"]);
    });

    it("abbreviates preferred name after non-preferred ones", () => {
        const names = [
            makeName("Karl"),
            makeName("Rico", true),
            makeName("Sonntag", false, true),
        ];

        const measureFn = (text) => text.length * 10;

        // "Karl Rico Sonntag" = 170px, "Sonntag Rico K." = 150px, "Sonntag R. K." = 130px <= 130
        // So Karl and Rico get abbreviated but Sonntag stays
        const result = truncateNames(names, 130, measureFn);

        expect(result.map(n => n.label)).toEqual(["K.", "R.", "Sonntag"]);
    });

    it("abbreviates last names as final resort", () => {
        const names = [
            makeName("Rico", true),
            makeName("Sonntag", false, true),
        ];

        const measureFn = (text) => text.length * 10;

        const result = truncateNames(names, 30, measureFn);

        expect(result.map(n => n.label)).toEqual(["R.", "S."]);
    });

    it("does not mutate original array", () => {
        const names = [
            makeName("Karl"),
            makeName("Sonntag", false, true),
        ];

        const measureFn = (text) => text.length * 10;
        truncateNames(names, 30, measureFn);

        expect(names[0].label).toBe("Karl");
    });
});
