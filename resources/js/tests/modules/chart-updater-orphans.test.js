import { describe, expect, jest, test } from "@jest/globals";
import * as d3 from "resources/js/modules/d3";

const { default: Update } = await import("resources/js/modules/chart-updater");

/**
 * Builds a real SVG with a defs element and hands back the parts an update works on. The update
 * reads and removes the elements through the selection of the chart, so the test drives it with
 * real d3 selections on a real document and looks at what is left afterwards.
 *
 * @param {string} markup The markup of the svg content
 */
function createChart(markup) {
    document.body.innerHTML = `<svg>${markup}</svg>`;

    const root = d3.select(document.querySelector("svg"));

    return {
        div: { property: jest.fn() },
        defs: { get: () => root.select("defs") },
        select: (selector) => root.select(selector),
        selectAll: (selector) => root.selectAll(selector),
    };
}

/**
 * Runs the cleanup at the end of an update and returns the ids that are left in the defs.
 *
 * @param {string} markup The markup of the svg content
 *
 * @returns {string[]}
 */
function idsLeftAfterUpdateDone(markup) {
    const svg = createChart(markup);
    const update = new Update(svg, { hideEmptySegments: false, showFamilyColors: false }, {});
    const callback = jest.fn();

    update.updateDone(callback);

    expect(callback).toHaveBeenCalledTimes(1);

    return Array.from(document.querySelectorAll("defs [id]")).map((element) => element.id);
}

describe("Update cleanup of orphaned definitions", () => {
    test("removes a path definition that no text path refers to any more", () => {
        const ids = idsLeftAfterUpdateDone(`
            <defs>
                <path id="path-person-1"></path>
                <path id="path-person-2"></path>
                <path id="path-marriage-3"></path>
            </defs>
            <g class="personGroup">
                <g class="person"><g class="content"><text><textPath href="#path-person-2"></textPath></text></g></g>
            </g>`);

        expect(ids).toEqual(["path-person-2"]);
    });

    test("removes a clip path that no image uses any more and keeps the used one", () => {
        const ids = idsLeftAfterUpdateDone(`
            <defs>
                <clipPath id="clip-image-1"></clipPath>
                <clipPath id="clip-image-2"></clipPath>
                <clipPath id="other-clip"></clipPath>
            </defs>
            <g class="personGroup">
                <g class="person"><g class="content"><image clip-path="url(#clip-image-2)"></image></g></g>
            </g>`);

        expect(ids).toEqual(["clip-image-2", "other-clip"]);
    });

    test("keeps every definition when it is still referenced", () => {
        const ids = idsLeftAfterUpdateDone(`
            <defs>
                <path id="path-person-1"></path>
                <clipPath id="clip-image-1"></clipPath>
            </defs>
            <g class="personGroup">
                <g class="person"><g class="content">
                    <text><textPath href="#path-person-1"></textPath></text>
                    <image clip-path="url(#clip-image-1)"></image>
                </g></g>
            </g>`);

        expect(ids).toEqual(["path-person-1", "clip-image-1"]);
    });
});
