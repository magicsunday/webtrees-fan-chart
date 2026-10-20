import { jest } from "@jest/globals";

const scaleLinearMock = jest.fn(() => {
    let domain = [0, 1];
    let range = [0, 1];

    const scale = (value) => {
        const [domainStart, domainEnd] = domain;
        const [rangeStart, rangeEnd] = range;
        const t = (value - domainStart) / (domainEnd - domainStart);

        return rangeStart + (rangeEnd - rangeStart) * t;
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
    },
    classed(name) {
        return (node.classes ?? []).includes(name);
    },
    attr(name, value) {
        node.attrs = { ...node.attrs, [name]: typeof value === "function" ? value() : value };

        return this;
    },
});

await jest.unstable_mockModule("resources/js/modules/d3", () => ({
    __esModule: true,
    scaleLinear: scaleLinearMock,
    select: jest.fn((node) => selectMock(node)),
}));

const { default: Geometry } = await import("resources/js/modules/svg/geometry");
const { default: ArcLabelLayout, TEXT_SLOT } = await import(
    "resources/js/modules/svg/arc-label-layout"
);

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
    ...overrides,
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
            ...overrides.data,
        },
    },
    ...overrides,
});

describe("ArcLabelLayout", () => {
    describe("getTimespan", () => {
        const createCompactGeometry = (compactChildren) => ({ compactChildren });

        const createChildDatum = (depth) => {
            const datum = createDatum({ depth });
            datum.data.data.timespan = "\u2605 1900 Rome";
            datum.data.data.compactTimespan = "\u2605 1900";

            return datum;
        };

        it("uses the compact range for a child while the child arcs are narrow", () => {
            const layout = new ArcLabelLayout(createConfiguration(), createCompactGeometry(true));

            expect(layout.getTimespan(createChildDatum(-2))).toBe("\u2605 1900");
        });

        it("keeps the regular timespan for a child while the child arcs are wide", () => {
            const layout = new ArcLabelLayout(createConfiguration(), createCompactGeometry(false));

            expect(layout.getTimespan(createChildDatum(-2))).toBe("\u2605 1900 Rome");
        });

        it.each([[-1], [1], [3]])("keeps the regular timespan at depth %i", (depth) => {
            const layout = new ArcLabelLayout(createConfiguration(), createCompactGeometry(true));

            expect(layout.getTimespan(createChildDatum(depth))).toBe("\u2605 1900 Rome");
        });

        it("keeps the regular timespan when the payload has no compact range", () => {
            const layout = new ArcLabelLayout(createConfiguration(), createCompactGeometry(true));
            const datum = createChildDatum(-2);
            delete datum.data.data.compactTimespan;

            expect(layout.getTimespan(datum)).toBe("\u2605 1900 Rome");
        });
    });

    describe("calculateSlotPositions", () => {
        const createSlotGeometry = (compactChildren) => ({
            compactChildren,
            getFontSize: () => 10,
            innerRadius: () => 100,
            outerRadius: () => 200,
        });

        const createSlotDatum = (timespan, compactTimespan) => {
            const datum = createDatum({ depth: -2 });
            datum.data.data.timespan = timespan;
            datum.data.data.compactTimespan = compactTimespan;

            return datum;
        };

        const calculate = (compactChildren, timespan, compactTimespan) =>
            new ArcLabelLayout(
                createConfiguration({ colorArcWidth: 10 }),
                createSlotGeometry(compactChildren),
            ).calculateSlotPositions(createSlotDatum(timespan, compactTimespan));

        it("reserves the date slots of the compact range while the child arcs are narrow", () => {
            const positions = calculate(true, "", "\u2605 1900");

            expect(positions.has(TEXT_SLOT.DATE_LINE_1)).toBe(true);
            expect(positions.has(TEXT_SLOT.DATE_LINE_2)).toBe(false);
        });

        it("reserves no date slot when only the regular range exists and the arcs are narrow", () => {
            const positions = calculate(true, "\u2605 1900 Rome", "");

            expect(positions.has(TEXT_SLOT.DATE_LINE_1)).toBe(false);
        });

        it("counts the lines of the compact range while the child arcs are narrow", () => {
            const positions = calculate(true, "\u2605 1900 Rome\n\u2020 1980 Paris", "\u2605 1900");

            expect(positions.has(TEXT_SLOT.DATE_LINE_2)).toBe(false);
        });

        it("counts the lines of the regular range while the child arcs are wide", () => {
            const positions = calculate(
                false,
                "\u2605 1900 Rome\n\u2020 1980 Paris",
                "\u2605 1900",
            );

            expect(positions.has(TEXT_SLOT.DATE_LINE_2)).toBe(true);
        });
    });

    describe("slot positions of the label stack", () => {
        // The expected values are the recorded output of the layout for a font
        // size of 10 px on an arc band that is 100 px high with a 10 px color
        // arc. They pin the layout before it is moved, so a rewrite that shifts
        // a label by even a fraction of a percent turns a test red.
        const createLayout = () =>
            new ArcLabelLayout(createConfiguration({ colorArcWidth: 10 }), {
                compactChildren: false,
                getFontSize: () => 10,
                innerRadius: () => 100,
                outerRadius: () => 200,
            });

        const positionsOf = (data, depth = 1) => {
            const datum = createDatum({ depth });

            Object.assign(datum.data.data, data);

            return [...createLayout().calculateSlotPositions(datum).entries()].map(
                ([slot, position]) => [slot.index, position.normal, position.flipped],
            );
        };

        it.each([
            [
                "first and last names only",
                { alternativeName: "", timespan: "" },
                1,
                [
                    [0, 46.75, 51.5],
                    [1, 35.75, 62.5],
                ],
            ],
            [
                "names, an alternative name and two date lines",
                { alternativeName: "Jana", timespan: "a\nb" },
                1,
                [
                    [0, 66.75, 31.5],
                    [1, 55.75, 42.5],
                    [2, 40.75, 57.5],
                    [3, 25.75, 72.5],
                    [4, 15.75, 82.5],
                ],
            ],
            [
                "a first name only with one date line shares its position with the last name slot",
                { lastNames: [], alternativeName: "", timespan: "a" },
                1,
                [
                    [0, 48.75, 49.5],
                    [3, 33.75, 64.5],
                    [1, 48.75, 49.5],
                ],
            ],
            [
                "a descendant label without the baseline shift of the ancestors",
                { alternativeName: "", timespan: "a" },
                -2,
                [
                    [0, 58, 44],
                    [1, 47, 55],
                    [3, 32, 70],
                ],
            ],
        ])("stacks %s", (_label, data, depth, expected) => {
            const actual = positionsOf(data, depth);

            expect(actual.map(([slot]) => slot)).toEqual(expected.map(([slot]) => slot));

            actual.forEach(([, normal, flipped], index) => {
                expect(normal).toBeCloseTo(expected[index][1], 6);
                expect(flipped).toBeCloseTo(expected[index][2], 6);
            });
        });
    });

    describe("calculateOuterSlotPositions", () => {
        const MATH_RAD2DEG = 180 / Math.PI;

        // Two name lines and one date line, at a font size of 10 px on a
        // centre radius of 100 px.
        const createLayoutElements = () => {
            const nodes = [{ classes: [] }, { classes: [] }, { classes: ["date"] }];

            return {
                each(callback) {
                    nodes.forEach((node) => callback.call(node));
                },
            };
        };

        const createLayout = (angularWidthDeg) =>
            new ArcLabelLayout(createConfiguration(), {
                getFontSize: () => 10,
                centerRadius: () => 100,
                angularWidthDeg: () => angularWidthDeg,
            });

        it("spaces the lines by the font size when the arc is wide enough", () => {
            const positions = createLayout(100).calculateOuterSlotPositions(
                createDatum({ depth: 4 }),
                createLayoutElements(),
            );

            const degPerPixel = MATH_RAD2DEG / 100;
            const nameGap = 11 * degPerPixel;
            const groupGap = 10 * degPerPixel;
            const total = nameGap + groupGap;

            expect(positions).toHaveLength(3);
            expect(positions[0]).toBeCloseTo(-total / 2);
            expect(positions[1]).toBeCloseTo(-total / 2 + nameGap);
            expect(positions[2]).toBeCloseTo(total / 2);
        });

        it("compresses the lines into 85 percent of a narrow arc", () => {
            const positions = createLayout(10).calculateOuterSlotPositions(
                createDatum({ depth: 4 }),
                createLayoutElements(),
            );

            expect(positions[0]).toBeCloseTo(-4.25);
            expect(positions[2]).toBeCloseTo(4.25);
        });
    });

    it("calculates available width using arc geometry for inner labels", () => {
        const configuration = createConfiguration();
        const geometry = new Geometry(configuration);
        const layout = new ArcLabelLayout(configuration, geometry);
        const datum = createDatum();
        const position = { normal: 73, flipped: 23 };

        const availableWidth = layout.getAvailableWidth(datum, position);

        const positionFlipped = geometry.isPositionFlipped(datum.depth, datum.x0, datum.x1);
        const offset = positionFlipped ? position.flipped : position.normal;

        expect(availableWidth).toBeCloseTo(
            Math.PI * geometry.relativeRadius(datum.depth, offset) - 23,
        );
    });

    it("calculates available width for outer arcs without geometry", () => {
        const layout = new ArcLabelLayout(createConfiguration(), {});
        const datum = createDatum({ depth: 4 });
        const position = { normal: 73, flipped: 23 };

        const availableWidth = layout.getAvailableWidth(datum, position);

        expect(availableWidth).toBe(150 - 20 - 5);
    });

    describe("getAvailableWidth", () => {
        // A half turn sector so that a datum fraction of 0.5 spans 90 degrees.
        const createWidthLayout = (imageSize = 0) => {
            const arcLength = jest.fn(() => 200);
            const geometry = {
                startAngle: () => 0,
                endAngle: () => Math.PI,
                innerRadius: () => 150,
                outerRadius: () => 200,
                isPositionFlipped: () => true,
                arcLength,
            };

            return {
                layout: new ArcLabelLayout(createConfiguration(), geometry, imageSize),
                arcLength,
            };
        };

        const position = { normal: 40, flipped: 60 };

        it("uses the height of a narrow descendant arc, which gets rotated text", () => {
            const { layout } = createWidthLayout();

            // 9 degrees is too narrow for arc text, so the line runs across the ring
            expect(
                layout.getAvailableWidth(createDatum({ depth: -2, x0: 0, x1: 0.05 }), position),
            ).toBe(200 - 150 - 20);
        });

        it("uses the chord of a wide descendant arc at the flipped position", () => {
            const { layout, arcLength } = createWidthLayout();
            const datum = createDatum({ depth: -1, x0: 0, x1: 0.5 });

            expect(layout.getAvailableWidth(datum, position)).toBe(200 - 20 - 3);
            expect(arcLength).toHaveBeenCalledWith(datum, 60);
        });

        it("uses the diameter of the center circle, a little narrower", () => {
            const { layout } = createWidthLayout();

            expect(layout.getAvailableWidth(createDatum({ depth: 0 }), position)).toBe(
                40 * 2 - 40 * 0.15 - 20 - 3,
            );
        });

        it.each([
            ["the center circle", 0, 40 * 2 - 40 * 0.15 - 20 - 3 - 40],
            ["an inner ancestor ring", 1, 200 - 20 - 3 - 40],
        ])("leaves room for the image on %s", (_label, depth, expected) => {
            const { layout } = createWidthLayout(30);

            expect(layout.getAvailableWidth(createDatum({ depth }), position)).toBe(expected);
        });

        it("still uses the chord on the last inner ancestor ring", () => {
            const { layout } = createWidthLayout();

            expect(layout.getAvailableWidth(createDatum({ depth: 2 }), position)).toBe(
                200 - 20 - 3,
            );
        });

        it("ignores the image on an outer ancestor ring", () => {
            const { layout } = createWidthLayout(30);

            expect(layout.getAvailableWidth(createDatum({ depth: 4 }), position)).toBe(
                150 - 20 - 5,
            );
        });
    });

    describe("isInnerLabel", () => {
        // A descendant sector that spans a half turn, so a datum fraction of
        // 0.1 is 18 degrees wide.
        const createSectorLayout = () =>
            new ArcLabelLayout(createConfiguration(), {
                startAngle: () => 0,
                endAngle: () => Math.PI,
            });

        const descendantOf = (depth, width) => createDatum({ depth, x0: 0, x1: width });

        it.each([
            ["the center", 0, false],
            ["the first ancestor ring", 1, true],
            ["the last inner ancestor ring", 2, true],
            ["an outer ancestor ring", 3, false],
        ])("decides for %s", (_label, depth, expected) => {
            expect(createSectorLayout().isInnerLabel(createDatum({ depth }))).toBe(expected);
        });

        it.each([
            ["a partner arc just over 30 degrees", -1, 0.17, true],
            ["a partner arc just under 30 degrees", -1, 0.16, false],
            ["a child arc just over 20 degrees", -2, 0.12, true],
            ["a child arc just under 20 degrees", -2, 0.11, false],
            ["a descendant ring beyond the inner rings", -3, 1, false],
        ])("decides for %s", (_label, depth, width, expected) => {
            expect(createSectorLayout().isInnerLabel(descendantOf(depth, width))).toBe(expected);
        });
    });

    describe("getTextOffset", () => {
        it("picks the flipped position for a flipped label and the normal one otherwise", () => {
            const layout = new ArcLabelLayout(createConfiguration(), {});
            const position = { normal: 40, flipped: 60 };

            expect(layout.getTextOffset(true, position)).toBe(60);
            expect(layout.getTextOffset(false, position)).toBe(40);
        });
    });
});
