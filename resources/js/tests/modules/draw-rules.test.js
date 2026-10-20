import { jest } from "@jest/globals";

const setPartnerMidpoints = jest.fn();
const familyColorConstructor = jest.fn();

await jest.unstable_mockModule("resources/js/modules/svg/family-color", () => ({
    __esModule: true,
    default: class FamilyColorStub {
        constructor(configuration) {
            familyColorConstructor(configuration);
        }

        setPartnerMidpoints(nodes) {
            setPartnerMidpoints(nodes);
        }
    },
}));

const { applyFamilyColorMode, isDrawnPerson, isMarriageParent } = await import(
    "resources/js/modules/draw-rules"
);

const createDatum = (xref, depth) => ({ depth, data: { data: { xref } } });

describe("draw rules", () => {
    beforeEach(() => {
        setPartnerMidpoints.mockClear();
        familyColorConstructor.mockClear();
    });

    describe("isDrawnPerson", () => {
        it.each([
            ["a known person", "I1", 2, true, true],
            ["an empty ancestor while empty segments are kept", "", 2, false, true],
            ["an empty ancestor while empty segments are hidden", "", 2, true, false],
            ["an empty descendant placeholder while empty segments are hidden", "", -1, true, true],
            ["an empty child while empty segments are hidden", "", -2, true, true],
        ])("decides for %s", (_label, xref, depth, hideEmptySegments, expected) => {
            expect(isDrawnPerson(createDatum(xref, depth), { hideEmptySegments })).toBe(expected);
        });
    });

    describe("isMarriageParent", () => {
        const configuration = { generations: 4 };

        it.each([
            ["a node with children inside the range", [{}], 2, true],
            ["a node with children on the last generation", [{}], 3, false],
            ["a node without children inside the range", undefined, 1, false],
        ])("decides for %s", (_label, children, depth, expected) => {
            expect(isMarriageParent({ children, depth }, configuration)).toBe(expected);
        });
    });

    describe("applyFamilyColorMode", () => {
        const createVisual = () => ({ classed: jest.fn() });

        it("applies the colors and marks the chart while family colors are shown", () => {
            const hierarchy = { nodes: [{ id: 1 }], applyFamilyColors: jest.fn() };
            const visual = createVisual();
            const configuration = { showFamilyColors: true };

            applyFamilyColorMode(hierarchy, visual, configuration);

            expect(familyColorConstructor).toHaveBeenCalledWith(configuration);
            expect(setPartnerMidpoints).toHaveBeenCalledWith(hierarchy.nodes);
            expect(hierarchy.applyFamilyColors).toHaveBeenCalledTimes(1);
            expect(visual.classed).toHaveBeenCalledWith("family-colors", true);
        });

        it("only computes the midpoints and clears the mark while family colors are hidden", () => {
            const hierarchy = { nodes: [{ id: 1 }], applyFamilyColors: jest.fn() };
            const visual = createVisual();

            applyFamilyColorMode(hierarchy, visual, { showFamilyColors: false });

            expect(setPartnerMidpoints).toHaveBeenCalledWith(hierarchy.nodes);
            expect(hierarchy.applyFamilyColors).not.toHaveBeenCalled();
            expect(visual.classed).toHaveBeenCalledWith("family-colors", false);
        });
    });
});
