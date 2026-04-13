import { jest } from "@jest/globals";

const SEX_MALE = "M";
const SEX_FEMALE = "F";

await jest.unstable_mockModule("resources/js/modules/custom/hierarchy", () => ({
    __esModule: true,
    SEX_MALE,
    SEX_FEMALE,
    default: jest.fn()
}));

const { default: FamilyColor } = await import("resources/js/modules/custom/svg/family-color");

const createConfiguration = (overrides = {}) => ({
    paternalColor: "#3b82b0",
    maternalColor: "#d06f94",
    ...overrides
});

describe("FamilyColor.hexToHsl", () => {
    it("converts a valid hex color to HSL array", () => {
        const hsl = FamilyColor.hexToHsl("#3b82b0");

        expect(hsl).toHaveLength(3);
        expect(hsl[0]).toBeGreaterThanOrEqual(0);
        expect(hsl[0]).toBeLessThanOrEqual(360);
        expect(hsl[1]).toBeGreaterThanOrEqual(0);
        expect(hsl[1]).toBeLessThanOrEqual(100);
        expect(hsl[2]).toBeGreaterThanOrEqual(0);
        expect(hsl[2]).toBeLessThanOrEqual(100);
    });

    it("returns gray fallback for invalid hex", () => {
        expect(FamilyColor.hexToHsl("not-a-color")).toEqual([0, 0, 50]);
        expect(FamilyColor.hexToHsl("")).toEqual([0, 0, 50]);
    });

    it("handles hex with or without leading hash", () => {
        const withHash = FamilyColor.hexToHsl("#3b82b0");
        const withoutHash = FamilyColor.hexToHsl("3b82b0");

        expect(withHash).toEqual(withoutHash);
    });
});

describe("FamilyColor.getColor", () => {
    it("returns null for empty xref nodes", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 1,
            x0: 0,
            x1: 0.5,
            parent: null,
            data: { data: { xref: "", sex: SEX_MALE } }
        };

        expect(fc.getColor(datum)).toBeNull();
    });

    it("returns HSL string for center node with male sex", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 0,
            x0: 0,
            x1: 1,
            data: { data: { xref: "I1", sex: SEX_MALE } }
        };

        const color = fc.getColor(datum);

        expect(color).toMatch(/^hsl\(\d+/);
        expect(color).toContain("%");
    });

    it("returns HSL string for center node with female sex", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 0,
            x0: 0,
            x1: 1,
            data: { data: { xref: "I1", sex: SEX_FEMALE } }
        };

        const color = fc.getColor(datum);

        expect(color).toMatch(/^hsl\(\d+/);
    });

    it("returns gray HSL for center node with unknown sex", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 0,
            x0: 0,
            x1: 1,
            data: { data: { xref: "I1", sex: "U" } }
        };

        expect(fc.getColor(datum)).toBe("hsl(0, 0%, 92%)");
    });

    it("returns HSL string for ancestor nodes at depth >= 1", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);
        const datum = {
            depth: 1,
            x0: 0,
            x1: 0.25,
            parent: null,
            data: { data: { xref: "I2", sex: SEX_MALE } }
        };

        const color = fc.getColor(datum);

        expect(color).toMatch(/^hsl\(/);
        expect(color).not.toBeNull();
    });

    it("returns non-null HSL string for depth < 0 nodes (descendants)", () => {
        const config = createConfiguration();
        const fc = new FamilyColor(config);

        // Pre-set partner midpoints so descendant lookups work
        fc.setPartnerMidpoints([
            { depth: -1, id: 10, x0: 0, x1: 0.5 }
        ]);

        const datum = {
            depth: -1,
            x0: 0,
            x1: 0.5,
            id: 10,
            descendantType: "partner",
            syntheticParentId: null,
            data: { data: { xref: "I5", sex: SEX_FEMALE } }
        };

        const color = fc.getColor(datum);

        expect(color).not.toBeNull();
        expect(color).toMatch(/^hsl\(/);
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
            data: { data: { xref: "I2", sex: SEX_FEMALE } }
        };

        const partner2 = {
            depth: -1,
            x0: 0.5,
            x1: 1.0,
            id: 11,
            descendantType: "partner",
            syntheticParentId: null,
            data: { data: { xref: "I3", sex: SEX_FEMALE } }
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

        fc.setPartnerMidpoints([
            { depth: -1, id: 10, x0: 0.2, x1: 0.6 }
        ]);

        const partner = {
            depth: -1,
            x0: 0.2,
            x1: 0.6,
            id: 10,
            descendantType: "partner",
            syntheticParentId: null,
            data: { data: { xref: "I2", sex: SEX_FEMALE } }
        };

        const child = {
            depth: -2,
            x0: 0.2,
            x1: 0.4,
            id: 11,
            descendantType: "child",
            syntheticParentId: 10,
            data: { data: { xref: "I3", sex: SEX_MALE } }
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
            data: { data: { familyColor: "hsl(200, 50%, 60%)" } }
        };

        expect(FamilyColor.getMarriageColor(datum)).toBe("hsl(200, 50%, 60%)");
    });

    it("returns familyColor for depth < 0 (descendant)", () => {
        const datum = {
            depth: -1,
            data: { data: { familyColor: "hsl(120, 40%, 55%)" } }
        };

        expect(FamilyColor.getMarriageColor(datum)).toBe("hsl(120, 40%, 55%)");
    });

    it("returns null for depth < 0 when familyColor is empty", () => {
        const datum = {
            depth: -1,
            data: { data: { familyColor: "" } }
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
            data: { data: {} }
        };

        expect(FamilyColor.getMarriageColor(datum)).toBe("hsl(30, 60%, 70%)");
    });

    it("returns null when ancestor node has no children with familyColor", () => {
        const datum = {
            depth: 2,
            children: [
                { data: { data: { familyColor: "" } } },
            ],
            data: { data: {} }
        };

        expect(FamilyColor.getMarriageColor(datum)).toBeNull();
    });

    it("returns null when ancestor node has no children at all", () => {
        const datum = {
            depth: 1,
            children: null,
            data: { data: {} }
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
            data: { data: { xref: "I10", sex: SEX_MALE } }
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
            data: { data: { xref: "I10", sex: SEX_MALE } }
        };

        // Should still produce a valid color (using fallback midpoint 0.5)
        const color = fc.getColor(childDatum);

        expect(color).toMatch(/^hsl\(/);
    });
});
