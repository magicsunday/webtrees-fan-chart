import {
    createColorStripArcGenerator,
    createMarriageArcGenerator,
    createPersonArcGenerator,
} from "resources/js/modules/svg/arc-factory";

// The generators are real d3 arcs. A d3 getter returns the value that was set, or the
// accessor function of it, so both are read the same way.
const read = (getter) => (typeof getter === "function" ? getter() : getter);

// Every measure has its own distinct value, so a swapped pair of measures cannot go unnoticed
const geometry = {
    startAngle: (depth, x0) => x0 * 10 + depth,
    endAngle: (depth, x1) => x1 * 10 + depth,
    innerRadius: (depth) => 100 + depth * 50,
    outerRadius: (depth) => 150 + depth * 50,
};

const configuration = { padRadius: 300, cornerRadius: 5, colorArcWidth: 20 };

describe("createPersonArcGenerator", () => {
    it("spans the arc between the inner and the outer radius of its generation", () => {
        const generator = createPersonArcGenerator(
            geometry,
            configuration,
            { depth: 2, x0: 0.1, x1: 0.3 },
            0.03,
        );

        expect(read(generator.innerRadius())).toBe(200);
        expect(read(generator.outerRadius())).toBe(250);
        expect(read(generator.startAngle())).toBeCloseTo(3);
        expect(read(generator.endAngle())).toBeCloseTo(5);
        expect(read(generator.padAngle())).toBe(0.03);
        expect(read(generator.padRadius())).toBe(300);
        expect(read(generator.cornerRadius())).toBe(5);
    });
});

describe("createColorStripArcGenerator", () => {
    it("spans the colour arc width inwards from the outer edge of the arc", () => {
        const generator = createColorStripArcGenerator(
            geometry,
            configuration,
            { depth: 2, x0: 0.1, x1: 0.3 },
            0.03,
        );

        // The radii and angles follow the generation and the sector of the node
        expect(read(generator.innerRadius())).toBe(230);
        expect(read(generator.outerRadius())).toBe(251);
        expect(read(generator.startAngle())).toBeCloseTo(3);
        expect(read(generator.endAngle())).toBeCloseTo(5);
        expect(read(generator.padAngle())).toBe(0.03);
        expect(read(generator.padRadius())).toBe(300);
    });

    it("leaves the corners of the strip square", () => {
        const generator = createColorStripArcGenerator(
            geometry,
            configuration,
            { depth: 1, x0: 0, x1: 1 },
            0,
        );

        expect(read(generator.cornerRadius())).toBe(0);
    });
});

describe("createMarriageArcGenerator", () => {
    it("takes the radii and angles that were resolved for the marriage arc", () => {
        const generator = createMarriageArcGenerator(configuration, {
            startAngle: 0.5,
            endAngle: 1.2,
            innerR: 200,
            outerR: 220,
        });

        expect(read(generator.innerRadius())).toBe(200);
        expect(read(generator.outerRadius())).toBe(220);
        expect(read(generator.startAngle())).toBe(0.5);
        expect(read(generator.endAngle())).toBe(1.2);
        expect(read(generator.padAngle())).toBe(0);
        expect(read(generator.padRadius())).toBe(0);
        expect(read(generator.cornerRadius())).toBe(5);
    });
});
