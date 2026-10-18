import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const exportHandler = { svgToImage: jest.fn() };
const createChartExport = jest.fn(() => exportHandler);

await jest.unstable_mockModule("@magicsunday/webtrees-chart-lib", () => ({
    ChartZoom: jest.fn(),
    SvgDefs: jest.fn(() => ({ get: jest.fn(() => ({})) })),
    createChartExport,
}));

await jest.unstable_mockModule("resources/js/modules/svg/filter", () => ({
    default: jest.fn(),
}));

const { default: Svg } = await import("resources/js/modules/svg");

/**
 * Builds a chainable stand-in for the D3 selection the constructor appends the <svg> to.
 */
function createParent() {
    const element = {};
    element.attr = jest.fn(() => element);

    return { append: jest.fn(() => element) };
}

describe("Svg", () => {
    beforeEach(() => {
        createChartExport.mockClear();
    });

    describe("export", () => {
        it.each(["png", "svg"])("hands the %s type to createChartExport", (type) => {
            const svg = new Svg(createParent(), {});

            expect(svg.export(type)).toBe(exportHandler);
            expect(createChartExport).toHaveBeenCalledTimes(1);
            expect(createChartExport).toHaveBeenCalledWith(type);
        });
    });
});
