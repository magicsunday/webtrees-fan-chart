import { jest } from "@jest/globals";

const measureTextMock = jest.fn((text) => text.length * 10);

const scaleLinearMock = jest.fn(() => {
    let domain = [0, 1];
    let range = [0, 1];

    const scale = (value) => {
        const [domainStart, domainEnd] = domain;
        const [rangeStart, rangeEnd] = range;
        const t = (value - domainStart) / (domainEnd - domainStart);

        return rangeStart + ((rangeEnd - rangeStart) * t);
    };

    scale.range = (values) => {
        range = values;
        return scale;
    };

    scale.domain = (values) => {
        domain = values;
        return scale;
    };

    return scale;
});

const selectMock = (node) => ({
    text(value) {
        if (typeof value === "undefined") {
            return node.textContent;
        }

        node.textContent = value;
        return this;
    }
});

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    scaleLinear: scaleLinearMock,
    select: jest.fn((node) => selectMock(node))
}));

await jest.unstable_mockModule("resources/js/modules/lib/chart/text/measure", () => ({
    __esModule: true,
    default: measureTextMock
}));

const { default: Text } = await import("resources/js/modules/custom/svg/text");

const createConfiguration = (overrides = {}) => ({
    numberOfInnerCircles: 2,
    innerArcHeight: 60,
    outerArcHeight: 150,
    centerCircleRadius: 40,
    circlePadding: 5,
    textPadding: 10,
    padDistance: 6,
    padAngle: 0,
    padRadius: 0,
    colorArcWidth: 20,
    fanDegree: 180,
    fontScale: 100,
    ...overrides
});

const createDatum = (overrides = {}) => ({
    depth: 1,
    x0: 0,
    x1: 1,
    data: {
        data: {
            name: "Jane Marie Doe",
            firstNames: ["Jane", "Marie"],
            lastNames: ["Doe"],
            preferredName: "Marie",
            alternativeName: "",
            isAltRtl: false,
            isNameRtl: false,
            timespan: "",
            marriageDateOfParents: null,
            ...overrides.data
        }
    },
    ...overrides
});

describe("Text", () => {
    const svgStub = {
        style: jest.fn(() => "Arial"),
        defs: { select: jest.fn(), append: jest.fn(() => ({ append: jest.fn() })) }
    };

    beforeEach(() => {
        measureTextMock.mockClear();
        scaleLinearMock.mockClear();
    });

    it("splits full names into ordered label groups", () => {
        const text = new Text(svgStub, createConfiguration());
        const datum = createDatum();

        const [firstNames, lastNames] = text.createNamesData(datum);

        expect(firstNames).toEqual([
            { label: "Jane", isPreferred: false, isLastName: false, isNameRtl: false },
            { label: "Marie", isPreferred: true, isLastName: false, isNameRtl: false }
        ]);
        expect(lastNames).toEqual([
            { label: "Doe", isPreferred: false, isLastName: true, isNameRtl: false }
        ]);
    });

    it("truncates names based on available width and preference", () => {
        const text = new Text(svgStub, createConfiguration());
        const nameGroup = [
            { label: "Anna", isPreferred: false, isLastName: false, isNameRtl: false },
            { label: "Beatrice", isPreferred: true, isLastName: false, isNameRtl: false }
        ];
        const parent = {
            style: jest.fn((property) => (property === "font-size" ? "12px" : "700"))
        };

        const truncated = text.truncateNamesData(parent, nameGroup, 100);

        expect(measureTextMock).toHaveBeenCalled();
        expect(truncated.map((name) => name.label)).toEqual(["A.", "B."]);
        expect(parent.style).toHaveBeenCalledWith("font-size");
        expect(parent.style).toHaveBeenCalledWith("font-weight");
    });

    it("calculates available width using arc geometry for inner labels", () => {
        const text = new Text(svgStub, createConfiguration());
        const datum = createDatum();

        const availableWidth = text.getAvailableWidth(datum, 0);

        expect(availableWidth).toBeCloseTo((Math.PI * text._geometry.relativeRadius(datum.depth, 73)) - 23);
    });

    it("calculates available width for outer arcs without geometry", () => {
        const text = new Text(svgStub, createConfiguration());
        const datum = createDatum({ depth: 4 });

        const availableWidth = text.getAvailableWidth(datum, 0);

        expect(availableWidth).toBe(150 - 20 - 5);
    });

    it("truncates date labels without trailing dots", () => {
        const text = new Text(svgStub, createConfiguration());
        const tspanNode = {
            textContent: "01 JAN. 1900",
            getComputedTextLength() {
                return this.textContent.length * 10;
            }
        };
        const parent = {
            selectAll: () => ({
                each: (callback) => {
                    callback.call(tspanNode);
                }
            })
        };

        text.getTextLength = jest.fn(() => tspanNode.getComputedTextLength());

        const truncate = text.truncateDate(parent, 50);
        truncate.call(tspanNode);

        expect(tspanNode.textContent.endsWith(".")).toBe(false);
        expect(tspanNode.textContent.length * 10).toBeLessThanOrEqual(50);
    });
});
