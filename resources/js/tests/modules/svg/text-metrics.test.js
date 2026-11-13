import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import * as d3 from "resources/js/modules/d3";

const { default: TextMetrics, getTextMetrics } = await import(
    "resources/js/modules/svg/text-metrics"
);

const originalGetComputedStyle = window.getComputedStyle;

/**
 * Stands in for the cascade of the style sheets. The size comes from the inline style of the label
 * group, the weight from the class of the element itself.
 */
const computedStyleMock = jest.fn((node) => ({
    getPropertyValue: (name) => {
        if (name === "font-size") {
            return node.closest("g.name").style.fontSize;
        }

        return node.classList.contains("wt-chart-box-name-alt") ? "normal" : "700";
    },
}));

/**
 * Builds a label group with one text element per entry and returns the selections of the texts.
 *
 * @param {string}   fontSize The inline font size of the label group
 * @param {string[]} classes  The class attribute of each text element
 *
 * @returns {object[]}
 */
function createTexts(fontSize, classes) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    group.setAttribute("class", "name");
    group.style.fontSize = fontSize;
    document.body.appendChild(group);

    return classes.map((className) => {
        const text = d3.select(group).append("text").attr("class", className);

        return text;
    });
}

describe("TextMetrics", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        computedStyleMock.mockClear();
        Object.defineProperty(window, "getComputedStyle", {
            configurable: true,
            value: computedStyleMock,
        });
    });

    afterEach(() => {
        Object.defineProperty(window, "getComputedStyle", {
            configurable: true,
            value: originalGetComputedStyle,
        });
    });

    test("reads the computed style once for labels that share their styling", () => {
        const metrics = new TextMetrics({ style: jest.fn() });
        const texts = createTexts("12px", ["", "", "", "", ""]);

        const fonts = texts.map((text) => metrics.getFont(text));

        expect(fonts.every((font) => font.fontSize === "12px" && font.fontWeight === "700")).toBe(
            true,
        );

        // One read per property for the whole pass, however many labels there are
        expect(computedStyleMock).toHaveBeenCalledTimes(2);
    });

    test("keeps the weight of an element apart from one with another class", () => {
        const metrics = new TextMetrics({ style: jest.fn() });
        const [name, alternative] = createTexts("12px", ["", "wt-chart-box-name-alt"]);

        expect(metrics.getFont(name).fontWeight).toBe("700");
        expect(metrics.getFont(alternative).fontWeight).toBe("normal");
    });

    test("keeps the size of an element apart from one below a group with another size", () => {
        const metrics = new TextMetrics({ style: jest.fn() });
        const [small] = createTexts("10px", [""]);
        const [large] = createTexts("16px", [""]);

        expect(metrics.getFont(small).fontSize).toBe("10px");
        expect(metrics.getFont(large).fontSize).toBe("16px");
    });

    test("reads the font family of the svg once", () => {
        const svg = { style: jest.fn(() => "Arial") };
        const metrics = new TextMetrics(svg);

        expect(metrics.getFontFamily()).toBe("Arial");
        expect(metrics.getFontFamily()).toBe("Arial");
        expect(svg.style).toHaveBeenCalledTimes(1);
        expect(svg.style).toHaveBeenCalledWith("font-family");
    });

    test("shares the metrics inside a pass and starts again with the next one", () => {
        const svg = { style: jest.fn() };
        const pass = {};

        expect(getTextMetrics(svg, pass)).toBe(getTextMetrics(svg, pass));
        expect(getTextMetrics(svg, {})).not.toBe(getTextMetrics(svg, pass));
    });
});
