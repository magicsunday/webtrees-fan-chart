import { jest } from "@jest/globals";

const measureTextMock = jest.fn((text) => text.length * 10);

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
    arc: jest.fn(() => {
        const generator = () => "M0,0";

        for (const setter of [
            "startAngle",
            "endAngle",
            "innerRadius",
            "outerRadius",
            "padAngle",
            "padRadius",
            "cornerRadius",
        ]) {
            generator[setter] = () => generator;
        }

        return generator;
    }),
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
await jest.unstable_mockModule("@magicsunday/webtrees-chart-lib/infra", () => ({
    measureText: measureTextMock,
    truncateNames: truncateNamesMock,
    truncateToFit: jest.fn((tspan) => tspan.text()),
}));

const { default: Text } = await import("resources/js/modules/svg/text");

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

describe("Text", () => {
    const svgStub = {
        style: jest.fn(() => "Arial"),
        defs: { select: jest.fn(), append: jest.fn(() => ({ append: jest.fn() })) },
    };

    beforeEach(() => {
        measureTextMock.mockClear();
        scaleLinearMock.mockClear();
    });

    it("truncates names based on available width and preference", () => {
        truncateNamesMock.mockClear();
        const text = new Text(svgStub, createConfiguration());
        const nameGroup = [
            { label: "Anna", isPreferred: false, isLastName: false, isNameRtl: false },
            { label: "Beatrice", isPreferred: true, isLastName: false, isNameRtl: false },
        ];
        const parent = {
            style: jest.fn((property) => (property === "font-size" ? "12px" : "700")),
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
            expect.objectContaining({ strategy: "GIVEN" }),
        );
    });

    it("passes the SURNAME strategy to truncateNames when configured", () => {
        truncateNamesMock.mockClear();
        const text = new Text(svgStub, createConfiguration({ nameAbbreviation: "SURNAME" }));
        const parent = {
            style: jest.fn((property) => (property === "font-size" ? "12px" : "700")),
        };

        text.truncateNamesData(
            parent,
            [
                { label: "Jón", isPreferred: true, isLastName: false, isNameRtl: false },
                { label: "Sigurðsson", isPreferred: false, isLastName: true, isNameRtl: false },
            ],
            60,
        );

        expect(truncateNamesMock).toHaveBeenCalledWith(
            expect.any(Array),
            expect.any(Number),
            expect.any(Function),
            expect.objectContaining({ strategy: "SURNAME" }),
        );
    });

    describe("renderTimespanLines", () => {
        const createPositions = () =>
            new Map([
                [Text.TEXT_SLOT.DATE_LINE_1, { normal: 40, flipped: 60 }],
                [Text.TEXT_SLOT.DATE_LINE_2, { normal: 50, flipped: 50 }],
            ]);

        const createLineContainer = () => {
            const container = {
                children: [],
                append: jest.fn((name) => {
                    const child = { name, textContent: "" };
                    child.text = jest.fn((value) => {
                        if (value === undefined) {
                            return child.textContent;
                        }

                        child.textContent = value;

                        return child;
                    });
                    container.children.push(child);

                    return child;
                }),
            };

            return container;
        };

        it("creates a titled text line for each of the first two timespan lines", () => {
            const text = new Text(svgStub, createConfiguration());
            const datum = createDatum();
            datum.data.data.timespan = "\u2605 1900 Rome\n\u2020 1980 Paris\nignored";
            const positions = createPositions();
            const containers = [];
            const createElement = jest.fn(() => {
                const container = createLineContainer();
                containers.push(container);

                return container;
            });

            text.renderTimespanLines(datum, positions, createElement);

            expect(createElement).toHaveBeenCalledTimes(2);
            expect(createElement).toHaveBeenNthCalledWith(1, Text.TEXT_SLOT.DATE_LINE_1, {
                normal: 40,
                flipped: 60,
            });
            expect(createElement).toHaveBeenNthCalledWith(2, Text.TEXT_SLOT.DATE_LINE_2, {
                normal: 50,
                flipped: 50,
            });
            expect(containers[0].children.map((child) => [child.name, child.textContent])).toEqual([
                ["title", "\u2605 1900 Rome"],
                ["tspan", "\u2605 1900 Rome"],
            ]);
            expect(containers[1].children.map((child) => [child.name, child.textContent])).toEqual([
                ["title", "\u2020 1980 Paris"],
                ["tspan", "\u2020 1980 Paris"],
            ]);
        });

        it("creates nothing for an empty timespan", () => {
            const text = new Text(svgStub, createConfiguration());
            const createElement = jest.fn();

            text.renderTimespanLines(createDatum(), createPositions(), createElement);

            expect(createElement).not.toHaveBeenCalled();
        });

        const createCompactChildDatum = () => {
            const datum = createDatum({ depth: -2 });
            datum.data.data.timespan = "\u2605 1900 Rome";
            datum.data.data.compactTimespan = "\u2605 1900";

            return datum;
        };

        it("renders the compact range of a narrow child", () => {
            const text = new Text(svgStub, createConfiguration(), { compactChildren: true });
            const titles = [];
            const tspans = [];

            // The arc width is irrelevant here, the test only reads the rendered line.
            text._layout.getAvailableWidth = jest.fn(() => 1000);
            const createElement = jest.fn(() => {
                const container = {
                    append: jest.fn((name) => {
                        const child = { text: jest.fn(() => child) };
                        if (name === "title") {
                            titles.push(child);
                        }

                        if (name === "tspan") {
                            tspans.push(child);
                        }

                        return child;
                    }),
                };

                return container;
            });
            const positions = new Map([
                [Text.TEXT_SLOT.DATE_LINE_1, { normal: 40, flipped: 60 }],
                [Text.TEXT_SLOT.DATE_LINE_2, { normal: 50, flipped: 50 }],
            ]);

            text.renderTimespanLines(createCompactChildDatum(), positions, createElement);

            expect(titles[0].text).toHaveBeenCalledWith("\u2605 1900");
            expect(tspans[0].text).toHaveBeenCalledWith("\u2605 1900");
        });
    });

    describe("createLabels", () => {
        it.each([
            ["inner arc text for an inner label", true, "createInnerLabels", "createOuterLabels"],
            ["rotated text for an outer label", false, "createOuterLabels", "createInnerLabels"],
        ])("hands the slot positions to %s", (_label, isInner, expectedCall, otherCall) => {
            const text = new Text(svgStub, createConfiguration(), {});
            const positions = new Map();
            const parent = {};
            const datum = createDatum();

            text._layout.isInnerLabel = jest.fn(() => isInner);
            text._layout.calculateSlotPositions = jest.fn(() => positions);
            text.createInnerLabels = jest.fn();
            text.createOuterLabels = jest.fn();

            text.createLabels(parent, datum);

            expect(text._layout.calculateSlotPositions).toHaveBeenCalledWith(datum);
            expect(text[expectedCall]).toHaveBeenCalledWith(parent, datum, positions);
            expect(text[otherCall]).not.toHaveBeenCalled();
        });
    });

    describe("createPathDefinition", () => {
        const createPathText = (positionFlipped) => {
            const relativeRadius = jest.fn(() => 50);
            const path = { attr: () => path };
            const defs = {
                select: () => ({ node: () => null }),
                append: () => path,
            };
            const text = new Text({ style: jest.fn(() => "Arial"), defs }, createConfiguration(), {
                isPositionFlipped: () => positionFlipped,
                startAngle: () => 0,
                endAngle: () => 1,
                relativeRadius,
            });

            return { text, relativeRadius };
        };

        it.each([
            ["the flipped position on a flipped label", true, 60],
            ["the normal position on a label read in reading direction", false, 40],
        ])("places the path at %s", (_label, positionFlipped, expectedOffset) => {
            const { text, relativeRadius } = createPathText(positionFlipped);

            text.createPathDefinition(
                "person-1",
                Text.TEXT_SLOT.FIRST_NAMES,
                { normal: 40, flipped: 60 },
                createDatum({ depth: 1 }),
            );

            expect(relativeRadius).toHaveBeenCalledWith(1, expectedOffset);
        });
    });

    describe("vertical stack of the center label", () => {
        const dyOf = (imageSize, classesList) => {
            const nodes = classesList.map((classes) => ({ classes }));
            const parent = {
                selectAll: () => ({
                    size: () => nodes.length,
                    each(callback) {
                        nodes.forEach((node, index) => callback.call(node, node, index));
                    },
                }),
            };
            const datum = createDatum({ depth: 0 });

            datum.data.data.imageSize = imageSize;

            new Text(svgStub, createConfiguration(), { getFontSize: () => 10 }).transformOuterText(
                parent,
                datum,
            );

            return nodes.map((node) => node.attrs.dy);
        };

        it("centers a name, alternative name and date stack without an image", () => {
            expect(dyOf(0, [[], [], ["wt-chart-box-name-alt"], ["date"], ["date"]])).toEqual([
                "-22px",
                "-12.5px",
                "2px",
                "16.5px",
                "26px",
            ]);
        });

        it("places the stack below the image when there is one", () => {
            expect(dyOf(40, [[], [], ["date"], ["date"]])).toEqual([
                "6.5px",
                "16px",
                "30px",
                "39.5px",
            ]);
        });
    });

    describe("slot lookups", () => {
        it("returns the slot at the given index", () => {
            const text = new Text(svgStub, createConfiguration());
            const slots = [Text.TEXT_SLOT.FIRST_NAMES, Text.TEXT_SLOT.LAST_NAMES];

            expect(text.getSlot(slots, 1)).toBe(Text.TEXT_SLOT.LAST_NAMES);
        });

        it("throws when the slot list has no entry at the index", () => {
            const text = new Text(svgStub, createConfiguration());

            expect(() => text.getSlot([Text.TEXT_SLOT.FIRST_NAMES], 3)).toThrow(
                "No text slot at index 3",
            );
        });

        it("returns the position assigned to a slot", () => {
            const text = new Text(svgStub, createConfiguration());
            const position = { normal: 40, flipped: 60 };
            const positions = new Map([[Text.TEXT_SLOT.DATE_LINE_1, position]]);

            expect(text.getSlotPosition(positions, Text.TEXT_SLOT.DATE_LINE_1)).toBe(position);
        });

        it("throws when no position was calculated for a slot", () => {
            const text = new Text(svgStub, createConfiguration());

            expect(() => text.getSlotPosition(new Map(), Text.TEXT_SLOT.DATE_LINE_2)).toThrow(
                `No text position calculated for slot ${Text.TEXT_SLOT.DATE_LINE_2.index}`,
            );
        });
    });

    describe("transformOuterText", () => {
        const createDescendantText = (childScale) =>
            new Text(svgStub, createConfiguration(), {
                childScale,
                getFontSize: () => 10,
                centerRadius: () => 100,
                angularWidthDeg: () => 100,
            });

        const transformOf = (text) => {
            const node = { classes: [] };
            const parent = {
                selectAll: () => ({
                    size: () => 1,
                    each(callback) {
                        callback.call(node, node, 0);
                    },
                }),
            };

            text.transformOuterText(parent, { depth: -2, x0: 0.4, x1: 0.6 });

            return node.attrs.transform;
        };

        it("rotates a descendant label to the middle of its arc on the child scale", () => {
            const transform = transformOf(
                createDescendantText((fraction) => fraction * 2 * Math.PI),
            );

            // Middle of the arc at half a turn, flipped: 180 - (90 - baseline angle)
            expect(transform).toMatch(/^rotate\(90\.57\d*\) translate\(90\)$/);
        });

        it("falls back to the top when the descendant sector has no scale", () => {
            const transform = transformOf(createDescendantText(null));

            expect(transform).toMatch(/^rotate\(-89\.42\d*\) translate\(90\)$/);
        });
    });
});
