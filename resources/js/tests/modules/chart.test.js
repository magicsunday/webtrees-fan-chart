import { jest } from "@jest/globals";

const { default: Chart } = await import("resources/js/modules/chart");
const { default: Configuration } = await import("resources/js/modules/configuration");
const d3 = await import("resources/js/modules/d3");

// jsdom lays nothing out. These stand-ins give the chart the measures that a browser would, with
// values that are all different so that a mixed up measure shows in the view box.
const SVG_BOX = { x: -210, y: -130, width: 420, height: 260 };
const CONTAINER = { width: 500, height: 400 };

globalThis.SVGElement.prototype.getBBox = () => ({ ...SVG_BOX });
globalThis.SVGElement.prototype.getComputedTextLength = () => 0;
globalThis.HTMLCanvasElement.prototype.getContext = () => ({
    font: "",
    measureText: (text) => ({ width: text.length * 6 }),
});

const person = (id, generation, xref, parents) => ({
    data: {
        id,
        xref,
        url: `url-${id}`,
        updateUrl: `update-${id}`,
        generation,
        name: `Person ${id}`,
        firstNames: ["Person"],
        lastNames: [`${id}`],
        preferredName: `Person ${id}`,
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
 * @param {string} prefix      The prefix of the ids of this branch
 */
const ancestors = (generations, generation = 1, prefix = "I") => {
    const xref = `${prefix}`;

    if (generation === generations) {
        return person(xref, generation, xref);
    }

    return person(xref, generation, xref, [
        ancestors(generations, generation + 1, `${prefix}1`),
        ancestors(generations, generation + 1, `${prefix}2`),
    ]);
};

/**
 * Builds a root with a known parent and an empty one.
 */
const createHierarchyDatum = () =>
    person("I1", 1, "I1", [person("I2", 2, "I2"), person("I3", 2, "")]);

/**
 * Builds a real parent element with the size of the container and hands back a d3 selection of it.
 */
const createParent = ({ width, height } = CONTAINER) => {
    document.body.innerHTML = '<div id="parent"></div>';

    const element = document.querySelector("#parent");

    element.getBoundingClientRect = () => ({
        width,
        height,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
    });

    return d3.select(element);
};

const createChart = (options = {}, datum = createHierarchyDatum(), size = CONTAINER) => {
    const chart = new Chart(createParent(size), new Configuration({ generations: 2, ...options }));

    chart.data = datum;
    chart.render();

    return chart;
};

const viewBoxOf = (chart) =>
    chart.svg.visual.node().ownerSVGElement.getAttribute("viewBox").split(/[ ,]+/).map(Number);

describe("Chart", () => {
    beforeEach(() => {
        window.getComputedStyle = jest.fn(() => ({ fontSize: "16px", getPropertyValue: () => "" }));
    });

    afterEach(() => {
        document.fullscreenElement = null;
    });

    describe("render", () => {
        // The persons of the draw rules: every known person, and an empty ancestor only while
        // the empty segments are kept
        test.each([
            ["keeps the empty segments", false, ["I1", "I2", ""]],
            ["hides the empty segments", true, ["I1", "I2"]],
        ])("draws a person element per drawn person and %s", (_label, hideEmptySegments, xrefs) => {
            const chart = createChart({ hideEmptySegments });
            const drawn = chart.svg.visual.selectAll("g.person").nodes();

            expect(
                drawn.map((element) => d3.select(element).datum().data.data.xref).sort(),
            ).toEqual([...xrefs].sort());
            expect(drawn.every((element) => element.id.startsWith("person-"))).toBe(true);
        });

        // The view box is the content box centered in the container, with one rem of padding
        // on every side. The container is 500 by 400, the content 420 by 260 at (-210, -130):
        // the offsets are 40 and 70, the left is -210 - 40 - 16, the top is -130 - 70 - 16 and
        // the size is the container plus twice the padding.
        test("sets the view box from the content, the container and the padding", () => {
            const chart = createChart();

            expect(viewBoxOf(chart)).toEqual([-266, -216, 532, 432]);
        });

        test("takes a content that is larger than the container as the size of the view box", () => {
            const chart = createChart({}, createHierarchyDatum(), { width: 300, height: 200 });

            // No offset is left, so the view box starts at the content minus the padding
            expect(viewBoxOf(chart)).toEqual([-226, -146, 452, 292]);
        });

        test("fills the container in fullscreen mode", () => {
            const chart = createChart();
            const svg = chart.svg.visual.node().ownerSVGElement;

            expect(svg.getAttribute("width")).toBe("100%");

            document.fullscreenElement = document.createElement("div");
            chart.updateViewBox();

            expect(svg.getAttribute("width")).toBe("500");
            expect(svg.getAttribute("height")).toBe("400");
            expect(viewBoxOf(chart)).toEqual([-266, -216, 532, 432]);
        });

        // Every generation draws a separator between two neighbours of different families. A tree
        // of four generations has families of two at each depth, so depth 1 has none, depth 2
        // has one boundary and depth 3 has three.
        test("draws a separator between every two neighbouring families", () => {
            const chart = createChart({ generations: 4 }, ancestors(4));

            expect(chart.svg.visual.selectAll("g.separatorGroup line").size()).toBe(4);
        });

        test("draws no separator while the neighbours belong to one family", () => {
            const chart = createChart({ generations: 2 }, ancestors(2));

            expect(chart.svg.visual.selectAll("g.separatorGroup line").size()).toBe(0);
        });

        test("draws a marriage arc for every person that has parents when the dates are shown", () => {
            const chart = createChart(
                { generations: 3, showParentMarriageDates: true },
                ancestors(3),
            );

            // The root and its two parents have parents, the grandparents are the last generation
            expect(chart.svg.visual.selectAll("g.marriageGroup g.marriage").size()).toBe(3);
        });
    });

    describe("descendants", () => {
        const child = (xref) => person(xref, -2, xref);
        const partner = (xref, children = []) => ({
            ...person(xref, -1, xref),
            ...(children.length > 0 ? { children } : {}),
        });
        const withPartners = (partners) => ({ ...ancestors(2), partners });

        // Two partners are two blocks of the sector, so one separator runs between them
        test("draws a separator between the partners of the descendant sector", () => {
            const chart = createChart(
                { generations: 2, showDescendants: true },
                withPartners([partner("P1", [child("C1")]), partner("P2")]),
            );

            // The ancestors of two generations have no boundary between families
            expect(chart.svg.visual.selectAll("g.separatorGroup line").size()).toBe(1);
        });

        test("draws a marriage arc for every partner when the dates are shown", () => {
            const chart = createChart(
                { generations: 2, showDescendants: true, showParentMarriageDates: true },
                withPartners([partner("P1", [child("C1")]), partner("P2")]),
            );

            expect(chart.svg.visual.selectAll("g.marriage.descendant").size()).toBe(2);
        });

        test("draws no descendant elements without partners", () => {
            const chart = createChart(
                { generations: 2, showDescendants: true, showParentMarriageDates: true },
                withPartners([]),
            );

            expect(chart.svg.visual.selectAll("g.marriage.descendant").size()).toBe(0);
            expect(chart.svg.visual.selectAll("g.separatorGroup line").size()).toBe(0);
        });
    });

    describe("motion", () => {
        /**
         * Builds a chart stand-in whose svg records the duration of every transition.
         *
         * @param {number[]} durations Receives the durations in call order
         */
        const buildMotionChart = (durations) => {
            const transition = {
                duration(value) {
                    durations.push(value);

                    return this;
                },
                attr() {
                    return this;
                },
                call() {
                    return this;
                },
            };

            return {
                _configuration: { updateDuration: 1250 },
                parent: { node: () => ({ getBoundingClientRect: () => ({}) }) },
                convertRemToPixels: () => 16,
                _computeViewBox: () => ({ left: 0, top: 0, width: 1, height: 1 }),
                svg: {
                    transition: () => transition,
                    zoom: { get: () => ({ transform: () => {} }) },
                    visual: {
                        selectAll: () => ({ style: () => {} }),
                        node: () => ({ getBBox: () => ({}) }),
                    },
                },
            };
        };

        afterEach(() => {
            delete window.matchMedia;
        });

        test("animates the re-centering and the zoom reset without that preference", () => {
            const durations = [];
            const context = buildMotionChart(durations);

            Chart.prototype.transitionViewBox.call(context);
            Chart.prototype.center.call(context);

            expect(durations).toEqual([1250, 750]);
        });

        test("skips the animation of both when the user prefers reduced motion", () => {
            window.matchMedia = jest.fn(() => ({ matches: true }));

            const durations = [];
            const context = buildMotionChart(durations);

            Chart.prototype.transitionViewBox.call(context);
            Chart.prototype.center.call(context);

            expect(durations).toEqual([0, 0]);
        });
    });

    describe("descendant sector", () => {
        const partnerNode = (id, x0, x1) => ({ id, depth: -1, x0, x1, data: { data: {} } });

        const createRenderedChart = (nodes) => {
            const chart = createChart({ showDescendants: true, showParentMarriageDates: true });

            jest.spyOn(chart._hierarchy, "nodes", "get").mockReturnValue(nodes);

            return chart;
        };

        test("draws no descendant separators while the sector has no scale", () => {
            const chart = createRenderedChart([partnerNode(1, 0, 0.5), partnerNode(2, 0.5, 1)]);
            const separatorGroup = { append: jest.fn() };

            expect(() =>
                chart.drawDescendantSeparators({ childScale: null }, separatorGroup),
            ).not.toThrow();
            expect(separatorGroup.append).not.toHaveBeenCalled();
        });

        test.each([
            ["a scale", (fraction) => fraction * Math.PI, 2],
            ["no scale", null, 0],
        ])("draws descendant marriage arcs for the partners with %s", (_label, scale, count) => {
            const chart = createRenderedChart([partnerNode(1, 0, 0.5), partnerNode(2, 0.5, 1)]);
            const appended = [];
            const attributes = [];
            const entering = {
                attr: (name, value) => {
                    attributes.push([name, typeof value === "function" ? "computed" : value]);

                    return entering;
                },
                each: () => entering,
            };
            const exiting = { classed: () => exiting, selectAll: () => exiting };
            const join = {
                each: () => join,
                exit: () => exiting,
                enter: () => ({
                    append: (tag) => {
                        appended.push(tag);

                        return entering;
                    },
                }),
            };
            const data = jest.fn(() => join);

            chart._hierarchy.descendantLayout.childScale = scale;
            chart.svg.visual.select = () => ({
                empty: () => false,
                selectAll: () => ({ data }),
            });

            chart.drawDescendantMarriageArcs();

            expect(data.mock.calls[0][0]).toHaveLength(count);
            // The entering elements are created as descendant marriage groups
            expect(appended).toEqual(["g"]);
            expect(attributes).toContainEqual(["class", "marriage descendant"]);
        });
    });

    test("svg throws before render() has been called and is available afterwards", () => {
        const chart = new Chart(createParent(), new Configuration());

        expect(() => chart.svg).toThrow(
            "Chart.svg is not available before render() has been called",
        );

        chart.data = createHierarchyDatum();
        chart.render();

        expect(() => chart.svg).not.toThrow();
    });

    test("convertRemToPixels uses the document root font size", () => {
        const chart = new Chart(createParent(), new Configuration());
        const getComputedStyleSpy = jest
            .spyOn(window, "getComputedStyle")
            .mockReturnValue({ fontSize: "18px" });

        const result = chart.convertRemToPixels(2.5);

        expect(getComputedStyleSpy).toHaveBeenCalledWith(document.documentElement);
        expect(result).toBe(45);

        getComputedStyleSpy.mockRestore();
    });

    test("draws marriage arcs only for nodes with children inside the displayed generations", () => {
        const chart = new Chart(createParent(), new Configuration({ generations: 3 }));
        const drawnNodes = [];
        const marriageGroup = {
            empty: () => false,
            selectAll: () => marriageGroup,
            each: () => marriageGroup,
            data: (nodes) => {
                drawnNodes.push(...nodes);

                return {
                    enter: () => ({
                        append: () => ({
                            attr: function () {
                                return this;
                            },
                        }),
                    }),
                };
            },
        };

        chart._svg = { visual: { select: () => marriageGroup } };
        chart._hierarchy = {
            descendantLayout: {},
            nodes: [
                { id: 1, depth: 0, children: [{}] },
                { id: 2, depth: 2, children: [{}] },
                { id: 3, depth: 1 },
            ],
        };

        chart.drawMarriageArcs();

        expect(drawnNodes.map((node) => node.id)).toEqual([1]);
    });

    test("render applies family colors even when parent marriage dates are hidden", () => {
        const chart = createChart({ showFamilyColors: true, showParentMarriageDates: false });

        const coloredDatums = chart._hierarchy.nodes.filter(
            (datum) => datum?.data?.data?.xref !== "",
        );

        expect(coloredDatums).not.toHaveLength(0);
        expect(
            coloredDatums.every((datum) => typeof datum.data.data.familyColor === "string"),
        ).toBe(true);
    });
});
