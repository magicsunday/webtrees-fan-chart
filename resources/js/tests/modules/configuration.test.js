import Configuration from "resources/js/modules/configuration";
import { createConfigurationValues } from "../helpers/configuration-values.js";

describe("Configuration", () => {
    const labels = { zoom: "Zoom hint", move: "Move hint", 0: "Self", 1: "Parents" };

    // Both branches of the room that the marriage dates need between the generations. With the
    // dates the pad radius is a multiple of the padding, the pad distance is the pad angle times
    // the pad radius and both arcs are the padding plus a fixed height. Without the dates there
    // is no padding and each arc has its own fixed height.
    it.each([
        [
            "with the parent marriage dates shown",
            true,
            {
                circlePadding: 30,
                padRadius: 300,
                padDistance: 9,
                innerArcHeight: 155,
                outerArcHeight: 155,
            },
        ],
        [
            "without the parent marriage dates",
            false,
            {
                circlePadding: 0,
                padRadius: 0,
                padDistance: 0,
                innerArcHeight: 115,
                outerArcHeight: 175,
            },
        ],
    ])("sets padding and arc sizes %s", (_label, showParentMarriageDates, expected) => {
        const configuration = new Configuration(
            createConfigurationValues({ labels, showParentMarriageDates }),
        );

        expect(configuration.circlePadding).toBe(expected.circlePadding);
        expect(configuration.padRadius).toBe(expected.padRadius);
        expect(configuration.padDistance).toBeCloseTo(expected.padDistance, 5);
        expect(configuration.innerArcHeight).toBe(expected.innerArcHeight);
        expect(configuration.outerArcHeight).toBe(expected.outerArcHeight);
    });

    it("takes the fan degree as given because the server already clamped it", () => {
        const configuration = new Configuration(
            createConfigurationValues({
                labels,
                fanDegree: 340,
                showDescendants: true,
            }),
        );

        expect(configuration.fanDegree).toBe(340);
    });

    it("shows the detail panel exactly as the server passes the switch", () => {
        expect(
            new Configuration(createConfigurationValues({ showDetailPanel: false }))
                .showDetailPanel,
        ).toBe(false);
        expect(
            new Configuration(createConfigurationValues({ showDetailPanel: true })).showDetailPanel,
        ).toBe(true);
    });

    test("draws every generation with names on and only the inner ones with names off", () => {
        const withNames = new Configuration(
            createConfigurationValues({ showNames: true, innerArcs: 4 }),
        );
        const withoutNames = new Configuration(
            createConfigurationValues({ showNames: false, innerArcs: 4 }),
        );

        expect(withNames.isDrawn(9)).toBe(true);
        expect(withoutNames.isDrawn(4)).toBe(true);
        expect(withoutNames.isDrawn(5)).toBe(false);
        expect(withoutNames.isDrawn(-7)).toBe(true);
    });

    // The server owns every default and passes each option, so the values it hands over are the
    // ones the chart reads. Every value here differs from the base set of the helper, so a getter
    // that ignores its option or takes a value of its own is caught.
    describe("the values of the server", () => {
        const passed = createConfigurationValues({
            labels,
            generations: 8,
            fanDegree: 270,
            fontScale: 130,
            hideEmptySegments: true,
            showFamilyColors: true,
            showPlaces: true,
            showParentMarriageDates: true,
            showImages: true,
            showNames: false,
            showSilhouettes: true,
            showDescendants: true,
            showDetailPanel: true,
            rtl: true,
            innerArcs: 2,
            paternalColor: "#112233",
            maternalColor: "#445566",
            nameAbbreviation: "SURNAME",
        });

        it.each([
            ["generations", "generations"],
            ["fanDegree", "fanDegree"],
            ["fontScale", "fontScale"],
            ["hideEmptySegments", "hideEmptySegments"],
            ["showFamilyColors", "showFamilyColors"],
            ["showPlaces", "showPlaces"],
            ["showParentMarriageDates", "showParentMarriageDates"],
            ["showImages", "showImages"],
            ["showNames", "showNames"],
            ["showSilhouettes", "showSilhouettes"],
            ["showDescendants", "showDescendants"],
            ["showDetailPanel", "showDetailPanel"],
            ["innerArcs", "numberOfInnerCircles"],
            ["paternalColor", "paternalColor"],
            ["maternalColor", "maternalColor"],
            ["nameAbbreviation", "nameAbbreviation"],
            ["rtl", "rtl"],
            ["labels", "labels"],
        ])("passes %s through to %s", (option, property) => {
            expect(new Configuration(passed)[property]).toStrictEqual(passed[option]);
        });

        // Guards against JavaScript defaults returning for options that the server owns.
        it.each([
            "hideEmptySegments",
            "showFamilyColors",
            "showPlaces",
            "showParentMarriageDates",
            "showImages",
            "showNames",
            "showSilhouettes",
            "showDescendants",
            "showDetailPanel",
            "paternalColor",
            "maternalColor",
            "nameAbbreviation",
            "fontScale",
        ])(
            "leaves %s undefined when the server passes none, instead of a default of its own",
            (option) => {
                const values = createConfigurationValues();
                delete values[option];

                expect(new Configuration(values)[option]).toBeUndefined();
            },
        );

        // The number a validated option takes when its value is not a finite number.
        it.each([
            ["generations", "generations", 6],
            ["fanDegree", "fanDegree", 210],
            ["innerArcs", "numberOfInnerCircles", 3],
        ])(
            "falls back for %s when the value is not a finite number",
            (option, property, fallback) => {
                for (const value of ["not a number", undefined, Number.POSITIVE_INFINITY]) {
                    const values = createConfigurationValues({ [option]: value });

                    expect(new Configuration(values)[property]).toBe(fallback);
                }
            },
        );

        it("cannot be built without the values of the server", () => {
            expect(() => new Configuration()).toThrow();
        });
    });
});
