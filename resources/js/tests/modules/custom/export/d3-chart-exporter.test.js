import { jest } from "@jest/globals";
import D3ChartExporter from "resources/js/modules/custom/export/d3-chart-exporter";

describe("D3ChartExporter", () => {
    it("exports png charts using the svg helper", () => {
        const svgToImageMock = jest.fn();
        const exportResult   = { svgToImage: svgToImageMock };
        const svgMock        = { export: jest.fn(() => exportResult) };
        const exporter       = new D3ChartExporter(["styles.css"]);

        exporter.export("png", svgMock);

        expect(svgMock.export).toHaveBeenCalledWith("png");
        expect(svgToImageMock).toHaveBeenCalledWith(svgMock, "fan-chart.png");
    });

    it("exports svg charts with additional assets", () => {
        const svgToImageMock = jest.fn();
        const exportResult   = { svgToImage: svgToImageMock };
        const svgMock        = { export: jest.fn(() => exportResult) };
        const exporter       = new D3ChartExporter(["styles.css", "theme.css"]);

        exporter.export("svg", svgMock);

        expect(svgMock.export).toHaveBeenCalledWith("svg");
        expect(svgToImageMock).toHaveBeenCalledWith(
            svgMock,
            ["styles.css", "theme.css"],
            "webtrees-fan-chart-container",
            "fan-chart.svg"
        );
    });

    it("ignores export requests without an svg instance", () => {
        const exporter = new D3ChartExporter();

        expect(() => exporter.export("svg", null)).not.toThrow();
    });
});
