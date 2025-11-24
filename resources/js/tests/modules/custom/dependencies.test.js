import { jest } from "@jest/globals";

const viewLayerConstructor = jest.fn();
const layoutEngineConstructor = jest.fn();
const dataLoaderConstructor = jest.fn();
const exporterConstructor = jest.fn();
const viewportConstructor = jest.fn();
const viewportInstance = { register: jest.fn(), resize: jest.fn(), center: jest.fn() };
let viewportOptions;

await jest.unstable_mockModule("resources/js/modules/custom/view-layer", () => ({
    __esModule: true,
    default: jest.fn((...args) => {
        viewLayerConstructor(...args);

        return {
            render: jest.fn(),
            updateViewBox: jest.fn(),
            center: jest.fn(),
            onUpdate: jest.fn(),
            bindClickEventListener: jest.fn(),
            svg: null,
        };
    }),
}));

await jest.unstable_mockModule("resources/js/modules/custom/layout-engine", () => ({
    __esModule: true,
    default: jest.fn((...args) => {
        layoutEngineConstructor(...args);

        return { initializeHierarchy: jest.fn() };
    }),
}));

await jest.unstable_mockModule("resources/js/modules/custom/data-loader", () => ({
    __esModule: true,
    default: jest.fn((...args) => {
        dataLoaderConstructor(...args);

        return { fetchHierarchy: jest.fn() };
    }),
}));

await jest.unstable_mockModule("resources/js/modules/custom/export/d3-chart-exporter", () => ({
    __esModule: true,
    default: jest.fn((...args) => {
        exporterConstructor(...args);

        return { export: jest.fn() };
    }),
}));

await jest.unstable_mockModule("resources/js/modules/custom/viewport-event-service", () => ({
    __esModule: true,
    default: jest.fn((options) => {
        viewportOptions = options;
        viewportConstructor(options);

        return viewportInstance;
    }),
}));

const { createDefaultDependencies } = await import("resources/js/modules/custom/dependencies");

const configuration = { id: "config" };
const cssFiles = ["fan.css"];

beforeEach(() => {
    viewLayerConstructor.mockClear();
    layoutEngineConstructor.mockClear();
    dataLoaderConstructor.mockClear();
    exporterConstructor.mockClear();
    viewportConstructor.mockClear();
    viewportInstance.center.mockClear();
    viewportInstance.register.mockClear();
    viewportInstance.resize.mockClear();
});

describe("createDefaultDependencies", () => {
    it("creates default service instances with callbacks wired to the view layer", () => {
        const getContainer = jest.fn();
        const dependencies = createDefaultDependencies({ configuration, cssFiles, getContainer });

        expect(viewLayerConstructor).toHaveBeenCalledWith(configuration);
        expect(layoutEngineConstructor).toHaveBeenCalledWith(configuration);
        expect(dataLoaderConstructor).toHaveBeenCalledTimes(1);
        expect(exporterConstructor).toHaveBeenCalledWith(cssFiles);
        expect(viewportConstructor).toHaveBeenCalledWith({
            getContainer,
            onUpdateViewBox: expect.any(Function),
            onCenter: expect.any(Function),
        });

        viewportOptions.onUpdateViewBox();
        viewportOptions.onCenter();

        expect(dependencies.viewLayer.updateViewBox).toHaveBeenCalledTimes(1);
        expect(dependencies.viewLayer.center).toHaveBeenCalledTimes(1);
    });

    it("prefers externally supplied service overrides", () => {
        const overrides = {
            viewLayer: { render: jest.fn() },
            layoutEngine: { initializeHierarchy: jest.fn() },
            dataLoader: { fetchHierarchy: jest.fn() },
            chartExporter: { export: jest.fn() },
            viewportService: { register: jest.fn(), resize: jest.fn(), center: jest.fn() },
        };

        const dependencies = createDefaultDependencies({ configuration, cssFiles, overrides });

        expect(viewLayerConstructor).not.toHaveBeenCalled();
        expect(layoutEngineConstructor).not.toHaveBeenCalled();
        expect(dataLoaderConstructor).not.toHaveBeenCalled();
        expect(exporterConstructor).not.toHaveBeenCalled();
        expect(viewportConstructor).not.toHaveBeenCalled();

        expect(dependencies).toMatchObject(overrides);
    });
});
