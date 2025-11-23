import Configuration from "resources/js/modules/custom/configuration";

describe("Configuration", () => {
    it("uses defaults when options are omitted", () => {
        const labels = ["child", "parent"];
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

    it("adjusts padding and arc sizes when marriage dates are shown", () => {
        const labels = ["ancestor", "spouse"];
        const config = new Configuration(
            labels,
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

    it("propagates labels and RTL preference for downstream renderers", () => {
        const labels = ["Self", "Parents", "Grandparents"];
        const config = new Configuration(
            labels,
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
        expect(config.labels).toBe(labels);
        expect(config.labels).toEqual(["Self", "Parents", "Grandparents"]);
    });
});
