import { jest } from "@jest/globals";

const labelConstructor = jest.fn();
const labelRender = jest.fn();
const tooltipConstructor = jest.fn();
const tooltipBind = jest.fn();

await jest.unstable_mockModule("resources/js/modules/custom/svg/label-renderer", () => ({
    __esModule: true,
    default: class {
        constructor(...args) { labelConstructor(...args); }
        render(...args) { labelRender(...args); }
    }
}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/tooltip-renderer", () => ({
    __esModule: true,
    default: class {
        constructor(...args) { tooltipConstructor(...args); }
        bind(...args) { tooltipBind(...args); }
    }
}));

const { default: Person } = await import("resources/js/modules/custom/svg/person");

let addArcSpy;
let addTitleSpy;
let addColorSpy;

beforeEach(() => {
    addArcSpy = jest.spyOn(Person.prototype, "addArcToPerson").mockImplementation(() => {});
    addTitleSpy = jest.spyOn(Person.prototype, "addTitleToPerson").mockImplementation(() => {});
    addColorSpy = jest.spyOn(Person.prototype, "addColorGroup").mockImplementation(() => {});
});

afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
});

const createPersonSelection = (isNew = false) => ({
    classed: jest.fn((name) => name === "new" ? isNew : false)
});

const createArcFactory = () => ({
    createPrimaryArc: jest.fn(() => ({})),
    createOverlayArc: jest.fn(() => ({})),
});

const baseDatum = {
    depth: 0,
    x0: 0,
    x1: 0,
    data: {
        data: {
            xref: "I1",
            name: "Alex Example",
            sex: "M"
        }
    }
};

describe("Person", () => {
    it("injects the shared geometry into renderers", () => {
        const geometry = {};
        const svg = {};
        const configuration = { hideEmptySegments: false };
        const personSelection = createPersonSelection();

        new Person(svg, configuration, createArcFactory(), geometry, personSelection, { ...baseDatum });

        expect(labelConstructor).toHaveBeenCalledWith(svg, configuration, geometry);
        expect(tooltipConstructor).toHaveBeenCalledWith(svg, configuration, geometry);
    });

    it("adds an arc for new nodes when empty segments are hidden", () => {
        new Person({}, { hideEmptySegments: true }, createArcFactory(), {}, createPersonSelection(true), { ...baseDatum });

        expect(addArcSpy).toHaveBeenCalledTimes(1);
    });

    it("skips label and tooltip rendering for empty data", () => {
        new Person({}, { hideEmptySegments: false }, createArcFactory(), {}, createPersonSelection(), {
            ...baseDatum,
            data: { data: { xref: "" } }
        });

        expect(labelRender).not.toHaveBeenCalled();
        expect(tooltipBind).not.toHaveBeenCalled();
    });

    it("orchestrates title, labels, color, and tooltip for populated data", () => {
        const personSelection = createPersonSelection();

        new Person({}, { hideEmptySegments: false }, createArcFactory(), {}, personSelection, { ...baseDatum });

        expect(addTitleSpy).toHaveBeenCalledWith(personSelection, baseDatum.data.data.name);
        expect(labelRender).toHaveBeenCalledWith(personSelection, expect.objectContaining(baseDatum));
        expect(addColorSpy).toHaveBeenCalled();
        expect(tooltipBind).toHaveBeenCalledWith(personSelection, expect.objectContaining(baseDatum));
    });

    it("does not add arcs when empty segments are hidden and data is empty", () => {
        new Person({}, { hideEmptySegments: true }, createArcFactory(), {}, createPersonSelection(), {
            ...baseDatum,
            data: { data: { xref: "" } }
        });

        expect(addArcSpy).not.toHaveBeenCalled();
    });
});
