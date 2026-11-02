import { jest } from "@jest/globals";

const SEX_MALE = "M";
const SEX_FEMALE = "F";

await jest.unstable_mockModule("resources/js/modules/hierarchy", () => ({
    __esModule: true,
    SEX_MALE,
    SEX_FEMALE,
    default: jest.fn(),
}));

const { default: FamilyColor } = await import("resources/js/modules/svg/family-color");

const createConfiguration = (overrides = {}) => ({
    paternalColor: "#3b82b0",
    maternalColor: "#d06f94",
    ...overrides,
});

// The default colors of the module are far apart in hue, so the side of a color is readable from its
// hue alone. The paternal base is a blue and the maternal base a pink. A color of a branch stays within
// a quarter turn of its base hue, so the two bands do not overlap.
const PATERNAL_HUE = 204;
const MATERNAL_HUE = 337;
const BRANCH_SPREAD = 90;

const hueOf = (color) => Number(/^hsl\((\d+(?:\.\d+)?),/.exec(color)?.[1]);

// The distance of two hues on the color wheel, so the pink band across zero degrees is no special case.
const hueDistance = (first, second) => {
    const difference = Math.abs(first - second) % 360;

    return Math.min(difference, 360 - difference);
};

const isPaternal = (color) =>
    hueDistance(hueOf(color), PATERNAL_HUE) < hueDistance(hueOf(color), MATERNAL_HUE) &&
    hueDistance(hueOf(color), PATERNAL_HUE) <= BRANCH_SPREAD;

const isMaternal = (color) =>
    hueDistance(hueOf(color), MATERNAL_HUE) < hueDistance(hueOf(color), PATERNAL_HUE) &&
    hueDistance(hueOf(color), MATERNAL_HUE) <= BRANCH_SPREAD;

// hexToHsl tests live in @magicsunday/webtrees-chart-lib
// (tests/color/familyColor.test.js) — the helper moved out of this class.

describe("FamilyColor.getColor", () => {
    it("returns null for empty xref nodes", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 1,
            x0: 0,
            x1: 0.5,
            parent: null,
            data: { data: { xref: "", sex: SEX_MALE } },
        };

        expect(fc.getColor(datum)).toBeNull();
    });

    it("gives a male center the paternal hue", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 0,
            x0: 0,
            x1: 1,
            data: { data: { xref: "I1", sex: SEX_MALE } },
        };

        const color = fc.getColor(datum);

        expect(hueOf(color)).toBe(PATERNAL_HUE);
        expect(color).toContain("%");
    });

    it("gives a female center the maternal hue", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 0,
            x0: 0,
            x1: 1,
            data: { data: { xref: "I1", sex: SEX_FEMALE } },
        };

        expect(hueOf(fc.getColor(datum))).toBe(MATERNAL_HUE);
    });

    it("returns gray HSL for center node with unknown sex", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 0,
            x0: 0,
            x1: 1,
            data: { data: { xref: "I1", sex: "U" } },
        };

        expect(fc.getColor(datum)).toBe("hsl(0, 0%, 92%)");
    });

    it("gives an ancestor of the left half the paternal hue", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 1,
            x0: 0,
            x1: 0.25,
            parent: null,
            data: { data: { xref: "I2", sex: SEX_MALE } },
        };

        expect(isPaternal(fc.getColor(datum))).toBe(true);
    });

    it("returns non-null HSL string for depth < 0 nodes (descendants)", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);

        // Pre-set partner midpoints so descendant lookups work
        fc.setPartnerMidpoints([{ depth: -1, id: 10, x0: 0, x1: 0.5 }]);

        const datum = {
            depth: -1,
            x0: 0,
            x1: 0.5,
            id: 10,
            descendantType: "partner",
            syntheticParentId: null,
            data: { data: { xref: "I5", sex: SEX_FEMALE } },
        };

        const color = fc.getColor(datum);

        expect(color).not.toBeNull();
        expect(color).toMatch(/^hsl\(/);
    });
});

describe("FamilyColor side of the family", () => {
    const createAncestor = (depth, x0, x1, parent = null) => ({
        depth,
        x0,
        x1,
        parent,
        data: { data: { xref: "I2", sex: SEX_MALE } },
    });

    it.each([
        ["at the start of the chart", 0, 0.1],
        ["in the left half", 0.1, 0.4],
        ["just before the center line", 0.3, 0.6998],
    ])(
        "colors an ancestor of the first generation paternal when its middle lies %s",
        (_place, x0, x1) => {
            const fc = new FamilyColor(createConfiguration());

            expect(isPaternal(fc.getColor(createAncestor(1, x0, x1)))).toBe(true);
        },
    );

    it.each([
        ["exactly on the center line", 0.25, 0.75],
        ["in the right half", 0.6, 0.9],
        ["at the end of the chart", 0.9, 1],
    ])(
        "colors an ancestor of the first generation maternal when its middle lies %s",
        (_place, x0, x1) => {
            const fc = new FamilyColor(createConfiguration());

            expect(isMaternal(fc.getColor(createAncestor(1, x0, x1)))).toBe(true);
        },
    );

    it("takes the side of an outer ancestor from its child and not from its own position", () => {
        const fc = new FamilyColor(createConfiguration());
        const maternalChild = createAncestor(1, 0.5, 0.75);
        const paternalChild = createAncestor(1, 0.25, 0.5);

        // Both parents sit in the left half of the chart, yet their colors follow the child's side.
        const motherSide = createAncestor(2, 0.1, 0.2, maternalChild);
        const fatherSide = createAncestor(2, 0.6, 0.7, paternalChild);

        expect(isMaternal(fc.getColor(motherSide))).toBe(true);
        expect(isPaternal(fc.getColor(fatherSide))).toBe(true);
    });

    it("gives both parents of a child the same hue", () => {
        const fc = new FamilyColor(createConfiguration());
        const child = createAncestor(1, 0.5, 0.75);

        expect(hueOf(fc.getColor(createAncestor(2, 0.5, 0.6, child)))).toBe(
            hueOf(fc.getColor(createAncestor(2, 0.6, 0.75, child))),
        );
    });

    it("takes the color of a descendant partner from its position between the two bases", () => {
        const fc = new FamilyColor(createConfiguration());

        fc.setPartnerMidpoints([
            { depth: -1, id: 10, x0: 0, x1: 0.1 },
            { depth: -1, id: 11, x0: 0.9, x1: 1 },
        ]);

        const partner = (id, x0, x1) => ({
            depth: -1,
            x0,
            x1,
            id,
            descendantType: "partner",
            syntheticParentId: null,
            data: { data: { xref: "I5", sex: SEX_FEMALE } },
        });

        // A partner at the start of the sector is close to the paternal base, one at the end close to
        // the maternal base.
        expect(hueDistance(hueOf(fc.getColor(partner(10, 0, 0.1))), PATERNAL_HUE)).toBeLessThan(
            hueDistance(hueOf(fc.getColor(partner(10, 0, 0.1))), MATERNAL_HUE),
        );
        expect(hueDistance(hueOf(fc.getColor(partner(11, 0.9, 1))), MATERNAL_HUE)).toBeLessThan(
            hueDistance(hueOf(fc.getColor(partner(11, 0.9, 1))), PATERNAL_HUE),
        );
    });
});

describe("FamilyColor.getDescendantColor (via getColor)", () => {
    it("produces different hues for partners at different angular positions", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);

        fc.setPartnerMidpoints([
            { depth: -1, id: 10, x0: 0, x1: 0.3 },
            { depth: -1, id: 11, x0: 0.5, x1: 1.0 },
        ]);

        const partner1 = {
            depth: -1,
            x0: 0,
            x1: 0.3,
            id: 10,
            descendantType: "partner",
            syntheticParentId: null,
            data: { data: { xref: "I2", sex: SEX_FEMALE } },
        };

        const partner2 = {
            depth: -1,
            x0: 0.5,
            x1: 1.0,
            id: 11,
            descendantType: "partner",
            syntheticParentId: null,
            data: { data: { xref: "I3", sex: SEX_FEMALE } },
        };

        const color1 = fc.getColor(partner1);
        const color2 = fc.getColor(partner2);

        expect(color1).toMatch(/^hsl\(/);
        expect(color2).toMatch(/^hsl\(/);
        // Different positions produce different hues
        expect(color1).not.toBe(color2);
    });

    it("children share the same hue as their synthetic parent partner", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);

        fc.setPartnerMidpoints([{ depth: -1, id: 10, x0: 0.2, x1: 0.6 }]);

        const partner = {
            depth: -1,
            x0: 0.2,
            x1: 0.6,
            id: 10,
            descendantType: "partner",
            syntheticParentId: null,
            data: { data: { xref: "I2", sex: SEX_FEMALE } },
        };

        const child = {
            depth: -2,
            x0: 0.2,
            x1: 0.4,
            id: 11,
            descendantType: "child",
            syntheticParentId: 10,
            data: { data: { xref: "I3", sex: SEX_MALE } },
        };

        const partnerColor = fc.getColor(partner);
        const childColor = fc.getColor(child);

        // Both should be valid HSL
        expect(partnerColor).toMatch(/^hsl\(/);
        expect(childColor).toMatch(/^hsl\(/);

        // Extract hue from both colors: "hsl(HUE, ...)" => HUE
        const partnerHue = parseFloat(partnerColor.match(/^hsl\(([\d.]+)/)[1]);
        const childHue = parseFloat(childColor.match(/^hsl\(([\d.]+)/)[1]);

        // Child uses same partner midpoint, so hue should match
        expect(childHue).toBeCloseTo(partnerHue, 5);
    });
});

describe("FamilyColor.getMarriageColor", () => {
    it("returns familyColor for depth 0", () => {
        const datum = {
            depth: 0,
            data: { data: { familyColor: "hsl(200, 50%, 60%)" } },
        };

        expect(FamilyColor.getMarriageColor(datum)).toBe("hsl(200, 50%, 60%)");
    });

    it("returns familyColor for depth < 0 (descendant)", () => {
        const datum = {
            depth: -1,
            data: { data: { familyColor: "hsl(120, 40%, 55%)" } },
        };

        expect(FamilyColor.getMarriageColor(datum)).toBe("hsl(120, 40%, 55%)");
    });

    it("returns null for depth < 0 when familyColor is empty", () => {
        const datum = {
            depth: -1,
            data: { data: { familyColor: "" } },
        };

        expect(FamilyColor.getMarriageColor(datum)).toBeNull();
    });

    it("returns first child familyColor for ancestor nodes at depth >= 1", () => {
        const datum = {
            depth: 2,
            children: [
                { data: { data: { familyColor: "" } } },
                { data: { data: { familyColor: "hsl(30, 60%, 70%)" } } },
            ],
            data: { data: {} },
        };

        expect(FamilyColor.getMarriageColor(datum)).toBe("hsl(30, 60%, 70%)");
    });

    it("returns null when ancestor node has no children with familyColor", () => {
        const datum = {
            depth: 2,
            children: [{ data: { data: { familyColor: "" } } }],
            data: { data: {} },
        };

        expect(FamilyColor.getMarriageColor(datum)).toBeNull();
    });

    it("returns null when ancestor node has no children at all", () => {
        const datum = {
            depth: 1,
            children: null,
            data: { data: {} },
        };

        expect(FamilyColor.getMarriageColor(datum)).toBeNull();
    });
});

describe("FamilyColor.setPartnerMidpoints", () => {
    it("creates a Map from partner nodes at depth -1", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);

        const nodes = [
            { depth: 0, id: 0, x0: 0, x1: 1 },
            { depth: 1, id: 1, x0: 0, x1: 0.5 },
            { depth: -1, id: 5, x0: 0.1, x1: 0.4 },
            { depth: -1, id: 6, x0: 0.5, x1: 0.9 },
            { depth: -2, id: 7, x0: 0.1, x1: 0.25 },
        ];

        fc.setPartnerMidpoints(nodes);

        // Access the internal map through a color lookup
        // Child node referencing partner ID 5 should use partner's midpoint
        const childDatum = {
            depth: -2,
            x0: 0.1,
            x1: 0.25,
            id: 7,
            descendantType: "child",
            syntheticParentId: 5,
            data: { data: { xref: "I10", sex: SEX_MALE } },
        };

        const color = fc.getColor(childDatum);

        expect(color).toMatch(/^hsl\(/);
    });

    it("ignores non-partner nodes (depth != -1)", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);

        const nodes = [
            { depth: 0, id: 0, x0: 0, x1: 1 },
            { depth: 1, id: 1, x0: 0, x1: 0.5 },
            { depth: -2, id: 7, x0: 0.1, x1: 0.25 },
        ];

        fc.setPartnerMidpoints(nodes);

        // A child referencing a non-existent partner ID falls back to 0.5
        const childDatum = {
            depth: -2,
            x0: 0.1,
            x1: 0.25,
            id: 7,
            descendantType: "child",
            syntheticParentId: 99,
            data: { data: { xref: "I10", sex: SEX_MALE } },
        };

        // Should still produce a valid color (using fallback midpoint 0.5)
        const color = fc.getColor(childDatum);

        expect(color).toMatch(/^hsl\(/);
    });
});
