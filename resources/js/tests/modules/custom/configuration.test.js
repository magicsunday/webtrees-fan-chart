import Configuration from "resources/js/modules/custom/configuration";

describe("Configuration", () => {
    const labels = ["child", "parent"];

    it("uses defaults when options are omitted", () => {
        const config = new Configuration(labels);

        expect(config.generations).toBe(6);
        expect(config.fanDegree).toBe(210);
        expect(config.fontScale).toBe(100);
        expect(config.circlePadding).toBe(0);
        expect(config.innerArcHeight).toBe(100);
        expect(config.outerArcHeight).toBe(160);
        expect(config.padRadius).toBe(0);
        expect(config.padDistance).toBe(0);
    });

    it("stores base values when marriage dates are hidden", () => {
        const configuration = new Configuration(
            labels,
            5,
            180,
            120,
            true,
            true,
            false,
            true,
            false,
            false,
            3
        );

        expect(configuration.generations).toBe(5);
        expect(configuration.fanDegree).toBe(180);
        expect(configuration.fontScale).toBe(120);
        expect(configuration.hideEmptySegments).toBe(true);
        expect(configuration.showColorGradients).toBe(true);
        expect(configuration.showParentMarriageDates).toBe(false);
        expect(configuration.showImages).toBe(true);
        expect(configuration.showSilhouettes).toBe(false);
        expect(configuration.numberOfInnerCircles).toBe(3);
        expect(configuration.rtl).toBe(false);
        expect(configuration.labels).toEqual(labels);
        expect(configuration.circlePadding).toBe(0);
        expect(configuration.padRadius).toBe(0);
        expect(configuration.padDistance).toBe(0);
        expect(configuration.innerArcHeight).toBe(100);
        expect(configuration.outerArcHeight).toBe(160);
    });

    it("adjusts padding and arc sizes when marriage dates are shown", () => {
        const marriageLabels = ["ancestor", "spouse"];
        const config = new Configuration(
            marriageLabels,
            6,
            210,
            100,
            false,
            false,
            true
        );

        expect(config.circlePadding).toBe(40);
        expect(config.innerArcHeight).toBe(150);
        expect(config.outerArcHeight).toBe(150);
        expect(config.padRadius).toBe(400);
        expect(config.padDistance).toBeCloseTo(12, 5);
        expect(config.generations).toBe(6);
        expect(config.fanDegree).toBe(210);
        expect(config.fontScale).toBe(100);
    });

    it("expands spacing when parent marriage dates are shown", () => {
        const configuration = new Configuration(
            labels,
            4,
            210,
            90,
            false,
            false,
            true,
            false,
            true,
            true,
            5
        );

        expect(configuration.circlePadding).toBe(40);
        expect(configuration.padRadius).toBe(400);
        expect(configuration.padDistance).toBeCloseTo(12);
        expect(configuration.innerArcHeight).toBe(150);
        expect(configuration.outerArcHeight).toBe(150);
        expect(configuration.showParentMarriageDates).toBe(true);
        expect(configuration.rtl).toBe(true);
    });

    it("propagates labels and RTL preference for downstream renderers", () => {
        const rtlLabels = ["Self", "Parents", "Grandparents"];
        const config = new Configuration(
            rtlLabels,
            6,
            210,
            100,
            false,
            false,
            false,
            false,
            false,
            true
        );

        expect(config.rtl).toBe(true);
        expect(config.labels).toBe(rtlLabels);
        expect(config.labels).toEqual(["Self", "Parents", "Grandparents"]);
    });
});
