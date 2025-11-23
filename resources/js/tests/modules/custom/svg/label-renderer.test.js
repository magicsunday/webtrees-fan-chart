import { jest } from "@jest/globals";

const createLabels = jest.fn();
const textConstructor = jest.fn();

await jest.unstable_mockModule("resources/js/modules/custom/svg/text", () => ({
    __esModule: true,
    default: class {
        constructor(...args) { textConstructor(...args); }
        createLabels = createLabels;
    }
}));

const { default: LabelRenderer } = await import("resources/js/modules/custom/svg/label-renderer");

afterEach(() => {
    jest.clearAllMocks();
});

const configuration = {
    fontSize: 12,
    fontScale: 100,
    numberOfInnerCircles: 2
};

const createParentSelection = () => {
    const child = {
        attr: jest.fn(() => child),
        style: jest.fn(() => child)
    };

    return {
        append: jest.fn(() => child),
        child
    };
};

describe("LabelRenderer", () => {
    it("constructs text helper with shared geometry", () => {
        const geometry = {};
        const svg = {};

        new LabelRenderer(svg, configuration, geometry);

        expect(textConstructor).toHaveBeenCalledWith(svg, configuration, geometry);
    });

    it("creates the label group and renders labels", () => {
        const renderer = new LabelRenderer({}, configuration, {});
        const { append, child } = createParentSelection();
        const datum = { depth: 3 };

        const label = renderer.render({ append }, datum);

        expect(append).toHaveBeenCalledWith("g");
        expect(child.attr).toHaveBeenCalledWith("class", "wt-chart-box-name name");
        expect(child.style).toHaveBeenCalledWith("font-size", "10px");
        expect(createLabels).toHaveBeenCalledWith(child, datum);
        expect(label).toBe(child);
    });
});
