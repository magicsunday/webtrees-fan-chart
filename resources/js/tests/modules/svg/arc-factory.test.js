import { jest, describe, it, expect } from "@jest/globals";

const arcInstance = {
    startAngle: jest.fn().mockReturnThis(),
    endAngle: jest.fn().mockReturnThis(),
    innerRadius: jest.fn().mockReturnThis(),
    outerRadius: jest.fn().mockReturnThis(),
    padAngle: jest.fn().mockReturnThis(),
    padRadius: jest.fn().mockReturnThis(),
    cornerRadius: jest.fn().mockReturnThis(),
};

await jest.unstable_mockModule("resources/js/modules/d3", () => ({
    arc: jest.fn(() => arcInstance),
}));

const { createPersonArcGenerator, createColorStripArcGenerator, createMarriageArcGenerator } =
    await import("resources/js/modules/svg/arc-factory");

const mockGeometry = {
    startAngle: jest.fn((depth, x0) => x0 * Math.PI),
    endAngle: jest.fn((depth, x1) => x1 * Math.PI),
    innerRadius: jest.fn((depth) => 100 + depth * 50),
    outerRadius: jest.fn((depth) => 150 + depth * 50),
};

const mockConfig = {
    padRadius: 300,
    cornerRadius: 5,
};

beforeEach(() => {
    for (const method of Object.values(arcInstance)) {
        method.mockClear();
    }
});

describe("createPersonArcGenerator", () => {
    it("configures d3.arc with geometry-derived values", () => {
        const datum = { depth: 2, x0: 0.1, x1: 0.3 };

        const expectedStartAngle = mockGeometry.startAngle(2, 0.1);
        const expectedEndAngle = mockGeometry.endAngle(2, 0.3);
        const expectedInnerRadius = mockGeometry.innerRadius(2);
        const expectedOuterRadius = mockGeometry.outerRadius(2);

        // Clear again after computing expected values above
        for (const method of Object.values(arcInstance)) {
            method.mockClear();
        }

        createPersonArcGenerator(mockGeometry, mockConfig, datum, 0.03);

        expect(arcInstance.startAngle).toHaveBeenCalledWith(expectedStartAngle);
        expect(arcInstance.endAngle).toHaveBeenCalledWith(expectedEndAngle);
        expect(arcInstance.innerRadius).toHaveBeenCalledWith(expectedInnerRadius);
        expect(arcInstance.outerRadius).toHaveBeenCalledWith(expectedOuterRadius);
        expect(arcInstance.padAngle).toHaveBeenCalledWith(0.03);
        expect(arcInstance.padRadius).toHaveBeenCalledWith(300);
        expect(arcInstance.cornerRadius).toHaveBeenCalledWith(5);
    });
});

describe("createColorStripArcGenerator", () => {
    it("spans the colour arc width inwards from the outer edge of the arc", () => {
        const datum = { depth: 2, x0: 0.1, x1: 0.3 };
        const expectedStartAngle = mockGeometry.startAngle(2, 0.1);
        const expectedEndAngle = mockGeometry.endAngle(2, 0.3);
        const outerRadius = mockGeometry.outerRadius(2);

        for (const method of Object.values(arcInstance)) {
            method.mockClear();
        }

        createColorStripArcGenerator(
            mockGeometry,
            { ...mockConfig, colorArcWidth: 20 },
            datum,
            0.03,
        );

        expect(arcInstance.startAngle).toHaveBeenCalledWith(expectedStartAngle);
        expect(arcInstance.endAngle).toHaveBeenCalledWith(expectedEndAngle);
        expect(arcInstance.innerRadius).toHaveBeenCalledWith(outerRadius - 20);
        expect(arcInstance.outerRadius).toHaveBeenCalledWith(outerRadius + 1);
        expect(arcInstance.padAngle).toHaveBeenCalledWith(0.03);
        expect(arcInstance.padRadius).toHaveBeenCalledWith(300);
    });

    it("leaves the corners of the strip square", () => {
        createColorStripArcGenerator(
            mockGeometry,
            { ...mockConfig, colorArcWidth: 20 },
            { depth: 1, x0: 0, x1: 1 },
            0,
        );

        expect(arcInstance.cornerRadius).not.toHaveBeenCalled();
    });
});

describe("createMarriageArcGenerator", () => {
    it("configures d3.arc with explicit radii and angles", () => {
        createMarriageArcGenerator(mockConfig, {
            startAngle: 0.5,
            endAngle: 1.2,
            innerR: 200,
            outerR: 220,
        });

        expect(arcInstance.startAngle).toHaveBeenCalledWith(0.5);
        expect(arcInstance.endAngle).toHaveBeenCalledWith(1.2);
        expect(arcInstance.innerRadius).toHaveBeenCalledWith(200);
        expect(arcInstance.outerRadius).toHaveBeenCalledWith(220);
        expect(arcInstance.padAngle).toHaveBeenCalledWith(0);
        expect(arcInstance.padRadius).toHaveBeenCalledWith(0);
        expect(arcInstance.cornerRadius).toHaveBeenCalledWith(5);
    });
});
