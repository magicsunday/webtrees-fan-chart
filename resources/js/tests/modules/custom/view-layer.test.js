import { jest } from "@jest/globals";

let svgBoundingBox = { x: 0, y: 0, width: 400, height: 300 };

class MockSvg {
    constructor() {
        this.attrCalls = [];
        this.visual = {
            node: () => ({
                getBBox: () => svgBoundingBox
            })
        };
    }

    attr(name, value) {
        this.attrCalls.push({ name, value });
        return this;
    }
}

await jest.unstable_mockModule("resources/js/modules/custom/svg", () => ({
    __esModule: true,
    default: MockSvg,
}));

await jest.unstable_mockModule("resources/js/modules/lib/chart/overlay", () => ({
    __esModule: true,
    default: jest.fn(() => ({}))
}));

await jest.unstable_mockModule("resources/js/modules/custom/gradient", () => ({
    __esModule: true,
    default: jest.fn(() => ({
        init: jest.fn(),
    })),
}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/person", () => ({
    __esModule: true,
    default: jest.fn(() => ({})),
}));

const { default: ViewLayer } = await import("resources/js/modules/custom/view-layer");

const createParentSelection = ({ width, height }) => ({
    node: () => ({
        getBoundingClientRect: () => ({
            width,
            height,
        }),
    }),
});

describe("ViewLayer", () => {
    afterEach(() => {
        document.fullscreenElement = null;
    });

    test("updateViewBox applies fullscreen padding", () => {
        const viewLayer = new ViewLayer({});
        const parentSelection = createParentSelection({ width: 600, height: 450 });
        const fullscreenRect = { width: 800, height: 600 };

        viewLayer._parent = parentSelection;
        viewLayer._svg = new MockSvg();

        const getComputedStyleSpy = jest.spyOn(window, "getComputedStyle").mockImplementation((element) => {
            if (element === document.documentElement) {
                return { fontSize: "16px" };
            }

            return {
                paddingBottom: "10px",
                paddingLeft: "10px",
                paddingRight: "10px",
                paddingTop: "10px",
            };
        });

        document.fullscreenElement = {
            getBoundingClientRect: () => fullscreenRect,
        };

        viewLayer.updateViewBox();

        const widthCall = viewLayer._svg.attrCalls.filter((call) => call.name === "width").pop();
        const heightCall = viewLayer._svg.attrCalls.filter((call) => call.name === "height").pop();
        const viewBoxCall = viewLayer._svg.attrCalls.filter((call) => call.name === "viewBox").pop();

        expect(widthCall?.value).toBe(fullscreenRect.width);
        expect(heightCall?.value).toBe(fullscreenRect.height);
        expect(viewBoxCall?.value).toEqual([-10, -10, 420, 320]);

        getComputedStyleSpy.mockRestore();
    });
});
