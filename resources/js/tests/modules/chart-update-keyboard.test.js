import { jest } from "@jest/globals";

// The animated update is covered elsewhere. A stand-in records how the chart starts it.
const updates = [];

await jest.unstable_mockModule("resources/js/modules/chart-updater", () => ({
    default: class {
        constructor(svg, configuration, hierarchy) {
            this.svg = svg;
            this.configuration = configuration;
            this.hierarchy = hierarchy;
        }

        update(url, redrawOverlays, callback) {
            updates.push({ url, redrawOverlays, callback });
        }
    },
}));

const { default: Chart } = await import("resources/js/modules/chart");
const { default: Configuration } = await import("resources/js/modules/configuration");
const d3 = await import("resources/js/modules/d3");

const node = (xref) => ({
    depth: 2,
    data: {
        data: {
            xref,
            url: `/individual/${xref}`,
            updateUrl: `/chart/${xref}`,
            generation: 3,
        },
    },
});

/**
 * Builds a real chart with the detail panel on whose person groups are real SVG elements.
 *
 * @param {object[]} nodes The d3 data of the person groups
 */
function buildRealChart(nodes) {
    document.body.innerHTML =
        '<div id="parent"></div><svg><g class="visual">' +
        '<g class="personGroup"></g><g class="marriageGroup"></g></g></svg>';

    const visual = d3.select(document.querySelector("g.visual"));
    const elements = visual
        .select("g.personGroup")
        .selectAll("g.person")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "person")
        .nodes();
    const chart = new Chart(d3.select("#parent"), new Configuration({ showDetailPanel: true }));

    chart._svg = { visual, select: (selector) => visual.select(selector) };

    return { chart, elements };
}

describe("Chart update with the detail panel", () => {
    beforeEach(() => {
        updates.length = 0;
    });

    test("takes the key handlers of the old persons away as soon as the update starts", () => {
        const { chart, elements } = buildRealChart([node("I1")]);
        const panel = { select: jest.fn() };

        chart.detailPanel = panel;
        chart.bindClickEventListener();
        chart.update("/chart/I2");

        // The arc already shows another person while the animation runs
        d3.select(elements[0]).datum(node("I2"));
        elements[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(panel.select).not.toHaveBeenCalled();
    });

    test("starts the animated update with the address and the rebinding", () => {
        const { chart } = buildRealChart([node("I1")]);

        chart.update("/chart/I2");

        expect(updates).toHaveLength(1);
        expect(updates[0].url).toBe("/chart/I2");
        expect(updates[0].callback).toBeInstanceOf(Function);
    });

    test("binds the persons of the new drawing when the update is done", () => {
        const { chart, elements } = buildRealChart([node("I1")]);
        const panel = { select: jest.fn() };

        chart.detailPanel = panel;
        chart.bindClickEventListener();
        chart.update("/chart/I2");

        d3.select(elements[0]).datum(node("I2"));
        updates[0].callback();
        elements[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(panel.select).toHaveBeenCalledTimes(1);
        expect(panel.select.mock.calls[0][0].xref).toBe("I2");
    });
});
