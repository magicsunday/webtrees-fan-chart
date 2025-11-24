import { jest } from "@jest/globals";

const selectMock        = jest.fn();
const updateConstructor = jest.fn();
const parentNode        = { contains: jest.fn(() => false) };
const configuration     = { id: "config" };

class StubUpdate {
    constructor(...args)
    {
        updateConstructor(...args);
        this.update = jest.fn((url, callback) => callback());
    }
}

await jest.unstable_mockModule("resources/js/modules/custom/update", () => ({
    __esModule: true,
    default: StubUpdate,
}));

const { default: FanChartRenderer } = await import("resources/js/modules/fan-chart-renderer");

const createServiceBundle = () => {
    const viewLayer = {
        render: jest.fn(),
        updateViewBox: jest.fn(),
        center: jest.fn(),
        onUpdate: jest.fn((callback) => {
            viewLayer.updateCallback = callback;
        }),
        bindClickEventListener: jest.fn(),
        svg: { tag: "svg" },
    };
    const layoutEngine = { initializeHierarchy: jest.fn() };
    const dataLoader = { fetchHierarchy: jest.fn() };
    const chartExporter = { export: jest.fn() };
    const viewportService = { register: jest.fn(), resize: jest.fn(), center: jest.fn() };

    return {
        viewLayer,
        layoutEngine,
        dataLoader,
        chartExporter,
        viewportService,
    };
};

const baseOptions = {
    selector: "#chart",
    configuration,
    data: { id: "I1" },
    cssFiles: ["fan.css"],
};

const createRenderer = (services = createServiceBundle()) => new FanChartRenderer({
    ...baseOptions,
    d3: { select: selectMock },
    services,
});

describe("FanChartRenderer", () => {
    beforeEach(() => {
        parentNode.contains.mockReturnValue(false);
        selectMock.mockReturnValue({ tag: "parent", node: () => parentNode });
        selectMock.mockClear();
        updateConstructor.mockClear();
    });

    it("renders with injected dependencies and registers viewport listeners", () => {
        const services = createServiceBundle();
        const renderer = createRenderer(services);

        renderer.render();

        expect(selectMock).toHaveBeenCalledWith("#chart");
        expect(services.layoutEngine.initializeHierarchy).toHaveBeenCalledWith(baseOptions.data);
        expect(services.viewLayer.render).toHaveBeenCalledWith({ tag: "parent", node: expect.any(Function) }, services.layoutEngine);
        expect(services.viewportService.register).toHaveBeenCalledTimes(1);
    });

    it("delegates resize and center actions to the viewport service", () => {
        const services = createServiceBundle();
        const renderer = createRenderer(services);

        renderer.render();
        renderer.resize();
        renderer.resetZoom();

        expect(services.viewportService.resize).toHaveBeenCalledTimes(1);
        expect(services.viewportService.center).toHaveBeenCalledTimes(1);
    });

    it("exports png and svg variants via the configured exporter", () => {
        const services = createServiceBundle();
        const renderer = createRenderer(services);

        renderer.render();
        renderer.export("png");
        renderer.export("svg");

        expect(services.chartExporter.export).toHaveBeenCalledWith("png", services.viewLayer.svg);
        expect(services.chartExporter.export).toHaveBeenCalledWith("svg", services.viewLayer.svg);
    });

    it("delegates updates through the view layer callback", () => {
        const services = createServiceBundle();
        const renderer = createRenderer(services);

        renderer.render();

        services.viewLayer.updateCallback("/update");

        expect(updateConstructor).toHaveBeenCalledWith(
            services.viewLayer.svg,
            baseOptions.configuration,
            services.layoutEngine,
            services.dataLoader,
        );
        expect(services.viewLayer.bindClickEventListener).toHaveBeenCalledTimes(1);
        expect(renderer._update.update).toHaveBeenCalledWith("/update", expect.any(Function));
    });
});
