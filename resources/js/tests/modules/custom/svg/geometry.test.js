import { jest } from "@jest/globals";

const scaleLinearMock = jest.fn(() => {
    let domain = [0, 1];
    let range = [0, 1];

    const scale = (value) => {
        const [domainStart, domainEnd] = domain;
        const [rangeStart, rangeEnd] = range;
        const t = (value - domainStart) / (domainEnd - domainStart);

        return rangeStart + ((rangeEnd - rangeStart) * t);
    };

    scale.range = (values) => {
        range = values;
        return scale;
    };

    scale.domain = (values) => {
        domain = values;
        return scale;
    };

    return scale;
});

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    scaleLinear: scaleLinearMock
}));

const { default: Geometry, MATH_DEG2RAD } = await import("resources/js/modules/custom/svg/geometry");

describe("Geometry", () => {
    const createConfiguration = (overrides = {}) => ({
        fanDegree: 180,
        numberOfInnerCircles: 2,
        innerArcHeight: 20,
        outerArcHeight: 30,
        centerCircleRadius: 50,
        circlePadding: 10,
        padAngle: 0,
        padRadius: 0,
        padDistance: 0,
        colorArcWidth: 20,
        ...overrides
    });

    beforeEach(() => {
        scaleLinearMock.mockClear();
    });

    it("calculates start and end angles in radians", () => {
        const quarterConfiguration = createConfiguration({ fanDegree: 90 });
        const halfCircleConfiguration = createConfiguration({ fanDegree: 210 });

        const quarterGeometry = new Geometry(quarterConfiguration);
        const halfCircleGeometry = new Geometry(halfCircleConfiguration);

        expect(quarterGeometry.startPi).toBe(0);
        expect(quarterGeometry.endPi).toBeCloseTo(Math.PI / 2);
        expect(halfCircleGeometry.startPi).toBeCloseTo(-(105 * MATH_DEG2RAD));
        expect(halfCircleGeometry.endPi).toBeCloseTo(105 * MATH_DEG2RAD);
    });

    it("derives radii for inner, outer, center, and relative positions", () => {
        const geometry = new Geometry(createConfiguration());

        expect(geometry.innerRadius(0)).toBe(0);
        expect(geometry.outerRadius(0)).toBe(50);
        expect(geometry.innerRadius(1)).toBe(60);
        expect(geometry.outerRadius(1)).toBe(70);
        expect(geometry.centerRadius(1)).toBe(65);
        expect(geometry.innerRadius(3)).toBe(100);
        expect(geometry.outerRadius(3)).toBe(120);
        expect(geometry.relativeRadius(3, 50)).toBeCloseTo(110);
    });

    it("clamps calculated angles to the configured span", () => {
        const geometry = new Geometry(createConfiguration({ fanDegree: 120 }));

        const expectedStart = -(60 * MATH_DEG2RAD);
        const expectedEnd = 60 * MATH_DEG2RAD;

        expect(geometry.calcAngle(-0.5)).toBeCloseTo(expectedStart);
        expect(geometry.calcAngle(0.5)).toBeCloseTo(0);
        expect(geometry.calcAngle(1.5)).toBeCloseTo(expectedEnd);
    });

    it("computes arc length for datum and position", () => {
        const geometry = new Geometry(createConfiguration({ fanDegree: 120 }));
        const datum = { depth: 1, x0: 0, x1: 1 };
        const length = geometry.arcLength(datum, 50);

        const span = 120 * MATH_DEG2RAD;
        const inner = geometry.innerRadius(datum.depth);
        const outer = geometry.outerRadius(datum.depth);
        const relative = outer - ((100 - 50) * (outer - inner) / 100);

        expect(length).toBeCloseTo(span * relative);
    });

    it("returns true from isPositionFlipped for negative depths in the lower half", () => {
        // childScale maps [0,1] to a sector centered around 180° (PI)
        const descendantChildScale = (value) => (Math.PI * 0.6) + value * (Math.PI * 0.8);
        const geometry = new Geometry(createConfiguration({ childScale: descendantChildScale }));

        // Midpoint at ~180° → in lower half → flipped
        expect(geometry.isPositionFlipped(-1, 0.2, 0.8)).toBe(true);
        expect(geometry.isPositionFlipped(-2, 0.3, 0.7)).toBe(true);
    });

    it("returns false from isPositionFlipped for negative depths without childScale", () => {
        const geometry = new Geometry(createConfiguration());

        expect(geometry.isPositionFlipped(-1, 0, 0.5)).toBe(false);
    });

    it("returns false from isPositionFlipped for depth 0", () => {
        const geometry = new Geometry(createConfiguration());

        expect(geometry.isPositionFlipped(0, 0, 1)).toBe(false);
    });

    it("skips circlePadding for innerRadius at depth <= -2", () => {
        const padding = 10;
        const geometry = new Geometry(createConfiguration({ circlePadding: padding }));

        // depth -1 (partner ring) includes circlePadding
        const innerAtMinus1 = geometry.innerRadius(-1);
        // depth -2 (child ring) skips circlePadding
        const innerAtMinus2 = geometry.innerRadius(-2);

        // Both use absDepth for the calculation, but -2 omits padding
        // depth -1 => absDepth 1: (1-1)*innerArcHeight + centerCircleRadius + circlePadding = 0 + 50 + 10 = 60
        expect(innerAtMinus1).toBe(60);
        // depth -2 => absDepth 2: (2-1)*innerArcHeight + centerCircleRadius + 0 = 20 + 50 + 0 = 70
        expect(innerAtMinus2).toBe(70);
    });

    it("uses childScale for startAngle and endAngle at negative depths", () => {
        const childScale = (value) => value * Math.PI;
        const geometry = new Geometry(createConfiguration({ childScale }));

        expect(geometry.startAngle(-1, 0.5)).toBeCloseTo(0.5 * Math.PI);
        expect(geometry.endAngle(-1, 0.8)).toBeCloseTo(0.8 * Math.PI);
        expect(geometry.startAngle(-2, 0.25)).toBeCloseTo(0.25 * Math.PI);
        expect(geometry.endAngle(-2, 1.0)).toBeCloseTo(1.0 * Math.PI);
    });

    it("returns 0 for startAngle/endAngle at negative depths when childScale is null", () => {
        const geometry = new Geometry(createConfiguration({ childScale: null }));

        expect(geometry.startAngle(-1, 0.5)).toBe(0);
        expect(geometry.endAngle(-1, 0.8)).toBe(0);
    });

    it("uses Math.abs(depth) in getFontSize for descendant nodes", () => {
        const config = createConfiguration({
            fontSize: 22,
            fontScale: 100,
            numberOfInnerCircles: 2,
            childScale: (v) => v * Math.PI
        });
        const geometry = new Geometry(config);

        // depth -1 => absDepth 1: (22 - 1) * 100 / 100 = 21
        const fontAtMinus1 = geometry.getFontSize({ depth: -1, x0: 0, x1: 1 });
        // depth +1 => absDepth 1: (22 - 1) * 100 / 100 = 21
        const fontAtPlus1 = geometry.getFontSize({ depth: 1, x0: 0, x1: 1 });

        expect(fontAtMinus1).toBeCloseTo(fontAtPlus1);
    });

    it("mirrors innerRadius symmetrically for negative and positive depths", () => {
        const geometry = new Geometry(createConfiguration({ circlePadding: 0 }));

        // With 0 padding, negative depths behave identically to positive
        expect(geometry.innerRadius(-1)).toBe(geometry.innerRadius(1));
        expect(geometry.innerRadius(-2)).toBe(geometry.innerRadius(2));
    });

    it("mirrors outerRadius for negative and positive depths", () => {
        const geometry = new Geometry(createConfiguration());

        expect(geometry.outerRadius(-1)).toBe(geometry.outerRadius(1));
        expect(geometry.outerRadius(-2)).toBe(geometry.outerRadius(2));
        expect(geometry.outerRadius(-3)).toBe(geometry.outerRadius(3));
    });
});
