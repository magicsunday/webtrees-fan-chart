import { jest } from "@jest/globals";

const mockSvgInstances = [];
let svgBoundingBox = { x: 0, y: 0, width: 0, height: 0 };

class PersonGroupSelection {
    constructor() {
        this.dataItems = [];
        this.filteredData = [];
        this.enterFilteredData = [];
        this.appendedAttributeValues = [];
    }

    selectAll() {
        const selection = {
            data: (data) => {
                this.dataItems = data;

                return {
                    enter: () => ({
                        filter: (predicate) => {
                            this.filteredData = this.dataItems.filter(predicate);
                            this.enterFilteredData = [...this.filteredData];

                            return {
                                append: () => {
                                    const attrSelection = {
                                        attr: (name, valueResolver) => {
                                            if (typeof valueResolver === "function") {
                                                this.appendedAttributeValues = this.filteredData.map(valueResolver);
                                            } else {
                                                this.appendedAttributeValues = this.filteredData.map(() => valueResolver);
                                            }

                                            return attrSelection;
                                        }
                                    };

                                    return attrSelection;
                                }
                            };
                        }
                    })
                };
            },
            each: () => selection,
            filter: (predicate) => {
                const source = this.enterFilteredData.length === 0 ? this.filteredData : this.enterFilteredData;
                this.filteredData = source.filter(predicate);
                return selection;
            },
            classed: () => selection,
            on: () => selection
        };

        return selection;
    }
}

class MockSvg {
    constructor(parent, configuration) {
        this.parent = parent;
        this.configuration = configuration;
        this.personGroup = new PersonGroupSelection();
        this.visual = {
            node: () => ({
                getBBox: () => svgBoundingBox
            })
        };
        this.attrCalls = [];

        mockSvgInstances.push(this);
    }

    initEvents() {
        return this;
    }

    select(selector) {
        if (selector === "g.personGroup") {
            return this.personGroup;
        }

        return null;
    }

    attr(name, value) {
        this.attrCalls.push({ name, value });
        return this;
    }
}

const setSvgBoundingBox = (boundingBox) => {
    svgBoundingBox = boundingBox;
};

await jest.unstable_mockModule("resources/js/modules/custom/svg", () => ({
    __esModule: true,
    default: MockSvg,
    mockSvgInstances,
    setSvgBoundingBox
}));

await jest.unstable_mockModule("resources/js/modules/lib/chart/overlay", () => ({
    __esModule: true,
    default: jest.fn(() => ({
        hide: jest.fn(),
        show: jest.fn()
    }))
}));

await jest.unstable_mockModule("resources/js/modules/custom/gradient", () => ({
    __esModule: true,
    default: jest.fn(() => ({
        init: jest.fn()
    }))
}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/person", () => ({
    __esModule: true,
    default: jest.fn(() => ({}))
}));

await jest.unstable_mockModule("resources/js/modules/custom/update", () => ({
    __esModule: true,
    default: jest.fn(() => ({
        update: jest.fn()
    }))
}));

const { default: Chart } = await import("resources/js/modules/custom/chart");

const createConfiguration = (overrides = {}) => ({
    hideEmptySegments: false,
    showColorGradients: false,
    generations: 2,
    rtl: false,
    labels: {
        zoom: "Zoom",
        move: "Move"
    },
    ...overrides
});

const createParentSelection = ({ width = 500, height = 400 } = {}) => {
    const boundingRect = {
        width,
        height,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height
    };

    return {
        html: jest.fn().mockReturnThis(),
        node: () => ({ getBoundingClientRect: () => boundingRect })
    };
};

const createHierarchyDatum = () => ({
    data: {
        id: 1,
        xref: "I1",
        url: "root-url",
        updateUrl: "root-update",
        generation: 1,
        name: "Root",
        firstNames: ["Root"],
        lastNames: ["Person"],
        preferredName: "Root Person",
        alternativeName: "",
        isAltRtl: false,
        sex: "M",
        timespan: "",
    },
    parents: [
        {
            data: {
                id: 2,
                xref: "I2",
                url: "parent-a",
                updateUrl: "parent-a-update",
                generation: 2,
                name: "Parent A",
                firstNames: ["Parent"],
                lastNames: ["A"],
                preferredName: "Parent A",
                alternativeName: "",
                isAltRtl: false,
                sex: "M",
                timespan: "",
            }
        },
        {
            data: {
                id: 3,
                xref: "",
                url: "parent-b",
                updateUrl: "parent-b-update",
                generation: 2,
                name: "Parent B",
                firstNames: ["Parent"],
                lastNames: ["B"],
                preferredName: "Parent B",
                alternativeName: "",
                isAltRtl: false,
                sex: "F",
                timespan: "",
            }
        }
    ]
});

describe("Chart", () => {
    beforeEach(() => {
        window.getComputedStyle = jest.fn(() => ({ fontSize: "16px" }));
        mockSvgInstances.length = 0;
        setSvgBoundingBox({ x: 0, y: 0, width: 400, height: 300 });
    });

    test("convertRemToPixels uses the document root font size", () => {
        const chart = new Chart(createParentSelection(), createConfiguration());
        const getComputedStyleSpy = jest.spyOn(window, "getComputedStyle")
            .mockReturnValue({ fontSize: "18px" });

        const result = chart.convertRemToPixels(2.5);

        expect(getComputedStyleSpy).toHaveBeenCalledWith(document.documentElement);
        expect(result).toBe(45);

        getComputedStyleSpy.mockRestore();
    });

    test("personGroup selection filters empty nodes only when empty segments are hidden", () => {
        const data = createHierarchyDatum();

        const chartWithVisibleEmptySegments = new Chart(createParentSelection(), createConfiguration({
            hideEmptySegments: false
        }));

        chartWithVisibleEmptySegments.data = data;
        chartWithVisibleEmptySegments.draw();

        const visibleNodes = mockSvgInstances[0].personGroup.enterFilteredData;

        expect(visibleNodes).toHaveLength(3);
        expect(visibleNodes.map((node) => node.data.data.xref)).toEqual(expect.arrayContaining(["I1", "I2", ""]));

        const chartWithHiddenEmptySegments = new Chart(createParentSelection(), createConfiguration({
            hideEmptySegments: true
        }));

        chartWithHiddenEmptySegments.data = data;
        chartWithHiddenEmptySegments.draw();

        const filteredNodes = mockSvgInstances[1].personGroup.enterFilteredData;

        expect(filteredNodes).toHaveLength(2);
        expect(filteredNodes.every((node) => node.data.data.xref !== "")).toBe(true);
    });

    test("draw sets viewBox using container size and padding", () => {
        const data = createHierarchyDatum();
        const parentSelection = createParentSelection({ width: 500, height: 400 });

        const chart = new Chart(parentSelection, createConfiguration());

        chart.data = data;
        chart.draw();

        const viewBoxCall = mockSvgInstances[0].attrCalls.find((call) => call.name === "viewBox");

        expect(viewBoxCall.value).toEqual([-66, -66, 532, 432]);
    });

    test("updateViewBox respects fullscreen dimensions", () => {
        const data = createHierarchyDatum();
        const parentSelection = createParentSelection({ width: 600, height: 450 });
        const chart = new Chart(parentSelection, createConfiguration());
        const getComputedStyleSpy = jest.spyOn(window, "getComputedStyle")
            .mockReturnValue({ fontSize: "16px" });

        setSvgBoundingBox({ x: 0, y: 0, width: 400, height: 300 });
        chart.data = data;
        chart.draw();

        document.fullscreenElement = {
            getBoundingClientRect: () => ({ width: 800, height: 600 })
        };
        chart.updateViewBox();

        const svg = mockSvgInstances[0];
        const widthCall = svg.attrCalls.filter((call) => call.name === "width").pop();
        const heightCall = svg.attrCalls.filter((call) => call.name === "height").pop();
        const viewBoxCall = svg.attrCalls.filter((call) => call.name === "viewBox").pop();

        expect(widthCall?.value).toBe(800);
        expect(heightCall?.value).toBe(600);
        expect(viewBoxCall?.value).toEqual([0, 0, 400, 300]);

        document.fullscreenElement = null;
        getComputedStyleSpy.mockRestore();
    });
});
