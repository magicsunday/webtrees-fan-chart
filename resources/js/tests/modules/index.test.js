import { jest } from "@jest/globals";
import Configuration from "resources/js/modules/custom/configuration";

const renderMock     = jest.fn();
const resizeMock     = jest.fn();
const resetZoomMock  = jest.fn();
const exportMock     = jest.fn();
const updateMock     = jest.fn();
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

    update = updateMock;
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
    updateMock.mockClear();
    document.body.innerHTML = "";
});

afterAll(() => {
    jest.resetModules();
});

const { createFanChart, FanChart } = await import("resources/js/modules/index");

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
        const chart = createFanChart(createOptions());

        expect(chart.renderer).toBeInstanceOf(RendererStub);
        expect(chart.actions).toBeDefined();
        expect(renderMock).toHaveBeenCalledTimes(1);
    });

    it("builds a configuration when none is provided", () => {
        const chart = createFanChart(createOptions());

        expect(chart.renderer).toBeInstanceOf(RendererStub);
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

    it("binds default controls located in the fullscreen container", () => {
        document.body.innerHTML = `
            <div class="webtrees-fan-fullscreen-container">
                <div class="toolbar">
                    <button id="centerButton" type="button"></button>
                    <button id="exportPNG" type="button"></button>
                    <button id="exportSVG" type="button"></button>
                </div>
                <div id="chart" class="webtrees-fan-chart-container"></div>
            </div>
        `;

        createFanChart(createOptions());

        resetZoomMock.mockClear();
        exportMock.mockClear();

        document.querySelector("#centerButton").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        document.querySelector("#exportPNG").dispatchEvent(new MouseEvent("click", { bubbles: true }));
        document.querySelector("#exportSVG").dispatchEvent(new MouseEvent("click", { bubbles: true }));

        expect(resetZoomMock).toHaveBeenCalledTimes(1);
        expect(exportMock).toHaveBeenNthCalledWith(1, "png");
        expect(exportMock).toHaveBeenNthCalledWith(2, "svg");
    });
});

describe("FanChart factory", () => {
    it("returns a chainable API compatible with constructor usage", () => {
        const chart = new FanChart("#chart", createOptions());

        expect(chart.renderer).toBeInstanceOf(RendererStub);

        chart.render().resize().center().export("png").update("/url").registerControls({ onRender: jest.fn() });

        expect(renderMock).toHaveBeenCalled();
        expect(resizeMock).toHaveBeenCalled();
        expect(resetZoomMock).toHaveBeenCalled();
        expect(exportMock).toHaveBeenCalledWith("png");
    });
});
