import { jest } from "@jest/globals";
import Configuration from "resources/js/modules/custom/configuration";

const renderMock     = jest.fn();
const resizeMock     = jest.fn();
const resetZoomMock  = jest.fn();
const exportMock     = jest.fn();
const ctorArgs       = [];

class RendererStub {
    constructor(options)
    {
        ctorArgs.push(options);
    }

    render = renderMock;

    resize = resizeMock;

    resetZoom = resetZoomMock;

    export = exportMock;
}

await jest.unstable_mockModule("resources/js/modules/fan-chart-renderer", () => ({
    __esModule: true,
    default: RendererStub,
}));

afterEach(() => {
    ctorArgs.length = 0;
    renderMock.mockClear();
    resizeMock.mockClear();
    resetZoomMock.mockClear();
    exportMock.mockClear();
});

afterAll(() => {
    jest.resetModules();
});

const { createFanChart } = await import("resources/js/modules/index");

const createOptions = (overrides = {}) => ({
    selector: "#chart",
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

describe("createFanChart", () => {
    it("constructs a renderer and renders immediately by default", () => {
        const renderer = createFanChart(createOptions());

        expect(renderer).toBeInstanceOf(RendererStub);
        expect(renderMock).toHaveBeenCalledTimes(1);
    });

    it("builds a configuration when none is provided", () => {
        createFanChart(createOptions());

        expect(ctorArgs[0].configuration).toBeInstanceOf(Configuration);
    });

    it("applies numeric string options to the renderer and configuration", () => {
        createFanChart(createOptions({
            fanDegree: "300",
            fontScale: "125",
            innerArcs: "2",
        }));

        const rendererOptions = ctorArgs[0];

        expect(rendererOptions.fanDegree).toBe(300);
        expect(rendererOptions.fontScale).toBe(125);
        expect(rendererOptions.innerArcs).toBe(2);
        expect(rendererOptions.configuration.fanDegree).toBe(300);
        expect(rendererOptions.configuration.fontScale).toBe(125);
        expect(rendererOptions.configuration.numberOfInnerCircles).toBe(2);
    });

    it("forwards callbacks so the host can trigger renderer actions", () => {
        const renderCallbacks = [];
        const resizeCallbacks = [];
        const centerCallbacks = [];
        const exportCallbacks = [];

        createFanChart(createOptions({
            onRender: (callback) => renderCallbacks.push(callback),
            onResize: (callback) => resizeCallbacks.push(callback),
            onCenter: (callback) => centerCallbacks.push(callback),
            onExport: (callback) => exportCallbacks.push(callback),
        }));

        expect(renderMock).not.toHaveBeenCalled();
        expect(renderCallbacks).toHaveLength(1);
        expect(resizeCallbacks).toHaveLength(1);
        expect(centerCallbacks).toHaveLength(1);
        expect(exportCallbacks).toHaveLength(1);

        renderCallbacks[0]();
        resizeCallbacks[0]();
        centerCallbacks[0]();
        exportCallbacks[0]("png");

        expect(renderMock).toHaveBeenCalledTimes(1);
        expect(resizeMock).toHaveBeenCalledTimes(1);
        expect(resetZoomMock).toHaveBeenCalledTimes(1);
        expect(exportMock).toHaveBeenCalledWith("png");
    });
});
