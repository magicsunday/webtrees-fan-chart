import { describe, expect, jest, test } from "@jest/globals";

// Only the request of the update is replaced. The selections, the transition and the timers are the
// real ones of d3, so the chart and its updater run as they do in the browser.
const requests = [];

const jsonMock = jest.fn(
    (url, init) =>
        new Promise((resolve, reject) => {
            requests.push({ url, signal: init?.signal, resolve });

            init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("The operation was aborted.", "AbortError"));
            });
        }),
);

await jest.unstable_mockModule("resources/js/modules/d3", async () => ({
    __esModule: true,
    ...(await import("d3-hierarchy")),
    ...(await import("d3-path")),
    ...(await import("d3-scale")),
    ...(await import("d3-selection")),
    ...(await import("d3-shape")),
    ...(await import("d3-timer")),
    ...(await import("d3-transition")),
    ...(await import("d3-zoom")),
    json: jsonMock,
}));

// jsdom draws nothing, so it knows no bounding boxes. The view box of the chart then follows an empty box.
globalThis.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });

const { default: Chart } = await import("resources/js/modules/chart");
const { default: Configuration } = await import("resources/js/modules/configuration");
const d3 = await import("resources/js/modules/d3");

const flushPromises = () =>
    new Promise((resolve) => {
        setTimeout(resolve, 0);
    });

/**
 * Builds a real chart on a real document whose hierarchy only records the data it is given.
 *
 * @returns {{ chart: object, hierarchyData: object[] }}
 */
function buildChart() {
    document.body.innerHTML =
        '<div id="parent"></div><svg><defs></defs><g class="visual">' +
        '<g class="personGroup"></g><g class="marriageGroup"></g></g></svg>';

    const root = d3.select(document.querySelector("svg"));
    const visual = d3.select(document.querySelector("g.visual"));
    const hierarchyData = [];
    const chart = new Chart(d3.select("#parent"), new Configuration({ updateDuration: 0 }));

    chart._svg = {
        visual,
        div: { property: jest.fn() },
        defs: { get: () => root.select("defs") },
        node: () => root.node(),
        select: (selector) => root.select(selector),
        selectAll: (selector) => root.selectAll(selector),
        transition: () => ({ duration: () => ({ attr: () => ({}) }) }),
    };
    chart._hierarchy = {
        nodes: [],
        descendantLayout: {},
        init: (data) => hierarchyData.push(data),
    };

    return { chart, hierarchyData };
}

describe("Chart updates that overlap", () => {
    beforeEach(() => {
        requests.length = 0;
        jsonMock.mockClear();
    });

    test("cancel the request of the superseded update", () => {
        const { chart } = buildChart();

        chart.update("/chart/I2");
        chart.update("/chart/I3");

        expect(requests.map((request) => request.url)).toEqual(["/chart/I2", "/chart/I3"]);
        expect(requests[0].signal.aborted).toBe(true);
        expect(requests[1].signal.aborted).toBe(false);
    });

    test("do not let the answer of the superseded update replace the newer chart", async () => {
        const { chart, hierarchyData } = buildChart();
        const olderAnswer = { title: "", data: { name: "older" } };
        const newerAnswer = { title: "", data: { name: "newer" } };

        chart.update("/chart/I2");
        chart.update("/chart/I3");

        // The server answers the newer request first and the superseded one last
        requests[1].resolve(newerAnswer);
        requests[0].resolve(olderAnswer);
        await flushPromises();

        expect(hierarchyData).toEqual([newerAnswer.data]);
    });
});
