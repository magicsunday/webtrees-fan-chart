import { describe, expect, jest, test } from "@jest/globals";
import * as d3 from "resources/js/modules/d3";

// The arcs of a person are drawn by the person class and covered by its own tests. Here the update
// only has to classify the elements, so the person class stays out of the way.
await jest.unstable_mockModule("resources/js/modules/svg/person", () => ({
    __esModule: true,
    default: jest.fn(),
}));

const { default: Update } = await import("resources/js/modules/chart-updater");
const { default: DescendantLayout } = await import("resources/js/modules/descendant-layout");

/**
 * Builds a real document with a person group, binds the given data to the person elements and
 * hands back the parts an update works on.
 *
 * @param {{ id: string, available?: boolean, datum?: object }[]} persons The person elements, in
 *                                                                        document order
 *
 * @returns {object}
 */
function createChart(persons) {
    document.body.innerHTML = `<svg><defs></defs><g class="personGroup">${persons
        .map(
            ({ id, available }) =>
                `<g class="person${available ? " available" : ""}" id="person-${id}">` +
                '<g class="content"></g></g>',
        )
        .join("")}</g></svg>`;

    const root = d3.select(document.querySelector("svg"));

    persons.forEach(({ id, datum }) => {
        d3.select(document.querySelector(`#person-${id}`)).datum(datum ?? { id });
    });

    return {
        div: { property: jest.fn() },
        defs: { get: () => root.select("defs") },
        select: (selector) => root.select(selector),
        selectAll: (selector) => root.selectAll(selector),
    };
}

/**
 * Builds a node of the new hierarchy.
 *
 * @param {string} id    The id that joins the node to its element
 * @param {string} xref  The xref of the person, empty for an empty arc
 * @param {number} depth The depth of the arc, negative for a descendant
 *
 * @returns {object}
 */
function node(id, xref, depth = 1) {
    return { id, depth, data: { data: { xref } } };
}

/**
 * Reads which lifecycle classes an element carries.
 *
 * @param {string} id The id of the person
 *
 * @returns {string[]} The lifecycle classes in the order new, update, remove
 */
function lifecycleOf(id) {
    const element = document.querySelector(`#person-${id}`);

    return ["new", "update", "remove"].filter((name) => element.classList.contains(name));
}

describe("Update classification of the person elements", () => {
    const configuration = { hideEmptySegments: false, showFamilyColors: false, generations: 6 };

    const classify = (persons, nodes, overrides = {}) => {
        const svg = createChart(persons);
        const hierarchy = { nodes, descendantLayout: new DescendantLayout() };

        new Update(svg, { ...configuration, ...overrides }, hierarchy)._classifyPersonElements();
    };

    test("keeps a drawn ancestor as an update, redraws a new one and removes an empty arc", () => {
        classify(
            [
                { id: "1", available: true },
                { id: "2", available: false },
                { id: "3", available: true },
            ],
            [node("1", "I1"), node("2", "I2"), node("3", "")],
        );

        expect(lifecycleOf("1")).toEqual(["update"]);
        expect(lifecycleOf("2")).toEqual(["new"]);
        expect(lifecycleOf("3")).toEqual(["remove"]);
    });

    test("removes an element that the new hierarchy no longer has", () => {
        classify(
            [
                { id: "1", available: true },
                { id: "9", available: true },
            ],
            [node("1", "I1")],
        );

        expect(lifecycleOf("1")).toEqual(["update"]);
        expect(lifecycleOf("9")).toEqual(["remove"]);
    });

    test("marks the content of a kept and of a removed element as old so that it fades out", () => {
        classify(
            [
                { id: "1", available: true },
                { id: "9", available: true },
            ],
            [node("1", "I1")],
        );

        for (const id of ["1", "9"]) {
            expect(
                document.querySelector(`#person-${id} g.content`).classList.contains("old"),
            ).toBe(true);
        }
    });

    test("always redraws a descendant, also when its element was drawn before", () => {
        classify([{ id: "5", available: true }], [node("5", "I5", -2)]);

        expect(lifecycleOf("5")).toEqual(["new"]);
    });

    test("removes an empty descendant but keeps the empty partner arc", () => {
        classify(
            [
                { id: "6", available: true },
                { id: "7", available: true },
            ],
            [node("6", "", -2), node("7", "", -1)],
        );

        expect(lifecycleOf("6")).toEqual(["remove"]);
        expect(lifecycleOf("7")).toEqual(["new"]);
    });

    test("draws an element for a person that has none yet", () => {
        classify([{ id: "1", available: true }], [node("1", "I1"), node("8", "I8")]);

        const created = document.querySelector("#person-8");

        expect(created).not.toBeNull();
        expect(lifecycleOf("8")).toEqual(["new"]);
    });

    test("draws no element for an empty arc while empty segments are hidden", () => {
        classify([{ id: "1", available: true }], [node("1", "I1"), node("8", "")], {
            hideEmptySegments: true,
        });

        expect(document.querySelector("#person-8")).toBeNull();
    });
});

describe("Update cleanup after the transition", () => {
    const finish = (hideEmptySegments) => {
        const svg = createChart([]);

        document.querySelector("g.personGroup").innerHTML =
            '<g class="person remove available" id="person-1"><g class="content"><g class="arc"></g></g></g>' +
            '<g class="person update" id="person-2"><g class="content"><g class="arc"></g></g></g>';

        const callback = jest.fn();

        new Update(svg, { hideEmptySegments, showFamilyColors: false }, {}).updateDone(callback);

        return { svg, callback };
    };

    test("takes the arc of a removed person away while empty segments are hidden", () => {
        finish(true);

        expect(document.querySelectorAll("#person-1 g.arc")).toHaveLength(0);
        expect(document.querySelectorAll("#person-2 g.arc")).toHaveLength(1);
    });

    test("keeps the arc of a removed person while empty segments are shown", () => {
        finish(false);

        expect(document.querySelectorAll("#person-1 g.arc")).toHaveLength(1);
    });

    test("clears the lifecycle classes and the available mark and resets the tooltip", () => {
        const { svg, callback } = finish(false);

        for (const id of ["1", "2"]) {
            const element = document.querySelector(`#person-${id}`);

            expect(
                ["new", "update", "remove", "available"].filter((name) =>
                    element.classList.contains(name),
                ),
            ).toEqual([]);
        }

        expect(svg.div.property).toHaveBeenCalledWith("active", false);
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
