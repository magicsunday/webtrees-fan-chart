import { jest } from "@jest/globals";

const { default: Chart } = await import("resources/js/modules/chart");

/**
 * Builds a stand-in for a chart that has the pieces the click routing uses.
 *
 * @param {{showDetailPanel?: boolean, panel?: object|null}} options The state of the chart
 */
function buildChart({ showDetailPanel = true, panel = { select: jest.fn() } } = {}) {
    const context = {
        _configuration: { showDetailPanel },
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
            on(event, handler) {
                clicks.push([event, handler]);

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
            _configuration: { showDetailPanel },
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
