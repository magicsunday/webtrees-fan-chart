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
const arcMock = jest.fn(() => ({
    startAngle: jest.fn(() => ({
        endAngle: jest.fn(() => ({
            innerRadius: jest.fn(() => ({
                outerRadius: jest.fn(() => ({})),
                padAngle: jest.fn(() => ({})),
                padRadius: jest.fn(() => ({})),
                cornerRadius: jest.fn(() => ({}))
            }))
        }))
    }))
}));

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    select: selectMock,
    arc: arcMock
}));

const textCreateLabels = jest.fn();

await jest.unstable_mockModule("resources/js/modules/custom/svg/text", () => ({
    __esModule: true,
    default: class {
        createLabels = textCreateLabels;
    }
}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/geometry", () => ({
    __esModule: true,
    default: class {
        startAngle() { return 0; }
        endAngle() { return 0; }
        innerRadius() { return 0; }
        outerRadius() { return 0; }
    }
}));

const { default: Person } = await import("resources/js/modules/custom/svg/person");

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

const createPersonSelection = () => {
    const handlers = {};
    const nodes = [{}];

    const personSelection = {
        classed: jest.fn((name) => name === "new"),
        on: jest.fn((event, handler) => {
            handlers[event] = handler;
            return personSelection;
        }),
        nodes: jest.fn(() => nodes)
    };

    return { personSelection, handlers, nodes };
};

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
            thumbnail: "",
            sex: "M",
            birth: "1900",
            marriageDate: "1920",
            death: "1980"
        }
    }
};

describe("Person tooltips", () => {
    beforeEach(() => {
        jest.spyOn(Person.prototype, "addArcToPerson").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addTitleToPerson").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addLabelToPerson").mockImplementation(() => ({}));
        jest.spyOn(Person.prototype, "addColorGroup").mockImplementation(() => {});
    });

    it("skips tooltip creation when the person data is empty", () => {
        const { personSelection } = createPersonSelection();
        const { div, htmlCalls } = createDivSelection();

        const person = new Person({ div }, { hideEmptySegments: false }, createArcFactory(), personSelection, {
            ...baseDatum,
            data: { data: { xref: "" } }
        });

        person.setTooltipHtml({ data: { data: { xref: "" } } });

        expect(htmlCalls).toHaveLength(0);
    });

    it("renders the thumbnail when images are enabled", () => {
        const { personSelection } = createPersonSelection();
        const { div, htmlCalls, styleCalls } = createDivSelection();
        const datum = {
            ...baseDatum,
            data: {
                data: {
                    ...baseDatum.data.data,
                    thumbnail: "thumb.jpg"
                }
            }
        };

        global.event = { pageX: 120, pageY: 80 };

        const person = new Person(
            { div },
            { hideEmptySegments: false, showImages: true, showSilhouettes: true },
            createArcFactory(),
            personSelection,
            datum
        );

        person.setTooltipHtml(datum);

        expect(htmlCalls[0]).toContain("thumb.jpg");
        expect(htmlCalls[0]).not.toContain("icon-silhouette");
        expect(styleCalls).toEqual([
            { name: "left", value: "120px" },
            { name: "top", value: "50px" }
        ]);
        expect(div.transition).not.toHaveBeenCalled();
    });

    it("renders a silhouette when no thumbnail is present", () => {
        const { personSelection } = createPersonSelection();
        const { div, htmlCalls } = createDivSelection();
        const datum = {
            ...baseDatum,
            data: {
                data: {
                    ...baseDatum.data.data,
                    thumbnail: "",
                    sex: "F"
                }
            }
        };

        global.event = { pageX: 200, pageY: 100 };

        const person = new Person(
            { div },
            { hideEmptySegments: false, showImages: true, showSilhouettes: true },
            createArcFactory(),
            personSelection,
            datum
        );

        person.setTooltipHtml(datum);

        expect(htmlCalls[0]).toContain("icon-silhouette-f");
    });
});

describe("Person interactions", () => {
    let personSelection;
    let handlers;
    let divSelection;
    let datum;

    beforeEach(() => {
        ({ personSelection, handlers } = createPersonSelection());
        ({ div: divSelection } = createDivSelection());
        datum = { ...baseDatum };

        jest.spyOn(Person.prototype, "addArcToPerson").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addTitleToPerson").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addLabelToPerson").mockImplementation(() => ({}));
        jest.spyOn(Person.prototype, "addColorGroup").mockImplementation(() => {});

        new Person(
            { div: divSelection },
            { hideEmptySegments: false, showImages: true, showSilhouettes: true },
            createArcFactory(),
            personSelection,
            datum
        );
    });

    it("toggles tooltip visibility on context menu", () => {
        divSelection.property.mockImplementation((name, value) => {
            if (value === undefined) {
                return name === "active" ? true : undefined;
            }

            return divSelection;
        });

        const transitionSpy = jest.fn(() => ({
            duration: jest.fn(() => ({ style: jest.fn() })),
            style: jest.fn()
        }));
        divSelection.transition = transitionSpy;

        handlers.contextmenu({ preventDefault: jest.fn() }, datum);

        expect(divSelection.property).toHaveBeenCalledWith("active", false);
        expect(transitionSpy).toHaveBeenCalled();
    });

    it("positions tooltip on mouse move", () => {
        handlers.mousemove({ pageX: 15, pageY: 45 }, datum);

        expect(divSelection.style).toHaveBeenCalledWith("left", "15px");
        expect(divSelection.style).toHaveBeenCalledWith("top", "15px");
    });

    it("updates hover classes on mouse over/out", () => {
        const node = {};
        personSelection.nodes.mockReturnValue([node]);

        handlers.mouseover.call(node, {}, datum);
        handlers.mouseout.call(node, {}, datum);

        expect(selectMock).toHaveBeenCalledWith(node);
        expect(hoverClassCalls).toEqual([
            { name: "hover", value: true },
            { name: "hover", value: false }
        ]);
    });
});
