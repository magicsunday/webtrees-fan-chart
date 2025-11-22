import { jest } from "@jest/globals";

const eventHandlers = new Map();

const selectMock = jest.fn((selector) => {
    const selection = {
        on: (event, handler) => {
            eventHandlers.set(`${selector}:${event}`, handler);

            return selection;
        }
    };

    return selection;
});

const chartInstances = [];

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

        chartInstances.push(this);
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
    chartInstances,
}));

const { FanChart } = await import("resources/js/modules/index");

const createOptions = (overrides = {}) => ({
    labels: [],
    generations: 1,
    fanDegree: 180,
    fontScale: 1,
    hideEmptySegments: false,
    showColorGradients: false,
    showParentMarriageDates: false,
    showImages: false,
    showSilhouettes: false,
    rtl: false,
    innerArcs: 0,
    cssFiles: [],
    data: [],
    ...overrides,
});

const ensureOrientationListeners = () => {
    if (typeof screen.orientation.addEventListener !== "function") {
        screen.orientation.addEventListener = jest.fn();
    }
};

describe("FanChart", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        eventHandlers.clear();
        selectMock.mockClear();
        chartInstances.length = 0;
        ensureOrientationListeners();
    });

    it("draws initial data during setup", () => {
        document.body.innerHTML = '<div id="chart"></div><button id="centerButton"></button>'
            + '<button id="exportPNG"></button><button id="exportSVG"></button>';

        const sampleData = [{ id: "I1" }];

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ data: sampleData }));

        expect(chartInstances).toHaveLength(1);
        expect(chartInstances[0].data).toBe(sampleData);
        expect(chartInstances[0].draw).toHaveBeenCalledTimes(1);
    });

    it("triggers chart interactions from toolbar buttons", () => {
        document.body.innerHTML = '<div id="chart"></div><button id="centerButton"></button>'
            + '<button id="exportPNG"></button><button id="exportSVG"></button>';

        const cssFiles = ["fan.css"];

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ cssFiles }));

        const chart = chartInstances[0];

        const centerHandler = eventHandlers.get("#centerButton:click");
        expect(centerHandler).toBeInstanceOf(Function);
        centerHandler();
        expect(chart.center).toHaveBeenCalledTimes(1);

        const exportPngHandler = eventHandlers.get("#exportPNG:click");
        expect(exportPngHandler).toBeInstanceOf(Function);
        exportPngHandler();
        expect(chart.svg.export).toHaveBeenCalledWith("png");
        expect(chart.svg.svgToImageMock).toHaveBeenCalledWith(chart.svg, "fan-chart.png");

        const exportSvgHandler = eventHandlers.get("#exportSVG:click");
        expect(exportSvgHandler).toBeInstanceOf(Function);
        exportSvgHandler();
        expect(chart.svg.export).toHaveBeenCalledWith("svg");
        expect(chart.svg.svgToImageMock).toHaveBeenCalledWith(
            chart.svg,
            cssFiles,
            "webtrees-fan-chart-container",
            "fan-chart.svg",
        );
    });

    it("delegates update requests to the chart", () => {
        document.body.innerHTML = '<div id="chart"></div><button id="centerButton"></button>'
            + '<button id="exportPNG"></button><button id="exportSVG"></button>';

        const fanChart = new FanChart("#chart", createOptions());
        const chart    = chartInstances[0];

        fanChart.update("/update/url");

        expect(chart.update).toHaveBeenCalledWith("/update/url");
    });
});
