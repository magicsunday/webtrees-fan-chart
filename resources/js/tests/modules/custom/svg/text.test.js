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

await jest.unstable_mockModule("resources/js/modules/d3", () => ({
    __esModule: true,
    scaleLinear: scaleLinearMock,
    select: jest.fn((node) => selectMock(node))
}));

// truncateNames and truncateToFit live in chart-lib since v1.2.0; chart-lib's
// own jest tests cover the abbreviation algorithm. Here we mock both so the
// fan-chart unit tests can assert that text.js wires them through correctly
// (right argument shape, right strategy from configuration).
const truncateNamesMock = jest.fn((names, _availableWidth, measureFn) => {
    // Call measureFn so the existing measureText call-count assertions
    // continue to reflect the integration contract.
    measureFn(names.map((n) => n.label).join(" "));

    // Simulate the GIVEN-strategy outcome the historical test expected:
    // shrink each label to its first letter + ".".
    return names.map((n) => ({ ...n, label: `${n.label.slice(0, 1)}.` }));
});
await jest.unstable_mockModule("@magicsunday/webtrees-chart-lib", () => ({
    measureText: measureTextMock,
    truncateNames: truncateNamesMock,
    truncateToFit: jest.fn((tspan) => tspan.text()),
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
    nameAbbreviation: "GIVEN",
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
        truncateNamesMock.mockClear();
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

        // Verify the chart-lib call signature: (names, width, measureFn, options)
        expect(truncateNamesMock).toHaveBeenCalledWith(
            nameGroup,
            100,
            expect.any(Function),
            expect.objectContaining({ strategy: "GIVEN" })
        );
    });

    it("passes the SURNAME strategy to truncateNames when configured", () => {
        truncateNamesMock.mockClear();
        const text = new Text(svgStub, createConfiguration({ nameAbbreviation: "SURNAME" }));
        const parent = {
            style: jest.fn((property) => (property === "font-size" ? "12px" : "700"))
        };

        text.truncateNamesData(parent, [
            { label: "Jón", isPreferred: true, isLastName: false, isNameRtl: false },
            { label: "Sigurðsson", isPreferred: false, isLastName: true, isNameRtl: false }
        ], 60);

        expect(truncateNamesMock).toHaveBeenCalledWith(
            expect.any(Array),
            expect.any(Number),
            expect.any(Function),
            expect.objectContaining({ strategy: "SURNAME" })
        );
    });

    it("calculates available width using arc geometry for inner labels", () => {
        const text = new Text(svgStub, createConfiguration());
        const datum = createDatum();
        const position = { normal: 73, flipped: 23 };

        const availableWidth = text.getAvailableWidth(datum, position);

        const positionFlipped = text.isPositionFlipped(datum.depth, datum.x0, datum.x1);
        const offset = positionFlipped ? position.flipped : position.normal;

        expect(availableWidth).toBeCloseTo((Math.PI * text._geometry.relativeRadius(datum.depth, offset)) - 23);
    });

    it("calculates available width for outer arcs without geometry", () => {
        const text = new Text(svgStub, createConfiguration());
        const datum = createDatum({ depth: 4 });
        const position = { normal: 73, flipped: 23 };

        const availableWidth = text.getAvailableWidth(datum, position);

        expect(availableWidth).toBe(150 - 20 - 5);
    });

});
