import Configuration from "resources/js/modules/custom/configuration";

describe("Configuration", () => {
    const labels = ["child", "parent"];

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
});
