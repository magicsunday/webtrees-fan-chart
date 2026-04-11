import Configuration from "resources/js/modules/custom/configuration";

describe("Configuration", () => {
    const labels = { zoom: "Zoom hint", move: "Move hint", 0: "Self", 1: "Parents" };

    it("uses defaults when options are omitted", () => {
        const config = new Configuration({ labels });

        expect(config.generations).toBe(6);
        expect(config.fanDegree).toBe(210);
        expect(config.fontScale).toBe(100);
        expect(config.circlePadding).toBe(0);
        expect(config.innerArcHeight).toBe(115);
        expect(config.outerArcHeight).toBe(175);
        expect(config.padRadius).toBe(0);
        expect(config.padDistance).toBe(0);
    });

    it("stores base values when marriage dates are hidden", () => {
        const configuration = new Configuration({
            labels,
            generations: 5,
            fanDegree: 180,
            fontScale: 120,
            hideEmptySegments: true,
            showFamilyColors: true,
            showImages: true,
            showNames: true,
            innerArcs: 3,
        });

        expect(configuration.generations).toBe(5);
        expect(configuration.fanDegree).toBe(180);
        expect(configuration.fontScale).toBe(120);
        expect(configuration.hideEmptySegments).toBe(true);
        expect(configuration.showFamilyColors).toBe(true);
        expect(configuration.showParentMarriageDates).toBe(false);
        expect(configuration.showImages).toBe(true);
        expect(configuration.showNames).toBe(true);
        expect(configuration.showSilhouettes).toBe(false);
        expect(configuration.numberOfInnerCircles).toBe(3);
        expect(configuration.rtl).toBe(false);
        expect(configuration.labels).toEqual(labels);
        expect(configuration.circlePadding).toBe(0);
        expect(configuration.padRadius).toBe(0);
        expect(configuration.padDistance).toBe(0);
        expect(configuration.innerArcHeight).toBe(115);
        expect(configuration.outerArcHeight).toBe(175);
    });

    it("adjusts padding and arc sizes when marriage dates are shown", () => {
        const config = new Configuration({
            labels: ["ancestor", "spouse"],
            showParentMarriageDates: true,
        });

        expect(config.circlePadding).toBe(40);
        expect(config.innerArcHeight).toBe(165);
        expect(config.outerArcHeight).toBe(165);
        expect(config.padRadius).toBe(400);
        expect(config.padDistance).toBeCloseTo(12, 5);
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

        expect(configuration.circlePadding).toBe(40);
        expect(configuration.padRadius).toBe(400);
        expect(configuration.padDistance).toBeCloseTo(12);
        expect(configuration.innerArcHeight).toBe(165);
        expect(configuration.outerArcHeight).toBe(165);
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
