import { jest } from "@jest/globals";
import { scaleLinear } from "d3-scale";

await jest.unstable_mockModule("resources/js/modules/d3", () => ({
    __esModule: true,
    arc: jest.fn(() => ({
        startAngle: jest.fn().mockReturnThis(),
        endAngle: jest.fn().mockReturnThis(),
        innerRadius: jest.fn().mockReturnThis(),
        outerRadius: jest.fn().mockReturnThis(),
        padAngle: jest.fn().mockReturnThis(),
        padRadius: jest.fn().mockReturnThis(),
        cornerRadius: jest.fn().mockReturnThis(),
    })),
    select: jest.fn(),
    scaleLinear,
}));

await jest.unstable_mockModule("resources/js/modules/svg/arc", () => ({
    __esModule: true,
    appendArc(parent) {
        parent.append("g").attr("class", "arc").append("path");
    },
}));

const { default: Marriage } = await import("resources/js/modules/svg/marriage");
const { default: Geometry } = await import("resources/js/modules/svg/geometry");

const createSvgStub = () => ({
    defs: {
        select: jest.fn(() => ({ node: () => null })),
        append: jest.fn(() => ({
            attr: jest.fn().mockReturnThis(),
        })),
        get: jest.fn(() => ({
            selectAll: jest.fn(() => ({ size: () => 0 })),
        })),
    },
});

const createMarriageSelection = (classes = {}) => {
    const appendedGroups = [];

    const createAppendable = (trackInto) => {
        const el = {
            attr: jest.fn((name, value) => {
                if (name === "class" && value) {
                    el.className = value;
                }
                return el;
            }),
            style: jest.fn().mockReturnThis(),
            append: jest.fn((tag) => {
                const child = createAppendable(trackInto);
                child.tag = tag;

                if (trackInto) {
                    trackInto.push(child);
                }

                return child;
            }),
            text: jest.fn().mockReturnThis(),
            node: jest.fn(() => ({
                getComputedTextLength: () => 0,
                closest: () => ({ id: "marriage-0" }),
            })),
            className: "",
        };
        return el;
    };

    const selection = {
        classed: jest.fn((name) => Boolean(classes[name])),
        append: jest.fn((tag) => {
            const group = createAppendable(appendedGroups);
            group.tag = tag;
            appendedGroups.push(group);
            return group;
        }),
        attr: jest.fn(() => "marriage-0"),
        select: jest.fn(() => ({ empty: () => true })),
        selectAll: jest.fn(() => ({ size: () => 0 })),
    };

    return { selection, appendedGroups };
};

const createConfiguration = (overrides = {}) => ({
    hideEmptySegments: false,
    showParentMarriageDates: true,
    cornerRadius: 0,
    fontScale: 100,
    fontSize: 22,
    numberOfInnerCircles: 3,
    generations: 6,
    fanDegree: 180,
    innerArcHeight: 50,
    outerArcHeight: 60,
    centerCircleRadius: 100,
    circlePadding: 10,
    ...overrides,
});

const createDatum = (overrides = {}) => ({
    depth: 2,
    x0: 0,
    x1: 0.5,
    id: 5,
    children: [{ data: { data: { xref: "I10" } } }, { data: { data: { xref: "I11" } } }],
    data: {
        data: {
            xref: "I5",
            marriageDateOfParents: "8. Mai 1880",
            ...overrides.data,
        },
    },
    ...overrides,
});

describe("Marriage", () => {
    it("creates arc and label for nodes with children and marriage date", () => {
        const svg = createSvgStub();
        const { selection, appendedGroups } = createMarriageSelection();
        const config = createConfiguration();
        const datum = createDatum();

        new Marriage(svg, config, new Geometry(config), selection, datum);

        const arcGroup = appendedGroups.find((g) => g.tag === "g" && g.className === "arc");
        const nameGroup = appendedGroups.find((g) => g.tag === "g" && g.className === "name");

        expect(arcGroup).toBeDefined();
        expect(nameGroup).toBeDefined();
    });

    it("creates arc but no label when marriage date is empty", () => {
        const svg = createSvgStub();
        const { selection, appendedGroups } = createMarriageSelection();
        const config = createConfiguration();
        const datum = createDatum();
        datum.data.data.marriageDateOfParents = "";

        new Marriage(svg, config, new Geometry(config), selection, datum);

        const arcGroup = appendedGroups.find((g) => g.tag === "g" && g.className === "arc");
        const nameGroup = appendedGroups.find((g) => g.tag === "g" && g.className === "name");

        expect(arcGroup).toBeDefined();
        expect(nameGroup).toBeUndefined();
    });

    it("skips arc and label for remove-classified marriages", () => {
        const svg = createSvgStub();
        const { selection, appendedGroups } = createMarriageSelection({ remove: true });
        const config = createConfiguration();
        const datum = createDatum();

        new Marriage(svg, config, new Geometry(config), selection, datum);

        // Content wrapper is always created, but should contain no arc or label
        const contentGroup = appendedGroups.find((g) => g.className === "content");

        expect(contentGroup).toBeDefined();
        expect(appendedGroups.find((g) => g.className === "arc")).toBeUndefined();
        expect(appendedGroups.find((g) => g.className === "name")).toBeUndefined();
    });

    // The marriage arc sits in the gap of the parent generation, so its label is sized like the
    // generation one deeper. The sizes below are the results of the real geometry.
    it.each([
        // Inner circle: (22 - 3) * 100 / 100 for the generation behind depth 2
        ["an inner generation", 2, 0.5, 19],
        // Outer circle: depth 5 gets the extra point, (23 - 5) * 100 / 100
        ["an outer generation", 4, 0.5, 18],
        // The family of the central person is sized like generation one
        ["the central person", 0, 0.5, 21],
        // A negative depth does not shrink below generation one
        ["a descendant", -2, 0.5, 21],
    ])("sizes the label of %s like the generation one deeper", (_label, depth, x1, expected) => {
        const svg = createSvgStub();
        const { selection } = createMarriageSelection();
        const config = createConfiguration();
        const datum = createDatum({ depth, x1 });

        const marriage = new Marriage(svg, config, new Geometry(config), selection, datum);

        expect(marriage.getFontSize(datum)).toBeCloseTo(expected, 4);
    });

    it("caps the label of an outer generation to the width of the arc at the next generation", () => {
        const svg = createSvgStub();
        const { selection } = createMarriageSelection();
        const config = createConfiguration();
        const datum = createDatum({ depth: 4, x0: 0, x1: 0.01 });

        const marriage = new Marriage(svg, config, new Geometry(config), selection, datum);

        // Depth 5 has the centre radius 345 and the arc spans 1 % of 180 degrees:
        // 345 * 0.01 * PI * 0.55 / 2 lines. At the radius of depth 4, 285, the result would be 2.46.
        expect(marriage.getFontSize(datum)).toBeCloseTo(2.9805, 3);
    });
});
