import { jest } from "@jest/globals";

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
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
    select: jest.fn()
}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/arc", () => ({
    __esModule: true,
    appendArc(parent) {
        parent.append("g").attr("class", "arc").append("path");
    },
}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/geometry", () => ({
    __esModule: true,
    MATH_DEG2RAD: Math.PI / 180,
    MATH_RAD2DEG: 180 / Math.PI,
    default: class {
        constructor(config) { this._configuration = config; }
        startAngle() { return 0; }
        endAngle() { return 1; }
        innerRadius(depth) { return 50 + depth * 100; }
        outerRadius(depth) { return 100 + depth * 100; }
        calcAngle() { return 0; }
        isPositionFlipped() { return false; }
        getFontSize(datum) {
            let fontSize = this._configuration.fontSize;
            if (datum.depth >= (this._configuration.numberOfInnerCircles + 1)) {
                fontSize += 1;
            }
            return ((fontSize - datum.depth) * this._configuration.fontScale / 100.0);
        }
    },
}));

const { default: Marriage } = await import("resources/js/modules/custom/svg/marriage");

const createSvgStub = () => ({
    defs: {
        select: jest.fn(() => ({ node: () => null })),
        append: jest.fn(() => ({
            attr: jest.fn().mockReturnThis(),
        })),
        get: jest.fn(() => ({
            selectAll: jest.fn(() => ({ size: () => 0 }))
        }))
    }
});

const createMarriageSelection = (classes = {}) => {
    const appendedGroups = [];

    const createAppendable = () => {
        const el = {
            attr: jest.fn((name, value) => {
                if (name === "class" && value) { el.className = value; }
                return el;
            }),
            style: jest.fn().mockReturnThis(),
            append: jest.fn(() => createAppendable()),
            text: jest.fn().mockReturnThis(),
            node: jest.fn(() => ({ getComputedTextLength: () => 0 })),
            className: ""
        };
        return el;
    };

    const selection = {
        classed: jest.fn((name) => Boolean(classes[name])),
        append: jest.fn((tag) => {
            const group = createAppendable();
            group.tag = tag;
            appendedGroups.push(group);
            return group;
        }),
        attr: jest.fn(() => "marriage-0"),
        select: jest.fn(() => ({ empty: () => true })),
        selectAll: jest.fn(() => ({ size: () => 0 }))
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
    ...overrides
});

const createDatum = (overrides = {}) => ({
    depth: 2,
    x0: 0,
    x1: 0.5,
    id: 5,
    children: [
        { data: { data: { xref: "I10" } } },
        { data: { data: { xref: "I11" } } }
    ],
    data: {
        data: {
            xref: "I5",
            marriageDateOfParents: "8. Mai 1880",
            ...overrides.data
        }
    },
    ...overrides
});

describe("Marriage", () => {
    it("creates arc and label for nodes with children and marriage date", () => {
        const svg = createSvgStub();
        const { selection, appendedGroups } = createMarriageSelection();
        const config = createConfiguration();
        const datum = createDatum();

        new Marriage(svg, config, selection, datum);

        const arcGroup = appendedGroups.find(g => g.tag === "g" && g.className === "arc");
        const nameGroup = appendedGroups.find(g => g.tag === "g" && g.className === "name");

        expect(arcGroup).toBeDefined();
        expect(nameGroup).toBeDefined();
    });

    it("creates arc but no label when marriage date is empty", () => {
        const svg = createSvgStub();
        const { selection, appendedGroups } = createMarriageSelection();
        const config = createConfiguration();
        const datum = createDatum();
        datum.data.data.marriageDateOfParents = "";

        new Marriage(svg, config, selection, datum);

        const arcGroup = appendedGroups.find(g => g.tag === "g" && g.className === "arc");
        const nameGroup = appendedGroups.find(g => g.tag === "g" && g.className === "name");

        expect(arcGroup).toBeDefined();
        expect(nameGroup).toBeUndefined();
    });

    it("skips arc and label for remove-classified marriages", () => {
        const svg = createSvgStub();
        const { selection, appendedGroups } = createMarriageSelection({ remove: true });
        const config = createConfiguration();
        const datum = createDatum();

        new Marriage(svg, config, selection, datum);

        expect(appendedGroups).toHaveLength(0);
    });

    it("calculates font size based on depth and scale", () => {
        const svg = createSvgStub();
        const { selection } = createMarriageSelection();
        const config = createConfiguration({ fontSize: 22, fontScale: 100, numberOfInnerCircles: 3 });
        const datum = createDatum({ depth: 2 });

        const marriage = new Marriage(svg, config, selection, datum);

        // getFontSize now uses depth+1 internally: (22 - 3) * 100 / 100.0 = 19
        expect(marriage.getFontSize(datum)).toBe(19);
    });

    it("adds 1 to font size for outer circles", () => {
        const svg = createSvgStub();
        const { selection } = createMarriageSelection();
        const config = createConfiguration({ fontSize: 22, fontScale: 100, numberOfInnerCircles: 3 });
        const datum = createDatum({ depth: 4 });

        const marriage = new Marriage(svg, config, selection, datum);

        // getFontSize now uses depth+1 internally: depth 5 >= numberOfInnerCircles + 1 (4), so fontSize = 23
        // (23 - 5) * 100 / 100.0 = 18
        expect(marriage.getFontSize(datum)).toBe(18);
    });
});
