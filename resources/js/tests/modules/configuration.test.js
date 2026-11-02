import Configuration from "resources/js/modules/configuration";

describe("Configuration", () => {
    const labels = { zoom: "Zoom hint", move: "Move hint", 0: "Self", 1: "Parents" };

    // Both branches of the room that the marriage dates need between the generations. The
    // padding is 30 with the dates, the pad radius is ten times it, the pad distance is the
    // pad angle (0.03) times the pad radius and the arcs are the padding plus 125 high.
    // Without the dates there is no padding and the arcs keep their own heights.
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
        const configuration = new Configuration({ labels, showParentMarriageDates });

        expect(configuration.circlePadding).toBe(expected.circlePadding);
        expect(configuration.padRadius).toBe(expected.padRadius);
        expect(configuration.padDistance).toBeCloseTo(expected.padDistance, 5);
        expect(configuration.innerArcHeight).toBe(expected.innerArcHeight);
        expect(configuration.outerArcHeight).toBe(expected.outerArcHeight);
    });

    it("takes the fan degree as given because the server already clamped it", () => {
        const configuration = new Configuration({
            labels,
            fanDegree: 340,
            showDescendants: true,
        });

        expect(configuration.fanDegree).toBe(340);
    });

    it("shows no detail panel unless the server switches it on", () => {
        expect(new Configuration({ labels }).showDetailPanel).toBe(false);
        expect(new Configuration({ labels, showDetailPanel: true }).showDetailPanel).toBe(true);
    });

    test("draws every generation with names on and only the inner ones with names off", () => {
        const withNames = new Configuration({ showNames: true, innerArcs: 4 });
        const withoutNames = new Configuration({ showNames: false, innerArcs: 4 });

        expect(withNames.isDrawn(9)).toBe(true);
        expect(withoutNames.isDrawn(4)).toBe(true);
        expect(withoutNames.isDrawn(5)).toBe(false);
        expect(withoutNames.isDrawn(-7)).toBe(true);
    });
});
