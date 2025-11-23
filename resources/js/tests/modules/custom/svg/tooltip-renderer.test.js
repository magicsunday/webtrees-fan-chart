import { jest } from "@jest/globals";

const hoverClassCalls = [];
const hoverSelection = {
    classed: jest.fn((name, value) => {
        hoverClassCalls.push({ name, value });
        return hoverSelection;
    }),
    raise: jest.fn(() => hoverSelection)
};

const selectMock = jest.fn(() => hoverSelection);

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    select: selectMock
}));

const { default: TooltipRenderer } = await import("resources/js/modules/custom/svg/tooltip-renderer");

afterEach(() => {
    jest.clearAllMocks();
    hoverClassCalls.length = 0;
});

const createDivSelection = () => {
    const htmlCalls = [];
    const styleCalls = [];
    const transitionStyleCalls = [];
    const properties = new Map();

    const transitionSelection = {
        duration: jest.fn(() => transitionSelection),
        style: jest.fn((name, value) => {
            transitionStyleCalls.push({ name, value });
            return transitionSelection;
        })
    };

    const div = {
        html: jest.fn((value) => {
            htmlCalls.push(value);
            return div;
        }),
        style: jest.fn((name, value) => {
            styleCalls.push({ name, value });
            return div;
        }),
        transition: jest.fn(() => transitionSelection),
        property: jest.fn((name, value) => {
            if (value === undefined) {
                return properties.get(name);
            }

            properties.set(name, value);
            return div;
        })
    };

    return { div, htmlCalls, styleCalls, transitionStyleCalls, properties };
};

const baseDatum = {
    data: {
        data: {
            xref: "I1",
            name: "Alex Example",
            birth: "1 Jan 1900",
            marriageDate: "1 Jan 1920",
            death: "1 Jan 1950",
            thumbnail: "thumb.jpg",
            sex: "M"
        }
    }
};

describe("TooltipRenderer", () => {
    it("returns an empty string when tooltip data is missing", () => {
        const renderer = new TooltipRenderer({}, { showImages: true }, {});

        expect(renderer.buildTooltipHtml({ data: { data: { xref: "" } } })).toBe("");
    });

    it("renders thumbnail content when available", () => {
        const renderer = new TooltipRenderer({}, { showImages: true, showSilhouettes: true }, {});

        const html = renderer.buildTooltipHtml(baseDatum);

        expect(html).toContain("thumb.jpg");
        expect(html).not.toContain("icon-silhouette");
    });

    it("renders a silhouette when no thumbnail is present", () => {
        const renderer = new TooltipRenderer({}, { showImages: true, showSilhouettes: true }, {});
        const datum = {
            data: {
                data: {
                    ...baseDatum.data.data,
                    thumbnail: "",
                    sex: "F"
                }
            }
        };

        const html = renderer.buildTooltipHtml(datum);

        expect(html).toContain("icon-silhouette-f");
    });

    it("positions and fills the tooltip on show", () => {
        const { div, htmlCalls, styleCalls } = createDivSelection();
        const renderer = new TooltipRenderer({ div }, { showImages: true, showSilhouettes: true }, {});

        renderer.showTooltip({ pageX: 120, pageY: 80 }, baseDatum);

        expect(htmlCalls[0]).toContain("thumb.jpg");
        expect(styleCalls).toEqual([
            { name: "left", value: "120px" },
            { name: "top", value: "50px" }
        ]);
    });

    it("toggles tooltip visibility on context menu", () => {
        const { div, properties, transitionStyleCalls } = createDivSelection();
        properties.set("active", true);

        const renderer = new TooltipRenderer({ div }, { showImages: true }, {});

        renderer.handleContextMenu({ preventDefault: jest.fn(), pageX: 0, pageY: 0 }, baseDatum);

        expect(div.property).toHaveBeenCalledWith("active", false);
        expect(transitionStyleCalls).toContainEqual({ name: "opacity", value: 0 });
    });

    it("updates tooltip position on mouse move", () => {
        const { div, styleCalls } = createDivSelection();
        const renderer = new TooltipRenderer({ div }, { showImages: true }, {});

        renderer.positionTooltip({ pageX: 15, pageY: 45 });

        expect(styleCalls).toEqual([
            { name: "left", value: "15px" },
            { name: "top", value: "15px" }
        ]);
    });

    it("updates hover classes on highlight", () => {
        const node = { id: 1 };
        const personSelection = {
            nodes: jest.fn(() => [node])
        };
        const renderer = new TooltipRenderer({}, { showImages: true }, {});

        renderer.highlightPerson(personSelection, { currentTarget: node }, true);
        renderer.highlightPerson(personSelection, { currentTarget: node }, false);

        expect(selectMock).toHaveBeenCalledWith(node);
        expect(hoverClassCalls).toEqual([
            { name: "hover", value: true },
            { name: "hover", value: false }
        ]);
    });
});
