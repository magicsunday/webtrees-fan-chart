import { describe, expect, jest, test } from "@jest/globals";
import * as d3 from "resources/js/modules/d3";

// jsdom draws nothing, so it has no text measuring. The shortening of the names is the business of the
// chart library and is covered there, so here the names come through as they are and each label shows
// exactly the parts that the datum splits into.
globalThis.SVGElement.prototype.getComputedTextLength = () => 0;

await jest.unstable_mockModule("@magicsunday/webtrees-chart-lib/infra", () => ({
    measureText: jest.fn(() => 0),
    truncateNames: jest.fn((names) => names),
    truncateToFit: jest.fn(),
}));

const { default: Text } = await import("resources/js/modules/svg/text");

const configuration = {
    numberOfInnerCircles: 2,
    innerArcHeight: 60,
    outerArcHeight: 150,
    centerCircleRadius: 40,
    circlePadding: 5,
    textPadding: 10,
    padDistance: 6,
    padAngle: 0,
    padRadius: 0,
    cornerRadius: 0,
    colorArcWidth: 20,
    fanDegree: 180,
    fontScale: 100,
    nameAbbreviation: "GIVEN",
};

const geometry = {
    getFontSize: () => 14,
    centerRadius: () => 100,
    angularWidthDeg: () => 40,
    scale: () => 0,
    childScale: null,
    arcLength: () => 200,
    isPositionFlipped: () => false,
    startAngle: () => 0,
    endAngle: () => 1,
    relativeRadius: () => 50,
    outerRadius: () => 120,
    innerRadius: () => 60,
};

/**
 * Builds the datum of one person with the name parts that the payload of the chart carries.
 *
 * @param {number} depth     The depth of the arc, 0 for the center
 * @param {object} overrides The fields of the payload that differ from the default person
 *
 * @returns {object}
 */
function createDatum(depth, overrides = {}) {
    return {
        depth,
        x0: 0,
        x1: 1,
        data: {
            data: {
                name: "Jane Marie Doe",
                firstNames: ["Jane", "Marie"],
                lastNames: ["Doe"],
                preferredName: "Marie",
                nickname: "",
                alternativeName: "",
                isNameRtl: false,
                isAltRtl: false,
                timespan: "",
                ...overrides,
            },
        },
    };
}

/**
 * Creates the labels of a person on a real document and returns the label group.
 *
 * @param {object} datum The datum of the person
 *
 * @returns {Element} The label group that holds the text elements
 */
function renderLabels(datum) {
    document.body.innerHTML = `
        <svg>
            <defs></defs>
            <g class="person" id="person-1">
                <g class="content"><g class="name"></g></g>
            </g>
        </svg>`;

    const defs = d3.select(document.querySelector("defs"));
    const svg = {
        defs: {
            select: (selector) => defs.select(selector),
            get: () => defs,
            append: (name) => defs.append(name),
        },
    };
    const label = document.querySelector("g.name");

    new Text(svg, configuration, geometry).createLabels(d3.select(label), datum);

    return label;
}

/**
 * Reads what one tspan shows: the text, the decoration, the last name class and the spacing.
 *
 * @param {Element} tspan
 *
 * @returns {{ text: string, decoration: string|null, lastName: boolean, dx: string|null }}
 */
function describeTspan(tspan) {
    return {
        text: tspan.textContent,
        decoration: tspan.getAttribute("text-decoration"),
        lastName: tspan.classList.contains("lastName"),
        dx: tspan.getAttribute("dx"),
    };
}

/**
 * Returns the tspans of every line of a label, one list per text element, in the order of the lines.
 *
 * @param {Element} label
 *
 * @returns {object[][]}
 */
function linesOf(label) {
    return Array.from(label.querySelectorAll("text")).map((line) =>
        Array.from(line.querySelectorAll("tspan")).map(describeTspan),
    );
}

describe("Name rendering of the arc labels", () => {
    test("an outer label underlines only the preferred name and marks only the last name", () => {
        const lines = linesOf(renderLabels(createDatum(3)));

        expect(lines).toEqual([
            [
                { text: "Jane", decoration: null, lastName: false, dx: null },
                { text: "Marie", decoration: "underline", lastName: false, dx: "0.25em" },
            ],
            [{ text: "Doe", decoration: null, lastName: true, dx: null }],
        ]);
    });

    test("an inner label carries the same marks on the tspans of its text paths", () => {
        const label = renderLabels(createDatum(1));
        const lines = Array.from(label.querySelectorAll("text > textPath")).map((path) =>
            Array.from(path.querySelectorAll("tspan")).map(describeTspan),
        );

        expect(lines).toEqual([
            [
                { text: "Jane", decoration: null, lastName: false, dx: null },
                { text: "Marie", decoration: "underline", lastName: false, dx: "0.25em" },
            ],
            [{ text: "Doe", decoration: null, lastName: true, dx: null }],
        ]);
    });

    test("a right to left name moves each following part to the left", () => {
        const lines = linesOf(renderLabels(createDatum(3, { isNameRtl: true })));

        expect(lines[0].map((part) => part.dx)).toEqual([null, "-0.25em"]);
    });

    test("the distant outer arcs keep no underline", () => {
        const lines = linesOf(renderLabels(createDatum(8)));

        expect(lines.flat().map((part) => part.decoration)).toEqual([null, null, null]);
        expect(lines.flat().map((part) => part.text)).toEqual(["Jane", "Marie", "Doe"]);
    });

    test("the narrow arcs that share one line keep the underline of the preferred name", () => {
        const lines = linesOf(renderLabels(createDatum(7)));

        // The narrow arcs show all name parts on one line
        expect(lines).toHaveLength(1);
        expect(lines[0].map((part) => part.decoration)).toEqual([null, "underline", null]);
    });

    test("the center shows the nickname on a line of its own below the given names", () => {
        const datum = createDatum(0, { name: 'Jane Marie "Janie" Doe', nickname: "Janie" });
        const label = renderLabels(datum);
        const nickname = label.querySelector("text.nickname");

        expect(linesOf(label).map((line) => line.map((part) => part.text))).toEqual([
            ["Jane", "Marie"],
            ['"Janie"'],
            ["Doe"],
        ]);
        expect(nickname).not.toBeNull();
        expect(nickname.querySelectorAll("tspan")).toHaveLength(1);
    });

    test("an arc away from the center keeps the nickname inline with the given names", () => {
        const datum = createDatum(3, { name: 'Jane Marie "Janie" Doe', nickname: "Janie" });
        const label = renderLabels(datum);

        expect(label.querySelector("text.nickname")).toBeNull();
        expect(linesOf(label).map((line) => line.map((part) => part.text))).toEqual([
            ["Jane", "Marie", '"Janie"'],
            ["Doe"],
        ]);
    });

    test("the alternative name is a line of its own that follows the direction of its script", () => {
        const datum = createDatum(3, { alternativeName: "Jana Dowe", isAltRtl: true });
        const label = renderLabels(datum);
        const alternative = label.querySelector("text.wt-chart-box-name-alt");

        expect(alternative).not.toBeNull();
        expect(alternative.classList.contains("rtl")).toBe(true);
        expect(Array.from(alternative.querySelectorAll("tspan")).map(describeTspan)).toEqual([
            { text: "Jana", decoration: null, lastName: false, dx: null },
            { text: "Dowe", decoration: null, lastName: false, dx: "-0.25em" },
        ]);
    });

    test("the alternative name of an inner label follows the direction of its script too", () => {
        const rightToLeft = renderLabels(
            createDatum(1, { alternativeName: "Jana Dowe", isAltRtl: true }),
        ).querySelector("textPath.wt-chart-box-name-alt");
        const leftToRight = renderLabels(
            createDatum(1, { alternativeName: "Jana Dowe", isAltRtl: false }),
        ).querySelector("textPath.wt-chart-box-name-alt");

        expect(rightToLeft.classList.contains("rtl")).toBe(true);
        expect(leftToRight.classList.contains("rtl")).toBe(false);
    });

    test("the alternative name of a left to right script is not marked as right to left", () => {
        const label = renderLabels(createDatum(3, { alternativeName: "Jana Dowe" }));

        expect(label.querySelector("text.wt-chart-box-name-alt").classList.contains("rtl")).toBe(
            false,
        );
    });
});
