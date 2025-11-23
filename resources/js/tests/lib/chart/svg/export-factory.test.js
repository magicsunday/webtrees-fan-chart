import { describe, expect, jest, test } from "@jest/globals";

const pngConstructor = jest.fn(() => ({ type: "png" }));
const svgConstructor = jest.fn(() => ({ type: "svg" }));

await jest.unstable_mockModule("resources/js/modules/lib/chart/svg/export/png", () => ({
    __esModule: true,
    default: pngConstructor,
}));

await jest.unstable_mockModule("resources/js/modules/lib/chart/svg/export/svg", () => ({
    __esModule: true,
    default: svgConstructor,
}));

const { default: ExportFactory } = await import("resources/js/modules/lib/chart/svg/export-factory");

describe("ExportFactory", () => {
    test("creates PNG exporter", () => {
        const factory = new ExportFactory();
        const exporter = factory.createExport("png");

        expect(pngConstructor).toHaveBeenCalledTimes(1);
        expect(exporter.type).toBe("png");
    });

    test("creates SVG exporter", () => {
        const factory = new ExportFactory();
        const exporter = factory.createExport("svg");

        expect(svgConstructor).toHaveBeenCalledTimes(1);
        expect(exporter.type).toBe("svg");
    });

    test("ignores unknown exporter", () => {
        const factory = new ExportFactory();
        const exporter = factory.createExport("pdf");

        expect(exporter).toBeUndefined();
    });
});
