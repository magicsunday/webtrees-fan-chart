import { jest } from "@jest/globals";
import { createConfigurationValues } from "../helpers/configuration-values.js";

// Only the request of the update and the creation of its transition are replaced by a recording
// wrapper. The selections, the transitions and the timers are the real ones of d3, and the chart,
// its hierarchy and its svg are real as well, so the updater runs as it does in the browser.
const jsonMock = jest.fn();
// The durations that the updater sets on the transitions it creates, in call order
const durations = [];

await jest.unstable_mockModule("resources/js/modules/d3", async () => {
    const { transition } = await import("d3-transition");

    return {
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
        transition: (...args) => {
            const created = transition(...args);
            const setDuration = created.duration;

            created.duration = function (value) {
                durations.push(value);

                return setDuration.call(this, value);
            };

            return created;
        },
    };
});

// jsdom lays nothing out, so the chart gets the measures that a browser would
globalThis.SVGElement.prototype.getBBox = () => ({ x: -210, y: -130, width: 420, height: 260 });
globalThis.SVGElement.prototype.getComputedTextLength = () => 0;
globalThis.HTMLCanvasElement.prototype.getContext = () => ({
    font: "",
    measureText: (text) => ({ width: text.length * 6 }),
});

const { default: Chart } = await import("resources/js/modules/chart");
const { default: Update } = await import("resources/js/modules/chart-updater");
const { default: Configuration } = await import("resources/js/modules/configuration");
const d3 = await import("resources/js/modules/d3");

const person = (xref, generation, parents) => ({
    data: {
        id: xref,
        xref,
        url: `url-${xref}`,
        updateUrl: `update-${xref}`,
        generation,
        name: `Person ${xref}`,
        firstNames: ["Person"],
        lastNames: [xref],
        preferredName: `Person ${xref}`,
        alternativeName: "",
        isAltRtl: false,
        sex: "M",
        timespan: "",
        marriageDateOfParents: "",
    },
    ...(parents ? { parents } : {}),
});

/**
 * Builds the ancestors of a person with every parent known.
 *
 * @param {number} generations The number of generations, the person itself included
 * @param {number} generation  The generation of the person that is built
 * @param {string} prefix      The prefix of the xref of this branch
 */
const ancestors = (generations, generation = 1, prefix = "I") =>
    generation === generations
        ? person(prefix, generation)
        : person(prefix, generation, [
              ancestors(generations, generation + 1, `${prefix}1`),
              ancestors(generations, generation + 1, `${prefix}2`),
          ]);

/**
 * Renders a real chart and hands back the updater of its svg and hierarchy.
 *
 * @param {object} options The options of the configuration
 * @param {object} datum   The data of the chart that is drawn first
 */
function createChart(options = {}, datum = ancestors(2)) {
    document.body.innerHTML = '<h1 class="wt-page-title">Original</h1><div id="parent"></div>';

    const configuration = new Configuration(
        createConfigurationValues({ generations: 2, ...options }),
    );

    configuration.updateDuration = 20;

    const chart = new Chart(d3.select("#parent"), configuration);

    chart.data = datum;
    chart.render();

    return {
        chart,
        configuration,
        update: new Update(chart.svg, configuration, chart._hierarchy),
    };
}

/**
 * Runs an update and resolves once its callback ran.
 *
 * @param {Update} update The updater
 * @param {object} answer The answer of the server
 */
function runUpdate(update, answer) {
    jsonMock.mockResolvedValueOnce(answer);

    return new Promise((resolve) => {
        const redrawOverlays = jest.fn();
        const callback = jest.fn(() => resolve({ redrawOverlays, callback }));

        update.update("/update", redrawOverlays, callback);
    });
}

const flush = (milliseconds = 0) =>
    new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });

const lifecycleClasses = () =>
    [...document.querySelectorAll("g.person, g.marriage")].flatMap((element) =>
        ["new", "update", "remove"].filter((name) => element.classList.contains(name)),
    );

beforeEach(() => {
    jsonMock.mockReset();
    durations.length = 0;
    document.title = "";
});

afterEach(() => {
    delete window.matchMedia;
    jest.restoreAllMocks();
});

describe("Update", () => {
    test("takes the handlers from the persons before it fetches and sets the titles", async () => {
        const { update, chart } = createChart();
        const element = document.querySelector("g.person");

        expect(d3.select(element).on("click")).toBeInstanceOf(Function);

        const done = runUpdate(update, { data: ancestors(2), title: "<strong>Updated</strong>" });

        // The request has not been answered yet
        expect(d3.select(element).on("click")).toBeUndefined();
        expect(d3.select(element).on("mouseover")).toBeUndefined();
        expect(d3.select(element).on("mouseout")).toBeUndefined();

        await done;

        expect(document.querySelector(".wt-page-title").innerHTML).toBe("<strong>Updated</strong>");
        expect(document.title).toBe("Updated");
        expect(chart._hierarchy.nodes).toHaveLength(3);
    });

    test("leaves the tab title empty when the title of the response has no text", async () => {
        const { update } = createChart();

        document.title = "Before";

        // A browser lays the detached element out as nothing and gives an empty text, jsdom has no
        // innerText at all. The stand-in returns a text, so the title may only come from textContent.
        Object.defineProperty(HTMLElement.prototype, "innerText", {
            configurable: true,
            get: () => "from innerText",
        });

        try {
            await runUpdate(update, { data: ancestors(2), title: '<img src="x.png" alt="">' });

            expect(document.title).toBe("");
        } finally {
            delete HTMLElement.prototype.innerText;
        }
    });

    // The duration of the transition is the configured one, and none while the user asks for
    // less motion
    test.each([
        ["without the preference for less motion", false, 20],
        ["when the user prefers reduced motion", true, 0],
    ])("runs the transition %s", async (_label, reduced, duration) => {
        window.matchMedia = jest.fn(() => ({ matches: reduced }));

        const { update } = createChart();

        await runUpdate(update, { data: ancestors(2) });

        expect(durations).toEqual([duration]);
    });

    // A person who is gone from the new chart loses the arc, and a person who comes with the
    // new chart gets one, while the empty segments are hidden
    test.each([
        ["leaves", ["I1", "I2", "I3"], ["I1", "I2", ""], ["I1", "I2"]],
        ["enters", ["I1", "I2", ""], ["I1", "I2", "I3"], ["I1", "I2", "I3"]],
    ])("re-centers on a chart where a person %s", async (_label, before, after, expected) => {
        const chartOf = ([root, father, mother]) =>
            person(root, 1, [person(father, 2), person(mother, 2)]);
        const { update } = createChart({ hideEmptySegments: true }, chartOf(before));

        await runUpdate(update, { data: chartOf(after) });

        const drawn = [...document.querySelectorAll("g.person")]
            .filter((element) => element.querySelector("g.arc") !== null)
            .map((element) => d3.select(element).datum().data.data.xref)
            .sort();

        expect(drawn).toEqual([...expected].sort());
    });

    test("draws the arcs of the descendants with the layout of the new hierarchy", async () => {
        const { update } = createChart({ showDescendants: true });
        const root = {
            ...ancestors(2),
            partners: [{ ...person("P1", -1), children: [person("C1", -2)] }],
        };

        await runUpdate(update, { data: root });

        const partnerArc = document.querySelector("g.person g.arc path[d]");

        expect(document.querySelectorAll("g.person")).toHaveLength(5);
        expect(partnerArc).not.toBeNull();

        for (const path of document.querySelectorAll("g.person g.arc path")) {
            expect(path.getAttribute("d")).not.toContain("NaN");
        }
    });

    test("classifies the marriage arcs of the persons that have parents in the new chart", async () => {
        const { update, chart } = createChart(
            { generations: 3, showParentMarriageDates: true },
            ancestors(3),
        );

        // The mother of the center is unknown in the new chart, so her marriage arc has no
        // known child any more
        const root = ancestors(3);

        root.parents[1] = person("", 2);
        chart._hierarchy.init(root);
        update._classifyMarriageElements();

        const classes = Object.fromEntries(
            [...document.querySelectorAll("g.marriage")].map((element) => [
                element.id,
                ["new", "update", "remove"].filter((name) => element.classList.contains(name)),
            ]),
        );
        const [rootNode, , motherNode] = chart._hierarchy.nodes;

        expect(classes[`marriage-${rootNode.id}`]).toEqual(["new"]);
        expect(classes[`marriage-${motherNode.id}`]).toEqual(["remove"]);
    });

    // The chart carries the mark of the family colors exactly while the configuration shows them
    test.each([
        ["shown", true],
        ["hidden", false],
    ])("marks the chart after an update while the family colors are %s", async (_label, shown) => {
        const { update } = createChart({ showFamilyColors: shown });
        const visual = document.querySelector("svg > g");

        visual.classList.toggle("family-colors", !shown);

        await runUpdate(update, { data: ancestors(2) });

        expect(visual.classList.contains("family-colors")).toBe(shown);
    });

    test("marks the chart for the family colors after a request that failed", async () => {
        const { update } = createChart({ showFamilyColors: true });
        const visual = document.querySelector("svg > g");
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        visual.classList.remove("family-colors");
        jsonMock.mockRejectedValueOnce(new Error("network down"));

        await new Promise((resolve) => {
            update.update("/update", jest.fn(), resolve);
        });

        expect(visual.classList.contains("family-colors")).toBe(true);
        expect(errorSpy).toHaveBeenCalled();
    });

    test("calls back once after the transition has finished and the update is cleaned up", async () => {
        const { update, chart } = createChart();
        const tooltip = chart.svg.div;

        tooltip.property("active", true);

        const { callback } = await runUpdate(update, { data: ancestors(2) });

        // Nothing is left of the update when the callback is called
        expect(lifecycleClasses()).toEqual([]);
        expect(document.querySelectorAll("g.content.old")).toHaveLength(0);
        expect(document.querySelectorAll("g.person.available")).toHaveLength(0);
        expect(tooltip.property("active")).toBe(false);

        // Both the end of the transition and the fallback of the update would call it
        await flush(100);

        expect(callback).toHaveBeenCalledTimes(1);
    });

    test("reports a request that a newer update cancelled instead of calling back", async () => {
        const { update } = createChart();
        const callback = jest.fn();
        const onSuperseded = jest.fn();
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        jsonMock.mockRejectedValueOnce(
            new DOMException("The operation was aborted.", "AbortError"),
        );

        update.update("/update", jest.fn(), callback, onSuperseded);
        await flush();

        expect(onSuperseded).toHaveBeenCalledTimes(1);
        expect(callback).not.toHaveBeenCalled();
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test("does not report a superseded request when the request fails for another reason", async () => {
        const { update } = createChart();
        const callback = jest.fn();
        const onSuperseded = jest.fn();

        jest.spyOn(console, "error").mockImplementation(() => {});
        jsonMock.mockRejectedValueOnce(new Error("network error"));

        update.update("/update", jest.fn(), callback, onSuperseded);
        await flush();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(onSuperseded).not.toHaveBeenCalled();
    });

    test("cancels its own pending request when it starts the next update", () => {
        const { update } = createChart();
        const signals = [];

        jsonMock.mockImplementation((_url, init) => {
            signals.push(init.signal);

            return new Promise(() => {});
        });

        update.update("/first", jest.fn(), jest.fn());
        update.update("/second", jest.fn(), jest.fn());

        expect(signals.map((signal) => signal.aborted)).toEqual([true, false]);
    });

    test("restores interactivity and cleans the lifecycle classes after a failed request", async () => {
        const { update } = createChart();
        const callback = jest.fn();
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        // A partial update left marks on the arcs
        document.querySelector("g.person").classList.add("new", "update", "remove");
        jsonMock.mockRejectedValueOnce(new Error("network error"));

        update.update("/update", jest.fn(), callback);
        await flush();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith("Fan chart update failed:", expect.any(Error));
        expect(lifecycleClasses()).toEqual([]);
    });

    test("keeps the previous content of an arc that a failed update had already marked", async () => {
        const { update } = createChart();
        const arc = document.querySelector("g.person");
        const content = arc.querySelector("g.content");

        // The update marked the arc as updated and its content as the old one before it failed
        arc.classList.add("update");
        content.classList.add("old");
        jest.spyOn(console, "error").mockImplementation(() => {});
        jsonMock.mockRejectedValueOnce(new Error("network error"));

        await new Promise((resolve) => {
            update.update("/update", jest.fn(), resolve);
        });

        // The marks are gone before the cleanup of a finished update runs, so that cleanup does
        // not take the previous content away from the arc
        expect(arc.classList.contains("update")).toBe(false);
        expect(arc.contains(content)).toBe(true);
    });

    describe("notice of a failed update", () => {
        const failedText = "The chart could not be updated.";

        const notices = () => [...document.querySelectorAll('[role="alert"]')];

        const failWith = async (update, error) => {
            jest.spyOn(console, "error").mockImplementation(() => {});
            jsonMock.mockRejectedValueOnce(error);

            await new Promise((resolve) => {
                update.update("/update", jest.fn(), resolve);
            });
        };

        test.each([
            ["an HTTP error", new Error("500 Internal Server Error")],
            ["a response that is not JSON", new SyntaxError("Unexpected token < in JSON")],
            ["an access denial", new Error("403 Forbidden")],
        ])("tells the user about %s and keeps the chart usable", async (_kind, error) => {
            const { update } = createChart({
                labels: { zoom: "", move: "", updateFailed: failedText },
            });
            const arcs = document.querySelectorAll("g.person").length;

            await failWith(update, error);

            expect(notices()).toHaveLength(1);
            expect(notices()[0].textContent).toBe(failedText);
            // The notice sits above the chart and the previous chart is still drawn
            expect(notices()[0].nextElementSibling).toBe(document.querySelector("svg"));
            expect(document.querySelectorAll("g.person")).toHaveLength(arcs);
        });

        test("shows one notice however often updates fail in a row", async () => {
            const { update } = createChart({
                labels: { zoom: "", move: "", updateFailed: failedText },
            });

            await failWith(update, new Error("500 Internal Server Error"));
            await failWith(update, new Error("500 Internal Server Error"));

            expect(notices()).toHaveLength(1);
        });

        test("removes the notice when the next update succeeds", async () => {
            const { update } = createChart({
                labels: { zoom: "", move: "", updateFailed: failedText },
            });

            await failWith(update, new Error("500 Internal Server Error"));
            expect(notices()).toHaveLength(1);

            await runUpdate(update, { data: ancestors(2), title: "Updated" });

            expect(notices()).toHaveLength(0);
        });

        test("shows no notice for a request that a newer update superseded", async () => {
            const { update } = createChart({
                labels: { zoom: "", move: "", updateFailed: failedText },
            });
            const aborted = new Error("aborted");

            aborted.name = "AbortError";
            jsonMock.mockRejectedValueOnce(aborted);

            await new Promise((resolve) => {
                update.update("/update", jest.fn(), jest.fn(), resolve);
            });

            expect(notices()).toHaveLength(0);
        });
    });
});
