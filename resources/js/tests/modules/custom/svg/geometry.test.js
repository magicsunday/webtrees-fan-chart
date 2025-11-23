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
        const layout = geometry.createLayout(datum.depth, datum);
        const length = geometry.arcLength(layout, 50);

        const span = 120 * MATH_DEG2RAD;
        const inner = geometry.innerRadius(datum.depth);
        const outer = geometry.outerRadius(datum.depth);
        const relative = outer - ((100 - 50) * (outer - inner) / 100);

        expect(layout.startAngle).toBeCloseTo(-(60 * MATH_DEG2RAD));
        expect(layout.endAngle).toBeCloseTo(60 * MATH_DEG2RAD);
        expect(layout.innerRadius).toBe(inner);
        expect(layout.outerRadius).toBe(outer);
        expect(layout.centerRadius).toBe(geometry.centerRadius(datum.depth));
        expect(length).toBeCloseTo(span * relative);
    });
});
