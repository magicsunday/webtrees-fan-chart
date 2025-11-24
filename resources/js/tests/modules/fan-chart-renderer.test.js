import { jest } from "@jest/globals";

const selectMock         = jest.fn();
const layoutMock         = jest.fn();
const viewLayerMock      = jest.fn();
const exporterMock       = jest.fn();
const dataLoaderMock     = jest.fn();
const updateConstructor  = jest.fn();
const viewportCtorMock   = jest.fn();
const parentNode         = { contains: jest.fn(() => false) };

class StubLayoutEngine {
    constructor(configuration)
    {
        this.configuration       = configuration;
        this.initializeHierarchy = jest.fn();
    }
}

class StubDataLoader {
    constructor(...args)
    {
        dataLoaderMock(...args);
        this.fetchHierarchy = jest.fn();
    }
}

class StubViewLayer {
    constructor(configuration)
    {
        this.configuration          = configuration;
        this.render                 = jest.fn();
        this.updateViewBox          = jest.fn();
        this.center                 = jest.fn();
        this.onUpdate               = jest.fn((callback) => { this.updateCallback = callback; });
        this.bindClickEventListener = jest.fn();
        this.svg                    = { tag: "svg" };
    }
}

class StubChartExporter {
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

const viewportServiceInstance = { register: jest.fn(), resize: jest.fn(), center: jest.fn() };
let viewportOptions;

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

await jest.unstable_mockModule("resources/js/modules/custom/export/d3-chart-exporter", () => ({
    __esModule: true,
    default: jest.fn((...args) => {
        exporterMock(...args);
        return new StubChartExporter(...args);
    }),
}));

await jest.unstable_mockModule("resources/js/modules/custom/data-loader", () => ({
    __esModule: true,
    default: jest.fn((...args) => new StubDataLoader(...args)),
}));

await jest.unstable_mockModule("resources/js/modules/custom/update", () => ({
    __esModule: true,
    default: StubUpdate,
}));

await jest.unstable_mockModule("resources/js/modules/custom/viewport-event-service", () => ({
    __esModule: true,
    default: jest.fn((options) => {
        viewportOptions = options;
        viewportCtorMock(options);
        return viewportServiceInstance;
    }),
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
        exporterMock.mockClear();
        dataLoaderMock.mockClear();
        updateConstructor.mockClear();
        viewportCtorMock.mockClear();
        viewportServiceInstance.register.mockClear();
        viewportServiceInstance.resize.mockClear();
        viewportServiceInstance.center.mockClear();
    });

    it("renders with injected d3, draws the chart, and registers viewport listeners", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();

        expect(selectMock).toHaveBeenCalledWith("#chart");
        expect(layoutMock).toHaveBeenCalledWith(baseOptions.configuration);
        expect(viewLayerMock).toHaveBeenCalledWith(baseOptions.configuration);
        expect(renderer._layoutEngine.initializeHierarchy).toHaveBeenCalledWith(baseOptions.data);
        expect(renderer._viewLayer.render).toHaveBeenCalledWith({ tag: "parent", node: expect.any(Function) }, renderer._layoutEngine);
        expect(viewportCtorMock).toHaveBeenCalledWith({
            getContainer: expect.any(Function),
            onUpdateViewBox: expect.any(Function),
            onCenter: expect.any(Function),
        });
        expect(viewportServiceInstance.register).toHaveBeenCalledTimes(1);
    });

    it("delegates resize and center actions to the viewport service", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();
        renderer.resize();
        renderer.resetZoom();

        expect(viewportServiceInstance.resize).toHaveBeenCalledTimes(1);
        expect(viewportServiceInstance.center).toHaveBeenCalledTimes(1);
    });

    it("exports png and svg variants via the configured exporter", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();
        renderer.export("png");
        renderer.export("svg");

        expect(renderer._chartExporter.export).toHaveBeenCalledWith("png", renderer._viewLayer.svg);
        expect(renderer._chartExporter.export).toHaveBeenCalledWith("svg", renderer._viewLayer.svg);
    });

    it("delegates updates through the view layer callback", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();

        renderer._viewLayer.updateCallback("/update");

        expect(updateConstructor).toHaveBeenCalledWith(renderer._viewLayer.svg, baseOptions.configuration, renderer._layoutEngine, expect.anything());
        expect(renderer._viewLayer.bindClickEventListener).toHaveBeenCalledTimes(1);
        expect(renderer._update.update).toHaveBeenCalledWith("/update", expect.any(Function));
    });

    it("prefers injected loader, exporters, and viewport services over defaults", () => {
        const customExportService = { export: jest.fn() };
        const customDataLoader = { fetchHierarchy: jest.fn() };
        const customViewportService = { register: jest.fn(), resize: jest.fn(), center: jest.fn() };
        const renderer = new FanChartRenderer({
            ...baseOptions,
            d3: { select: selectMock },
            chartExporter: customExportService,
            dataLoader: customDataLoader,
            viewportService: customViewportService,
        });

        renderer.render();
        renderer.export("svg");
        renderer.update("/custom");
        renderer.resize();
        renderer.resetZoom();

        expect(exporterMock).not.toHaveBeenCalled();
        expect(dataLoaderMock).not.toHaveBeenCalled();
        expect(customExportService.export).toHaveBeenCalledWith("svg", renderer._viewLayer.svg);
        expect(updateConstructor).toHaveBeenCalledWith(renderer._viewLayer.svg, baseOptions.configuration, renderer._layoutEngine, customDataLoader);
        expect(customViewportService.register).toHaveBeenCalledTimes(1);
        expect(customViewportService.resize).toHaveBeenCalledTimes(1);
        expect(customViewportService.center).toHaveBeenCalledTimes(1);
    });

    it("wires update and center callbacks into the viewport service", () => {
        const renderer = new FanChartRenderer({ ...baseOptions, d3: { select: selectMock } });

        renderer.render();

        viewportOptions.onUpdateViewBox();
        viewportOptions.onCenter();

        expect(renderer._viewLayer.updateViewBox).toHaveBeenCalledTimes(1);
        expect(renderer._viewLayer.center).toHaveBeenCalledTimes(1);
    });
});
