import { describe, expect, jest, test } from "@jest/globals";
import * as d3 from "resources/js/modules/d3";

// jsdom draws nothing, so it has no text measuring. A text that always fits keeps the shortening
// of the date lines out of the way, the ids of the paths do not depend on it.
globalThis.SVGElement.prototype.getComputedTextLength = () => 0;

const { default: Text } = await import("resources/js/modules/svg/text");
const { TEXT_SLOT } = await import("resources/js/modules/svg/arc-label-layout");

/**
 * Builds the nesting that the chart draws for one person, the person group with its id, the
 * content group without an id and the label group, on a real document. The label group is what
 * the inner labels get as their parent.
 *
 * @param {string} personId The id of the person group
 *
 * @returns {{ label: object, defsNode: Element }}
 */
function createPersonNesting(personId) {
    document.body.innerHTML = `
        <svg>
            <defs></defs>
            <g class="person" id="${personId}">
                <g class="content"><g class="name"></g></g>
            </g>
        </svg>`;

    return {
        label: d3.select(document.querySelector("g.name")),
        defsNode: document.querySelector("defs"),
    };
}

/**
 * Creates the label text for a real defs element, with the geometry and the name output reduced
 * to what the path ids do not depend on.
 *
 * @param {Element} defsNode The defs element of the chart
 *
 * @returns {Text}
 */
function createText(defsNode) {
    const defs = d3.select(defsNode);
    const svg = {
        defs: {
            select: (selector) => defs.select(selector),
            get: () => defs,
            append: (name) => defs.append(name),
        },
    };
    const geometry = {
        isPositionFlipped: () => false,
        startAngle: () => 0,
        endAngle: () => 1,
        relativeRadius: () => 50,
    };
    const text = new Text(svg, { padAngle: 0, padRadius: 0, cornerRadius: 0 }, geometry);

    text._layout.getAvailableWidth = jest.fn(() => 100);
    text.truncateNamesData = jest.fn((_parent, group) => group);
    text.addNameElements = jest.fn();

    return text;
}

const positions = new Map([
    [TEXT_SLOT.FIRST_NAMES, { normal: 1, flipped: 0 }],
    [TEXT_SLOT.LAST_NAMES, { normal: 3, flipped: 0 }],
    [TEXT_SLOT.ALTERNATIVE_NAME, { normal: 5, flipped: 0 }],
    [TEXT_SLOT.DATE_LINE_1, { normal: 7, flipped: 0 }],
    [TEXT_SLOT.DATE_LINE_2, { normal: 9, flipped: 0 }],
]);

const datum = {
    depth: 1,
    x0: 0,
    x1: 1,
    data: {
        data: {
            name: "Jane Doe",
            firstNames: ["Jane"],
            lastNames: ["Doe"],
            preferredName: "Jane",
            alternativeName: "Jana",
            isAltRtl: false,
            isNameRtl: false,
            timespan: "1850\n1900",
        },
    },
};

describe("Path ids of the inner labels", () => {
    test("name the paths after the person group and not after the unnamed content group", () => {
        const { label, defsNode } = createPersonNesting("person-7");

        createText(defsNode).createInnerLabels(label, datum, positions);

        const ids = Array.from(defsNode.querySelectorAll("path")).map((path) => path.id);

        expect(ids.length).toBeGreaterThan(0);
        expect(ids.filter((id) => !id.startsWith("path-person-7-"))).toEqual([]);
    });
});
