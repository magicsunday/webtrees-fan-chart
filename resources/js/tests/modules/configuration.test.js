import Configuration from "resources/js/modules/configuration";

describe("Configuration", () => {
    const labels = { zoom: "Zoom hint", move: "Move hint", 0: "Self", 1: "Parents" };

    it("adjusts padding and arc sizes when marriage dates are shown", () => {
        const config = new Configuration({
            labels: { zoom: "Zoom", move: "Move", 0: "ancestor", 1: "spouse" },
            showParentMarriageDates: true,
        });

        expect(config.circlePadding).toBe(30);
        expect(config.innerArcHeight).toBe(155);
        expect(config.outerArcHeight).toBe(155);
        expect(config.padRadius).toBe(300);
        expect(config.padDistance).toBeCloseTo(9, 5);
        expect(config.generations).toBe(6);
        expect(config.fanDegree).toBe(210);
        expect(config.fontScale).toBe(100);
    });

    it("expands spacing when parent marriage dates are shown", () => {
        const configuration = new Configuration({
            labels,
            generations: 4,
            fontScale: 90,
            showParentMarriageDates: true,
            showNames: true,
            showSilhouettes: true,
            rtl: true,
            innerArcs: 5,
        });

        expect(configuration.circlePadding).toBe(30);
        expect(configuration.padRadius).toBe(300);
        expect(configuration.padDistance).toBeCloseTo(9);
        expect(configuration.innerArcHeight).toBe(155);
        expect(configuration.outerArcHeight).toBe(155);
        expect(configuration.showParentMarriageDates).toBe(true);
        expect(configuration.rtl).toBe(true);
    });

    it("propagates labels and RTL preference for downstream renderers", () => {
        const rtlLabels = ["Self", "Parents", "Grandparents"];
        const config = new Configuration({
            labels: rtlLabels,
            rtl: true,
        });

        expect(config.rtl).toBe(true);
        expect(config.labels).toBe(rtlLabels);
        expect(config.labels).toEqual(["Self", "Parents", "Grandparents"]);
    });
});
