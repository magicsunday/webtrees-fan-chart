import { jest } from "@jest/globals";

const textConstructor = jest.fn();
const createLabels = jest.fn();

await jest.unstable_mockModule("resources/js/modules/svg/text", () => ({
    __esModule: true,
    default: class TextStub {
        constructor(...args) {
            textConstructor(...args);
        }

        createLabels(...args) {
            createLabels(...args);
        }
    },
}));

const { default: LabelRenderer } = await import("resources/js/modules/svg/label-renderer");

describe("LabelRenderer", () => {
    const createParent = () => {
        const label = {
            attr: () => label,
            style: () => label,
        };

        return { append: () => label, label };
    };

    beforeEach(() => {
        textConstructor.mockClear();
        createLabels.mockClear();
    });

    it("builds the labels of a person with the size of the person's image", () => {
        const svg = {};
        const configuration = {};
        const geometry = { getFontSize: () => 14 };
        const parent = createParent();
        const datum = { depth: 1 };

        new LabelRenderer(svg, configuration, geometry).addLabel(parent, datum, 40);

        expect(textConstructor).toHaveBeenCalledWith(svg, configuration, geometry, 40);
        expect(createLabels).toHaveBeenCalledWith(parent.label, datum);
    });

    it("makes no room for an image unless it is told about one", () => {
        const geometry = { getFontSize: () => 14 };

        new LabelRenderer({}, {}, geometry).addLabel(createParent(), { depth: 1 });

        expect(textConstructor).toHaveBeenCalledWith({}, {}, geometry, 0);
    });
});
