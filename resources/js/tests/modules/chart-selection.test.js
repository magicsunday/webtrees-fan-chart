import { jest } from "@jest/globals";

const { default: Chart } = await import("resources/js/modules/chart");
const { default: Configuration } = await import("resources/js/modules/configuration");
const d3 = await import("resources/js/modules/d3");

/**
 * Builds a stand-in for a chart that has the pieces the click routing uses.
 *
 * @param {{showDetailPanel?: boolean, panel?: object|null}} options The state of the chart
 */
function buildChart({ showDetailPanel = true, panel = { select: jest.fn() } } = {}) {
    const context = {
        _configuration: { showDetailPanel, isDrawn: () => true },
        _detailPanel: panel,
        _selection: {
            select: jest.fn(),
            apply: jest.fn(),
            clear: jest.fn(),
            restoreFocus: jest.fn(),
            makeOperable: jest.fn(),
        },
        redirectToIndividual: jest.fn(),
        update: jest.fn(),
    };

    return { context };
}

const person = (depth = 2, overrides = {}) => ({
    depth,
    data: {
        data: {
            xref: "I2",
            url: "/individual/I2",
            updateUrl: "/chart/I2",
            generation: depth + 1,
            ...overrides,
        },
    },
});

describe("Chart click routing", () => {
    test("selects the person for the panel and navigates nowhere", () => {
        const { context } = buildChart();
        const datum = person();

        Chart.prototype.personClick.call(context, null, datum);

        expect(context._selection.select).toHaveBeenCalledWith(datum.data);
        expect(context._detailPanel.select).toHaveBeenCalledWith(datum.data.data, false);
        expect(context.update).not.toHaveBeenCalled();
        expect(context.redirectToIndividual).not.toHaveBeenCalled();
    });

    test("selects the center person instead of opening its page", () => {
        const { context } = buildChart();
        const datum = person(0, { generation: 1 });

        Chart.prototype.personClick.call(context, null, datum);

        expect(context._detailPanel.select).toHaveBeenCalledWith(datum.data.data, false);
        expect(context.redirectToIndividual).not.toHaveBeenCalled();
    });

    test("selects a descendant instead of centering the chart on it", () => {
        const { context } = buildChart();
        const datum = person(-1, { generation: -1 });

        Chart.prototype.personClick.call(context, null, datum);

        expect(context._detailPanel.select).toHaveBeenCalledWith(datum.data.data, false);
        expect(context.update).not.toHaveBeenCalled();
    });

    test("tells the panel when a key triggered the selection", () => {
        const { context } = buildChart();
        const datum = person();

        Chart.prototype.personClick.call(context, null, datum, true);

        expect(context._detailPanel.select).toHaveBeenCalledWith(datum.data.data, true);
    });

    test("behaves as before with the panel switched off", () => {
        const { context } = buildChart({ showDetailPanel: false });

        Chart.prototype.personClick.call(context, null, person());
        Chart.prototype.personClick.call(context, null, person(0, { generation: 1 }));

        expect(context.update).toHaveBeenCalledWith("/chart/I2");
        expect(context.redirectToIndividual).toHaveBeenCalledWith("/individual/I2");
        expect(context._selection.select).not.toHaveBeenCalled();
    });

    test("behaves as before when the page has no panel element", () => {
        const { context } = buildChart({ panel: null });

        Chart.prototype.personClick.call(context, null, person());

        expect(context.update).toHaveBeenCalledWith("/chart/I2");
        expect(context._selection.select).not.toHaveBeenCalled();
    });

    test("ignores a person without an update URL", () => {
        const { context } = buildChart();

        Chart.prototype.personClick.call(context, null, person(2, { updateUrl: "" }));

        expect(context._detailPanel.select).not.toHaveBeenCalled();
        expect(context._selection.select).not.toHaveBeenCalled();
        expect(context.update).not.toHaveBeenCalled();
    });
});

describe("Chart click binding", () => {
    /**
     * Builds a chart stand-in whose person elements are the given nodes, and records the
     * element that each handler is bound to.
     *
     * @param {boolean} showDetailPanel Whether the panel is on
     * @param {object[]} nodes          The d3 data of the person elements
     */
    function bind(showDetailPanel, nodes) {
        const bound = [];
        const clicks = [];
        const persons = {
            nodes,
            filter(predicate) {
                return { ...persons, nodes: this.nodes.filter(predicate) };
            },
            classed() {
                return this;
            },
            attr() {
                return this;
            },
            data() {
                return this.nodes;
            },
            on(event, handler) {
                // Taking a handler away binds nothing
                if (handler !== null) {
                    clicks.push([event, handler]);
                }

                return this;
            },
            each(callback) {
                this.nodes.forEach((node) => callback.call("element", node));

                return this;
            },
        };
        const empty = {
            selectAll: () => empty,
            filter: () => empty,
            classed: () => empty,
            each: () => empty,
        };
        const context = {
            _configuration: { showDetailPanel, isDrawn: () => true },
            svg: {
                select: (selector) =>
                    selector === "g.personGroup" ? { selectAll: () => persons } : empty,
            },
            _selection: {
                makeOperable: jest.fn((target, node, activate) =>
                    bound.push([target, node, activate]),
                ),
                apply: jest.fn(),
            },
            personClick: jest.fn(),
        };

        return { context, bound, clicks };
    }

    const node = (xref, url) => ({ depth: 2, data: { data: { xref, url } } });

    test("makes the selectable persons keyboard operable with the panel on", () => {
        const first = node("I1", "/i/1");
        const { context, bound } = bind(true, [first, node("", "")]);

        Chart.prototype.bindClickEventListener.call(context);

        expect(context._selection.makeOperable).toHaveBeenCalledTimes(1);
        expect(bound[0][1]).toBe(first);
    });

    test("hands the key activation of a person to the click routing", () => {
        const first = node("I1", "/i/1");
        const { context, bound } = bind(true, [first]);

        Chart.prototype.bindClickEventListener.call(context);
        bound[0][2](first.data, true);

        expect(context.personClick).toHaveBeenCalledWith(null, first, true);
    });

    test("leaves the persons as they were with the panel off", () => {
        const { context } = bind(false, [node("I1", "/i/1")]);

        Chart.prototype.bindClickEventListener.call(context);

        expect(context._selection.makeOperable).not.toHaveBeenCalled();
    });

    test("binds the click on the persons in both modes", () => {
        const withPanel = bind(true, [node("I1", "/i/1")]);
        const withoutPanel = bind(false, [node("I1", "/i/1")]);

        Chart.prototype.bindClickEventListener.call(withPanel.context);
        Chart.prototype.bindClickEventListener.call(withoutPanel.context);

        expect(withPanel.clicks.map(([event]) => event)).toEqual(["click"]);
        expect(withoutPanel.clicks.map(([event]) => event)).toEqual(["click"]);
    });

    test("applies the selection again after the persons are bound", () => {
        const { context } = bind(true, [node("I1", "/i/1")]);

        Chart.prototype.bindClickEventListener.call(context);

        expect(context._selection.apply).toHaveBeenCalledTimes(1);
    });
});

describe("Chart selection helpers", () => {
    test("clearSelection removes the mark of the selected person", () => {
        const { context } = buildChart();

        Chart.prototype.clearSelection.call(context);

        expect(context._selection.clear).toHaveBeenCalledTimes(1);
    });

    test("restoreFocus gives the focus back to the selected person", () => {
        const { context } = buildChart();

        Chart.prototype.restoreFocus.call(context);

        expect(context._selection.restoreFocus).toHaveBeenCalledTimes(1);
    });
});

describe("A real chart with the detail panel", () => {
    // The d3 datum is the hierarchy node, its data is the node of the payload, and that holds the person
    const node = (xref, depth = 2) => ({
        depth,
        data: {
            data: {
                xref,
                url: `/individual/${xref}`,
                updateUrl: `/chart/${xref}`,
                generation: depth + 1,
            },
        },
    });

    /**
     * Builds a real chart whose persons are real SVG groups that carry d3 data.
     *
     * @param {object[]} nodes          The d3 data of the person groups
     * @param {boolean}  showDetailPanel Whether the panel switch is on
     * @param {object}   options         Further options of the chart configuration
     */
    function buildRealChart(nodes, showDetailPanel = true, options = {}) {
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
        const chart = new Chart(
            d3.select("#parent"),
            new Configuration({ showDetailPanel, ...options }),
        );

        chart._svg = { visual, select: (selector) => visual.select(selector) };

        return { chart, elements };
    }

    test("hands the clicked person to the panel that was set on the chart", () => {
        const first = node("I1");
        const { chart } = buildRealChart([first]);
        const panel = { select: jest.fn() };

        chart.detailPanel = panel;
        chart.personClick(null, first);

        expect(panel.select).toHaveBeenCalledTimes(1);
        expect(panel.select.mock.calls[0][0].xref).toBe("I1");
    });

    test("marks the selected person in the drawn chart and no other one", () => {
        const first = node("I1");
        const second = node("I2");
        const { chart, elements } = buildRealChart([first, second]);

        chart.detailPanel = { select: jest.fn() };
        chart.personClick(null, second);

        expect(elements[0].classList.contains("selected")).toBe(false);
        expect(elements[1].classList.contains("selected")).toBe(true);
        expect(elements[1].getAttribute("aria-current")).toBe("true");
    });

    test("selects a person by a click on its drawn element", () => {
        const first = node("I1");
        const { chart, elements } = buildRealChart([first]);
        const panel = { select: jest.fn() };

        chart.detailPanel = panel;
        chart.bindClickEventListener();
        elements[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));

        expect(panel.select).toHaveBeenCalledWith(first.data.data, false);
        expect(elements[0].classList.contains("selected")).toBe(true);
    });

    test("selects a person by Enter on its drawn element and reaches it with the Tab key", () => {
        const first = node("I1");
        const { chart, elements } = buildRealChart([first]);
        const panel = { select: jest.fn() };

        chart.detailPanel = panel;
        chart.bindClickEventListener();

        expect(elements[0].getAttribute("tabindex")).toBe("0");

        elements[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(panel.select).toHaveBeenCalledWith(first.data.data, true);
    });

    test("leaves the drawn elements out of the tab order with the panel off", () => {
        const { chart, elements } = buildRealChart([node("I1")], false);

        chart.bindClickEventListener();

        expect(elements[0].hasAttribute("tabindex")).toBe(false);
    });

    test("leaves the persons out of the tab order that are not drawn with names off", () => {
        // With names off only the inner generations are drawn, the outer groups stay empty
        const { chart, elements } = buildRealChart([node("I1", 2), node("I2", 5)], true, {
            showNames: false,
            innerArcs: 4,
        });
        const panel = { select: jest.fn() };

        chart.detailPanel = panel;
        chart.bindClickEventListener();
        elements[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(elements[0].getAttribute("tabindex")).toBe("0");
        expect(elements[1].hasAttribute("tabindex")).toBe(false);
        expect(elements[1].hasAttribute("role")).toBe(false);
        expect(panel.select).not.toHaveBeenCalled();
    });

    test("keeps the mark on the person while the chart is bound again after an update", () => {
        const first = node("I1");
        const { chart, elements } = buildRealChart([first]);

        chart.detailPanel = { select: jest.fn() };
        chart.personClick(null, first);
        elements[0].classList.remove("selected");
        chart.bindClickEventListener();

        expect(elements[0].classList.contains("selected")).toBe(true);
    });

    test("takes the keyboard bindings of the previous person from an arc that becomes empty", () => {
        const first = node("I1");
        const { chart, elements } = buildRealChart([first]);
        const panel = { select: jest.fn() };

        chart.detailPanel = panel;
        chart.bindClickEventListener();

        expect(elements[0].getAttribute("tabindex")).toBe("0");
        expect(elements[0].getAttribute("aria-label")).not.toBeNull();

        // An update reuses the element for an empty placeholder
        d3.select(elements[0]).datum(node(""));
        chart.bindClickEventListener();

        expect(elements[0].hasAttribute("tabindex")).toBe(false);
        expect(elements[0].hasAttribute("aria-label")).toBe(false);
        expect(elements[0].hasAttribute("role")).toBe(false);

        elements[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(panel.select).not.toHaveBeenCalled();
    });

    test("keeps the person of a reused arc operable with the keyboard after binding again", () => {
        const first = node("I1");
        const second = node("I2");
        const { chart, elements } = buildRealChart([first]);
        const panel = { select: jest.fn() };

        chart.detailPanel = panel;
        chart.bindClickEventListener();
        d3.select(elements[0]).datum(second);
        chart.bindClickEventListener();
        elements[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

        expect(panel.select).toHaveBeenCalledTimes(1);
        expect(panel.select).toHaveBeenCalledWith(second.data.data, true);
    });

    test("gives the focus back to the selected person after an update replaced the hierarchy objects", () => {
        const before = node("I1");
        const { chart, elements } = buildRealChart([before]);

        chart.detailPanel = { select: jest.fn() };
        chart.bindClickEventListener();
        chart.personClick(null, before);

        // An update binds new hierarchy objects to the reused arcs
        d3.select(elements[0]).datum(node("I1"));
        chart.bindClickEventListener();
        chart.restoreFocus();

        expect(document.activeElement).toBe(elements[0]);
    });

    test("leaves the focus alone when the selected person is not in the chart any more", () => {
        const before = node("I1");
        const { chart, elements } = buildRealChart([before]);

        chart.detailPanel = { select: jest.fn() };
        chart.bindClickEventListener();
        chart.personClick(null, before);

        d3.select(elements[0]).datum(node("I9"));
        chart.bindClickEventListener();
        chart.restoreFocus();

        expect(document.activeElement).not.toBe(elements[0]);
        expect(elements[0].classList.contains("selected")).toBe(false);
    });

    test("forgets the selected person once the panel has closed", () => {
        const before = node("I1");
        const { chart, elements } = buildRealChart([before]);

        chart.detailPanel = { select: jest.fn() };
        chart.bindClickEventListener();
        chart.personClick(null, before);
        chart.clearSelection();
        chart.bindClickEventListener();

        expect(elements[0].classList.contains("selected")).toBe(false);
    });
});
