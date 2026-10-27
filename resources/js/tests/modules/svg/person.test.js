import { jest } from "@jest/globals";

const hoverClassCalls = [];
const hoverSelection = {
    classed: jest.fn((name, value) => {
        hoverClassCalls.push({ name, value });
        return hoverSelection;
    }),
    raise: jest.fn(() => hoverSelection),
};

const selectMock = jest.fn(() => hoverSelection);
const arcMock = jest.fn(() => ({
    startAngle: jest.fn(() => ({
        endAngle: jest.fn(() => ({
            innerRadius: jest.fn(() => ({
                outerRadius: jest.fn(() => ({})),
                padAngle: jest.fn(() => ({})),
                padRadius: jest.fn(() => ({})),
                cornerRadius: jest.fn(() => ({})),
            })),
        })),
    })),
}));

await jest.unstable_mockModule("resources/js/modules/d3", () => ({
    __esModule: true,
    select: selectMock,
    arc: arcMock,
}));

const textCreateLabels = jest.fn();

await jest.unstable_mockModule("resources/js/modules/svg/text", () => ({
    __esModule: true,
    default: class {
        createLabels = textCreateLabels;
    },
}));

await jest.unstable_mockModule("resources/js/modules/svg/arc", () => ({
    __esModule: true,
    appendArc() {},
}));

await jest.unstable_mockModule("resources/js/modules/svg/geometry", () => ({
    __esModule: true,
    MATH_DEG2RAD: Math.PI / 180,
    MATH_RAD2DEG: 180 / Math.PI,
    default: class {
        startAngle() {
            return 0;
        }
        endAngle() {
            return 0;
        }
        innerRadius() {
            return 0;
        }
        outerRadius() {
            return 0;
        }
        getFontSize() {
            return 14;
        }
    },
}));

const addLabelMock = jest.fn(() => ({}));

await jest.unstable_mockModule("resources/js/modules/svg/label-renderer", () => ({
    __esModule: true,
    default: class {
        addLabel(...args) {
            return addLabelMock(...args);
        }
    },
}));

const { default: Person } = await import("resources/js/modules/svg/person");

afterEach(() => {
    // Restore the spies too, otherwise a stubbed method stays stubbed for the
    // tests of the next describe block
    jest.restoreAllMocks();
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
        }),
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
        }),
    };

    return { div, htmlCalls, styleCalls, transitionStyleCalls, properties };
};

const createPersonSelection = () => {
    const handlers = {};
    const nodes = [{}];

    // The content wrapper mock — Person.init() appends a <g class="content">
    // and all child elements go inside it
    const contentGroup = {
        attr: jest.fn(() => contentGroup),
        append: jest.fn(() => contentGroup),
        insert: jest.fn(() => contentGroup),
        select: jest.fn(() => contentGroup),
        selectAll: jest.fn(() => contentGroup),
        text: jest.fn(() => contentGroup),
        style: jest.fn(() => contentGroup),
        classed: jest.fn(() => false),
        each: jest.fn(),
        node: jest.fn(() => ({ getComputedTextLength: () => 0 })),
    };

    const personSelection = {
        classed: jest.fn((name) => name === "new"),
        on: jest.fn((event, handler) => {
            handlers[event] = handler;
            return personSelection;
        }),
        append: jest.fn(() => contentGroup),
        nodes: jest.fn(() => nodes),
    };

    return { personSelection, handlers, nodes };
};

const baseDatum = {
    depth: 0,
    x0: 0,
    x1: 0,
    data: {
        data: {
            xref: "I1",
            name: "Alex Example",
            thumbnail: "",
            silhouette: "",
            sex: "M",
            birth: "1900",
            marriageDate: "1920",
            death: "1980",
        },
    },
};

describe("Person tooltips", () => {
    beforeEach(() => {
        jest.spyOn(Person.prototype, "addArcToPerson").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addTitleToPerson").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addColorGroup").mockImplementation(() => {});
    });

    it("skips tooltip creation when the person data is empty", () => {
        const { personSelection } = createPersonSelection();
        const { div, htmlCalls } = createDivSelection();

        new Person(
            { div },
            { hideEmptySegments: false, isDrawn: () => true },
            {},
            personSelection,
            {
                ...baseDatum,
                data: { data: { xref: "" } },
            },
        );

        // No event handlers should be bound for empty xref
        expect(personSelection.on).not.toHaveBeenCalled();
        expect(htmlCalls).toHaveLength(0);
    });

    it("renders the thumbnail when images are enabled", () => {
        const { personSelection, handlers } = createPersonSelection();
        const { div, htmlCalls, styleCalls } = createDivSelection();
        const datum = {
            ...baseDatum,
            data: {
                data: {
                    ...baseDatum.data.data,
                    thumbnail: "thumb.jpg",
                },
            },
        };

        new Person(
            { div },
            {
                hideEmptySegments: false,
                isDrawn: () => true,
                showImages: true,
                showSilhouettes: true,
            },
            {},
            personSelection,
            datum,
        );

        // Trigger mouseenter to set tooltip HTML
        handlers.mouseenter({ pageX: 120, pageY: 80 });

        expect(htmlCalls[0]).toContain("thumb.jpg");
        expect(htmlCalls[0]).not.toContain("icon-silhouette");
        expect(styleCalls).toEqual([
            { name: "left", value: "120px" },
            { name: "top", value: "50px" },
        ]);
        expect(div.transition).not.toHaveBeenCalled();
    });

    it("renders the silhouette image when no real photo is available", () => {
        const { personSelection, handlers } = createPersonSelection();
        const { div, htmlCalls } = createDivSelection();
        // Server has fallen back to silhouette because the person has no
        // media file (or its file is missing on disk): thumbnail and
        // silhouette URLs are identical.
        const silhouetteUrl = "/silhouette-F.svg";
        const datum = {
            ...baseDatum,
            data: {
                data: {
                    ...baseDatum.data.data,
                    thumbnail: silhouetteUrl,
                    silhouette: silhouetteUrl,
                    sex: "F",
                },
            },
        };

        new Person(
            { div },
            {
                hideEmptySegments: false,
                isDrawn: () => true,
                showImages: true,
                showSilhouettes: true,
            },
            {},
            personSelection,
            datum,
        );

        handlers.mouseenter({ pageX: 200, pageY: 100 });

        expect(htmlCalls[0]).toContain(silhouetteUrl);
        // Single img (silhouette path), not the photo's two-img blur stack
        expect(htmlCalls[0].match(/<img/g)).toHaveLength(1);
    });

    it("escapes tooltip content", () => {
        const { personSelection, handlers } = createPersonSelection();
        const { div, htmlCalls } = createDivSelection();
        const datum = {
            ...baseDatum,
            data: {
                data: {
                    ...baseDatum.data.data,
                    name: "<script>alert(1)</script>",
                    birthPlace: "<b>unsafe</b>",
                    thumbnail: "javascript:alert(1)",
                },
            },
        };

        new Person(
            { div },
            {
                hideEmptySegments: false,
                isDrawn: () => true,
                showImages: true,
                showSilhouettes: false,
            },
            {},
            personSelection,
            datum,
        );

        handlers.mouseenter({ pageX: 120, pageY: 80 });

        expect(htmlCalls[0]).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(htmlCalls[0]).toContain("&lt;b&gt;unsafe&lt;/b&gt;");
        expect(htmlCalls[0]).not.toContain("<script>");
    });
});

describe("Person image size", () => {
    const imageConfiguration = {
        hideEmptySegments: false,
        showImages: true,
        showNames: false,
        numberOfInnerCircles: 3,
        centerCircleRadius: 40,
        isDrawn(depth) {
            return this.showNames || depth <= this.numberOfInnerCircles;
        },
    };

    const arc = ({ inner = 100, outer = 200, width = 400, degrees = 30 } = {}) => ({
        innerRadius: () => inner,
        outerRadius: () => outer,
        arcWidth: () => width,
        angularWidthDeg: () => degrees,
    });

    const renderPerson = (depth, geometry, configuration = imageConfiguration) => {
        const { personSelection } = createPersonSelection();
        const { div } = createDivSelection();
        const datum = {
            ...baseDatum,
            depth,
            data: { data: { ...baseDatum.data.data, thumbnail: "thumb.jpg" } },
        };

        new Person({ div }, configuration, geometry, personSelection, datum);

        return computeImageSize.mock.results.at(-1)?.value;
    };

    let computeImageSize;

    beforeEach(() => {
        jest.spyOn(Person.prototype, "addArcToPerson").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addTitleToPerson").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addColorGroup").mockImplementation(() => {});
        jest.spyOn(Person.prototype, "addImageToPerson").mockImplementation(() => {});
        computeImageSize = jest.spyOn(Person.prototype, "_computeImageSize");
    });

    it("hands the image size to the label and to the image instead of storing it on the datum", () => {
        const { personSelection } = createPersonSelection();
        const { div } = createDivSelection();
        const datum = {
            ...baseDatum,
            depth: 1,
            data: { data: { ...baseDatum.data.data, thumbnail: "thumb.jpg" } },
        };

        new Person(
            { div },
            { ...imageConfiguration, showNames: true },
            arc(),
            personSelection,
            datum,
        );

        expect(addLabelMock).toHaveBeenCalledWith(expect.anything(), datum, 40);
        expect(Person.prototype.addImageToPerson).toHaveBeenCalledWith(
            expect.anything(),
            datum,
            true,
            40,
        );
        expect(datum.data.data).not.toHaveProperty("imageSize");
    });

    it("tells the label there is no image and places none when the arc spans too few degrees", () => {
        const { personSelection } = createPersonSelection();
        const { div } = createDivSelection();
        const datum = {
            ...baseDatum,
            depth: 1,
            data: { data: { ...baseDatum.data.data, thumbnail: "thumb.jpg" } },
        };

        new Person(
            { div },
            { ...imageConfiguration, showNames: true },
            arc({ degrees: 5 }),
            personSelection,
            datum,
        );

        expect(addLabelMock).toHaveBeenCalledWith(expect.anything(), datum, 0);
        expect(Person.prototype.addImageToPerson).not.toHaveBeenCalled();
    });

    it("sizes the image from the arc height when names are shown", () => {
        expect(renderPerson(1, arc(), { ...imageConfiguration, showNames: true })).toBe(40);
    });

    it("sizes the image from the narrower of arc height and arc width without names", () => {
        expect(renderPerson(1, arc({ outer: 180, width: 50 }))).toBe(40);
    });

    it("limits the image to the arc height when the arc is wider than tall", () => {
        expect(renderPerson(1, arc({ outer: 150, width: 400 }))).toBe(40);
    });

    it("skips the image when the arc is too narrow for the minimum size", () => {
        expect(renderPerson(1, arc({ width: 20 }))).toBeNull();
    });

    it("skips the image when the arc spans too few degrees", () => {
        expect(renderPerson(1, arc({ degrees: 5 }))).toBeNull();
    });

    it("asks a descendant arc for a wider angle than an ancestor arc", () => {
        expect(renderPerson(1, arc({ degrees: 20 }))).toBe(80);
        expect(renderPerson(-2, arc({ degrees: 20 }))).toBeNull();
    });

    it("sizes the centre image from the centre circle regardless of the arc angle", () => {
        expect(renderPerson(0, arc({ width: 5, degrees: 1 }))).toBe(64);
    });
});

describe("Person.addImageToPerson", () => {
    const personWithThumbnail = (thumbnail) => ({
        ...baseDatum,
        data: { data: { ...baseDatum.data.data, thumbnail } },
    });

    it.each([
        ["no thumbnail", personWithThumbnail(""), 40],
        ["no computed image size", personWithThumbnail("thumb.png"), 0],
    ])("draws nothing for a person with %s", (_label, datum, imageSize) => {
        const person = { select: jest.fn(), append: jest.fn() };

        Person.prototype.addImageToPerson.call({}, person, datum, true, imageSize);

        expect(person.select).not.toHaveBeenCalled();
        expect(person.append).not.toHaveBeenCalled();
    });
});

describe("Person.addImageToPerson drawing", () => {
    // Records every append and attr call, so a test can read off what was
    // drawn without a DOM
    const createRecorder = () => {
        const recorded = [];
        const node = {
            append: (name) => {
                recorded.push(["append", name]);

                return node;
            },
            attr: (name, value) => {
                recorded.push([name, value]);

                return node;
            },
            select: () => node,
            selectAll: () => node,
            each: () => node,
        };

        return { node, recorded };
    };

    const drawImage = (depth, imageSize) => {
        const { node, recorded } = createRecorder();
        const context = {
            _svg: { defs: node },
            _geometry: {
                getFontSize: () => 14,
                startAngle: () => 0,
                endAngle: () => 1,
                centerRadius: () => 100,
                isPositionFlipped: () => false,
            },
        };
        const datum = {
            ...baseDatum,
            id: 7,
            depth,
            x0: 0,
            x1: 1,
            data: { data: { ...baseDatum.data.data, thumbnail: "thumb.png" } },
        };

        Person.prototype.addImageToPerson.call(context, node, datum, false, imageSize);

        return recorded;
    };

    it.each([
        ["the center", 0],
        ["an inner ancestor arc", 2],
    ])("draws the image of %s with the given size", (_label, depth) => {
        const recorded = drawImage(depth, 40);

        expect(recorded).toContainEqual(["width", 40]);
        expect(recorded).toContainEqual(["height", 40]);
        expect(recorded).toContainEqual(["x", -20]);
        expect(recorded).toContainEqual(["y", -20]);
        expect(recorded.filter(([name, value]) => name === "r" && value === 20)).toHaveLength(3);
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
        jest.spyOn(Person.prototype, "addColorGroup").mockImplementation(() => {});

        new Person(
            { div: divSelection },
            {
                hideEmptySegments: false,
                isDrawn: () => true,
                showImages: true,
                showSilhouettes: true,
            },
            {},
            personSelection,
            datum,
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
            style: jest.fn(),
        }));
        divSelection.transition = transitionSpy;

        handlers.contextmenu({ preventDefault: jest.fn() });

        expect(divSelection.property).toHaveBeenCalledWith("active", false);
        expect(transitionSpy).toHaveBeenCalled();
    });

    it("positions tooltip on mouse move", () => {
        handlers.mousemove({ pageX: 15, pageY: 45 });

        expect(divSelection.style).toHaveBeenCalledWith("left", "15px");
        expect(divSelection.style).toHaveBeenCalledWith("top", "15px");
    });

    it("updates hover classes on mouse over/out", () => {
        const node = {};

        handlers.mouseover({ currentTarget: node });
        handlers.mouseout({ currentTarget: node });

        expect(selectMock).toHaveBeenCalledWith(node);
        expect(hoverClassCalls).toEqual([
            { name: "hover", value: true },
            { name: "hover", value: false },
        ]);
    });
});
