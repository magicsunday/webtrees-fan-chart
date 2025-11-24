import { jest } from "@jest/globals";

const selectMock = jest.fn();

class StubSvg {
    constructor()
    {
        this.svgToImageMock = jest.fn();
        this.export         = jest.fn(() => ({ svgToImage: this.svgToImageMock }));
    }
}

class StubChart {
    constructor(parent, configuration)
    {
        this.parent        = parent;
        this.configuration = configuration;
        this.dataValue     = null;

        this.draw          = jest.fn();
        this.center        = jest.fn();
        this.update        = jest.fn();
        this.updateViewBox = jest.fn();
        this.svg           = new StubSvg();
    }

    set data(value)
    {
        this.dataValue = value;
    }

    get data()
    {
        return this.dataValue;
    }
}

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    select: selectMock,
}));

await jest.unstable_mockModule("resources/js/modules/custom/chart", () => ({
    __esModule: true,
    default: StubChart,
}));

const { default: FanChartRenderer } = await import("resources/js/modules/fan-chart-renderer");

const baseOptions = {
    selector: "#chart",
    configuration: {},
    hierarchyData: { id: "I1" },
    cssFiles: ["fan.css"],
};

describe("FanChartRenderer", () => {
    beforeEach(() => {
        selectMock.mockReturnValue({ tag: "parent" });
        selectMock.mockClear();
    });

    it("renders with injected d3 and draws the chart", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();

        expect(selectMock).toHaveBeenCalledWith("#chart");
        expect(renderer._chart).toBeInstanceOf(StubChart);
        expect(renderer._chart.data).toEqual(baseOptions.hierarchyData);
        expect(renderer._chart.draw).toHaveBeenCalledTimes(1);
    });

    it("resizes and recenters the chart", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();
        renderer.resize();
        renderer.resetZoom();

        expect(renderer._chart.updateViewBox).toHaveBeenCalledTimes(1);
        expect(renderer._chart.center).toHaveBeenCalledTimes(1);
    });

    it("exports png and svg variants", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();
        renderer.export("png");
        renderer.export("svg");

        expect(renderer._chart.svg.export).toHaveBeenCalledWith("png");
        expect(renderer._chart.svg.svgToImageMock).toHaveBeenCalledWith(renderer._chart.svg, "fan-chart.png");
        expect(renderer._chart.svg.export).toHaveBeenCalledWith("svg");
        expect(renderer._chart.svg.svgToImageMock).toHaveBeenCalledWith(
            renderer._chart.svg,
            baseOptions.cssFiles,
            "webtrees-fan-chart-container",
            "fan-chart.svg",
        );
    });
});
