import { jest } from "@jest/globals";

const eventHandlers = new Map();

const selectMock = jest.fn((selector) => {
    const selection = {
        on: (event, handler) => {
            eventHandlers.set(`${selector}:${event}`, handler);

            return selection;
        },
    };

    return selection;
});

const chartInstances = [];
const panels = [];

class StubSvg {
    constructor() {
        this.svgToImageMock = jest.fn();
        this.export = jest.fn(() => ({ svgToImage: this.svgToImageMock }));
    }
}

class StubChart {
    constructor(parent, configuration) {
        this.parent = parent;
        this.configuration = configuration;
        this.dataValue = null;

        this.detailPanel = null;
        this.hasSelection = false;
        this.render = jest.fn(() => {
            this.renderedWithPanel = panels.length > 0 && panels[0].enabled;
        });
        this.center = jest.fn();
        this.update = jest.fn();
        this.updateViewBox = jest.fn();
        this.restoreFocus = jest.fn();
        this.clearSelection = jest.fn();
        this.redirectToIndividual = jest.fn();
        this.svg = new StubSvg();

        chartInstances.push(this);
    }

    set data(value) {
        this.dataValue = value;
    }

    get data() {
        return this.dataValue;
    }
}

await jest.unstable_mockModule("resources/js/modules/d3", () => ({
    __esModule: true,
    select: selectMock,
}));

await jest.unstable_mockModule("resources/js/modules/chart", () => ({
    __esModule: true,
    default: StubChart,
    chartInstances,
}));

// The panel is covered elsewhere. A stand-in records how the application connects it.
await jest.unstable_mockModule("@magicsunday/webtrees-chart-lib/chart-core", () => ({
    DetailPanel: class {
        constructor(element, callbacks) {
            this.element = element;
            this.callbacks = callbacks;
            this.enabled = false;
            panels.push(this);
        }

        enable() {
            this.enabled = true;
        }

        dismiss = jest.fn();
    },
}));

const { FanChart } = await import("resources/js/modules/index");

const createOptions = (overrides = {}) => ({
    labels: [],
    generations: 1,
    fanDegree: 180,
    fontScale: 1,
    hideEmptySegments: false,
    showFamilyColors: false,
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
        panels.length = 0;
        ensureOrientationListeners();

        if (screen.orientation?.addEventListener?.mockClear) {
            screen.orientation.addEventListener.mockClear();
        }
    });

    it("draws initial data during setup", () => {
        document.body.innerHTML =
            '<div id="chart"></div><button id="centerButton"></button>' +
            '<button id="exportPNG"></button><button id="exportSVG"></button>';

        const sampleData = [{ id: "I1" }];

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ data: sampleData }));

        expect(chartInstances).toHaveLength(1);
        expect(chartInstances[0].data).toBe(sampleData);
        expect(chartInstances[0].render).toHaveBeenCalledTimes(1);
    });

    it("triggers chart interactions from toolbar buttons", () => {
        document.body.innerHTML =
            '<div id="chart"></div><button id="centerButton"></button>' +
            '<button id="exportPNG"></button><button id="exportSVG"></button>';

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
        expect(chart.svg.svgToImageMock).toHaveBeenCalledWith(chart.svg, "fan-chart.svg");
    });

    it("keeps the viewBox in sync when fullscreen mode changes", () => {
        document.body.innerHTML =
            '<div id="chart"></div><button id="centerButton"></button>' +
            '<button id="exportPNG"></button><button id="exportSVG"></button>';

        const addEventListenerSpy = jest.spyOn(document, "addEventListener");

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions());

        const chart = chartInstances[0];

        const fullscreenCall = addEventListenerSpy.mock.calls.find(
            ([event]) => event === "fullscreenchange",
        );
        expect(fullscreenCall?.[1]).toBeInstanceOf(Function);

        const [, fullscreenHandler] = fullscreenCall;

        document.fullscreenElement = document.createElement("div");
        fullscreenHandler();
        expect(document.body.hasAttribute("fullscreen")).toBe(true);
        expect(chart.updateViewBox).toHaveBeenCalledTimes(1);

        document.fullscreenElement = null;
        fullscreenHandler();
        expect(document.body.hasAttribute("fullscreen")).toBe(false);
        expect(chart.updateViewBox).toHaveBeenCalledTimes(2);

        addEventListenerSpy.mockRestore();
    });

    it("updates the viewBox after device orientation changes", () => {
        document.body.innerHTML =
            '<div id="chart"></div><button id="centerButton"></button>' +
            '<button id="exportPNG"></button><button id="exportSVG"></button>';

        const orientationListenerSpy = jest.spyOn(screen.orientation, "addEventListener");

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions());

        const changeCall = orientationListenerSpy.mock.calls.find(([event]) => event === "change");
        expect(changeCall?.[1]).toBeInstanceOf(Function);

        const [, changeHandler] = changeCall;

        const chart = chartInstances[0];
        chart.updateViewBox.mockClear();

        changeHandler();

        expect(chart.updateViewBox).toHaveBeenCalledTimes(1);

        orientationListenerSpy.mockRestore();
    });
});

describe("FanChart detail panel", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        chartInstances.length = 0;
        panels.length = 0;
        ensureOrientationListeners();
    });

    const buildWith = (overrides = {}, withPanel = true) => {
        document.body.innerHTML =
            '<div id="chart"></div>' +
            (withPanel ? '<aside id="webtrees-fan-detail-panel"></aside>' : "");

        return new FanChart("#chart", createOptions(overrides));
    };

    it("hands the option to the configuration", () => {
        const application = buildWith({ showDetailPanel: true });

        expect(application._configuration.showDetailPanel).toBe(true);
    });

    it("creates no panel while the option is off", () => {
        buildWith({ showDetailPanel: false });

        expect(panels).toHaveLength(0);
        expect(chartInstances[0].detailPanel).toBeNull();
    });

    it("creates no panel when the page has no panel element", () => {
        buildWith({ showDetailPanel: true }, false);

        expect(panels).toHaveLength(0);
    });

    it("enables the panel and hands it to the chart before the first draw", () => {
        buildWith({ showDetailPanel: true });

        expect(panels).toHaveLength(1);
        expect(panels[0].enabled).toBe(true);
        expect(chartInstances[0].detailPanel).toBe(panels[0]);
        expect(chartInstances[0].renderedWithPanel).toBe(true);
    });

    it("keeps one panel for a chart that is built again against the same page", () => {
        document.body.innerHTML =
            '<div id="chart"></div><aside id="webtrees-fan-detail-panel"></aside>';

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ showDetailPanel: true }));
        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ showDetailPanel: true }));

        expect(panels).toHaveLength(1);
        expect(chartInstances).toHaveLength(2);
        expect(chartInstances[1].detailPanel).toBe(panels[0]);
    });

    it("dismisses the open panel when a chart replaces the one that holds its person", () => {
        document.body.innerHTML =
            '<div id="chart"></div><aside id="webtrees-fan-detail-panel"></aside>';

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ showDetailPanel: true }));
        chartInstances[0].hasSelection = true;
        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ showDetailPanel: true }));

        expect(panels[0].dismiss).toHaveBeenCalledTimes(1);
    });

    it("leaves the panel alone when the replaced chart has no selected person", () => {
        document.body.innerHTML =
            '<div id="chart"></div><aside id="webtrees-fan-detail-panel"></aside>';

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ showDetailPanel: true }));
        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ showDetailPanel: true }));

        expect(panels[0].dismiss).not.toHaveBeenCalled();
    });

    it("lets the panel act on the chart that was built last", () => {
        document.body.innerHTML =
            '<div id="chart"></div><aside id="webtrees-fan-detail-panel"></aside>';

        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ showDetailPanel: true }));
        // eslint-disable-next-line no-new
        new FanChart("#chart", createOptions({ showDetailPanel: true }));

        panels[0].callbacks.onIndividual("/individual/I1");
        panels[0].callbacks.onCenter("/chart/I1");
        panels[0].callbacks.onClose();
        panels[0].callbacks.onHidden();

        for (const callback of [
            "redirectToIndividual",
            "update",
            "restoreFocus",
            "clearSelection",
        ]) {
            expect(chartInstances[0][callback]).not.toHaveBeenCalled();
            expect(chartInstances[1][callback]).toHaveBeenCalledTimes(1);
        }
    });

    it("connects the actions of the panel with the chart", () => {
        buildWith({ showDetailPanel: true });

        panels[0].callbacks.onIndividual("/individual/I1");
        panels[0].callbacks.onCenter("/chart/I1");
        panels[0].callbacks.onClose();
        panels[0].callbacks.onHidden();

        expect(chartInstances[0].redirectToIndividual).toHaveBeenCalledWith("/individual/I1");
        expect(chartInstances[0].update).toHaveBeenCalledWith("/chart/I1");
        expect(chartInstances[0].restoreFocus).toHaveBeenCalledTimes(1);
        expect(chartInstances[0].clearSelection).toHaveBeenCalledTimes(1);
    });
});
