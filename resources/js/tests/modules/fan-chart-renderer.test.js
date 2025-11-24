import { jest } from "@jest/globals";

const selectMock       = jest.fn();
const layoutMock       = jest.fn();
const viewLayerMock    = jest.fn();
const exportMock       = jest.fn();
const updateConstructor = jest.fn();
const parentNode = { contains: jest.fn(() => false) };
let addEventListenerSpy;

class StubLayoutEngine {
    constructor(configuration)
    {
        this.configuration       = configuration;
        this.initializeHierarchy = jest.fn();
    }
}

class StubViewLayer {
    constructor(configuration)
    {
        this.configuration        = configuration;
        this.render               = jest.fn();
        this.updateViewBox        = jest.fn();
        this.center               = jest.fn();
        this.onUpdate             = jest.fn((callback) => { this.updateCallback = callback; });
        this.bindClickEventListener = jest.fn();
        this.svg                  = { tag: "svg" };
    }
}

class StubExportService {
    constructor()
    {
        this.export = jest.fn();
    }
}

class StubUpdate {
    constructor(...args)
    {
        updateConstructor(...args);
        this.update = jest.fn((url, callback) => callback());
    }
}

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    select: selectMock,
}));

await jest.unstable_mockModule("resources/js/modules/custom/layout-engine", () => ({
    __esModule: true,
    default: jest.fn((...args) => {
        layoutMock(...args);
        return new StubLayoutEngine(...args);
    }),
}));

await jest.unstable_mockModule("resources/js/modules/custom/view-layer", () => ({
    __esModule: true,
    default: jest.fn((...args) => {
        viewLayerMock(...args);
        return new StubViewLayer(...args);
    }),
}));

await jest.unstable_mockModule("resources/js/modules/custom/export-service", () => ({
    __esModule: true,
    default: jest.fn((...args) => {
        exportMock(...args);
        return new StubExportService(...args);
    }),
}));

await jest.unstable_mockModule("resources/js/modules/custom/update", () => ({
    __esModule: true,
    default: StubUpdate,
}));

const { default: FanChartRenderer } = await import("resources/js/modules/fan-chart-renderer");

const baseOptions = {
    selector: "#chart",
    configuration: {},
    data: { id: "I1" },
    cssFiles: ["fan.css"],
};

describe("FanChartRenderer", () => {
    beforeEach(() => {
        parentNode.contains.mockReturnValue(false);
        selectMock.mockReturnValue({ tag: "parent", node: () => parentNode });
        selectMock.mockClear();
        layoutMock.mockClear();
        viewLayerMock.mockClear();
        exportMock.mockClear();
        updateConstructor.mockClear();
        addEventListenerSpy = jest.spyOn(document, "addEventListener");
        document.fullscreenElement = null;
        document.documentElement.removeAttribute("fullscreen");
    });

    afterEach(() => {
        addEventListenerSpy.mockRestore();
        document.fullscreenElement = null;
    });

    it("renders with injected d3 and draws the chart", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();

        expect(selectMock).toHaveBeenCalledWith("#chart");
        expect(layoutMock).toHaveBeenCalledWith(baseOptions.configuration);
        expect(viewLayerMock).toHaveBeenCalledWith(baseOptions.configuration);
        expect(renderer._layoutEngine.initializeHierarchy).toHaveBeenCalledWith(baseOptions.data);
        expect(renderer._viewLayer.render).toHaveBeenCalledWith({ tag: "parent", node: expect.any(Function) }, renderer._layoutEngine);
    });

    it("resizes and recenters the chart", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();
        renderer.resize();
        renderer.resetZoom();

        expect(renderer._viewLayer.updateViewBox).toHaveBeenCalledTimes(1);
        expect(renderer._viewLayer.center).toHaveBeenCalledTimes(1);
    });

    it("exports png and svg variants", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();
        renderer.export("png");
        renderer.export("svg");

        expect(renderer._exportService.export).toHaveBeenCalledWith("png", renderer._viewLayer.svg);
        expect(renderer._exportService.export).toHaveBeenCalledWith("svg", renderer._viewLayer.svg);
    });

    it("delegates updates through the view layer callback", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();

        renderer._viewLayer.updateCallback("/update");

        expect(updateConstructor).toHaveBeenCalledWith(renderer._viewLayer.svg, baseOptions.configuration, renderer._layoutEngine, expect.anything());
        expect(renderer._viewLayer.bindClickEventListener).toHaveBeenCalledTimes(1);
        expect(renderer._update.update).toHaveBeenCalledWith("/update", expect.any(Function));
    });

    it("recalculates the view box when the fullscreen container changes", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();

        const fullscreenHandler = addEventListenerSpy.mock.calls.find(([event]) => event === "fullscreenchange")?.[1];

        expect(fullscreenHandler).toBeInstanceOf(Function);

        document.fullscreenElement = { contains: jest.fn(() => true) };
        fullscreenHandler();

        expect(document.documentElement.hasAttribute("fullscreen")).toBe(true);
        document.fullscreenElement = null;
        fullscreenHandler();

        expect(document.documentElement.hasAttribute("fullscreen")).toBe(false);
        expect(renderer._viewLayer.updateViewBox).toHaveBeenCalledTimes(2);
    });

    it("ignores unrelated fullscreen changes", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();

        const fullscreenHandler = addEventListenerSpy.mock.calls.find(([event]) => event === "fullscreenchange")?.[1];

        expect(fullscreenHandler).toBeInstanceOf(Function);

        document.fullscreenElement = { contains: jest.fn(() => false) };
        parentNode.contains.mockReturnValue(false);
        fullscreenHandler();

        expect(document.documentElement.hasAttribute("fullscreen")).toBe(false);
        expect(renderer._viewLayer.updateViewBox).not.toHaveBeenCalled();
    });
});
