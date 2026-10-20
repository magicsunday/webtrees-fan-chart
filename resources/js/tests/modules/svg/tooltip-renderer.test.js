import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import * as d3 from "resources/js/modules/d3";
import {
    SYMBOL_BIRTH,
    SYMBOL_DEATH,
    SYMBOL_ELLIPSIS,
    SYMBOL_MARRIAGE,
} from "resources/js/modules/hierarchy";
import TooltipRenderer from "resources/js/modules/svg/tooltip-renderer";

const HOSTILE = `<img src=x onerror=alert(1)> & "quoted" 'single'`;
const ESCAPED = "&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot; &#39;single&#39;";

const createDatum = (overrides = {}) => ({
    data: {
        data: {
            xref: "I1",
            name: "Jane Doe",
            thumbnail: "",
            silhouette: "",
            birth: "",
            birthDateFull: "",
            birthPlace: "",
            death: "",
            deathDateFull: "",
            deathPlace: "",
            marriageDate: "",
            marriageDateFull: "",
            marriagePlace: "",
            ...overrides,
        },
    },
});

describe("TooltipRenderer", () => {
    let div;
    let renderer;
    const event = { pageX: 120, pageY: 80 };

    const build = (configuration = {}) => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        div = d3.select(host);

        return new TooltipRenderer({ div }, { showSilhouettes: false, ...configuration });
    };

    beforeEach(() => {
        document.body.innerHTML = "";
        renderer = build();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("escapes markup, ampersands and quotes in the name", () => {
        renderer.setTooltipHtml(event, createDatum({ name: HOSTILE }));

        const node = div.node();

        expect(node.innerHTML).toContain("&lt;img src=x onerror=alert(1)&gt; &amp;");
        expect(node.innerHTML).not.toContain("<img");
        expect(node.querySelector("img")).toBeNull();
        expect(node.querySelector(".name").textContent).toBe(HOSTILE);
    });

    it.each([
        ["birth", { birthDateFull: HOSTILE, birthPlace: HOSTILE }, SYMBOL_BIRTH],
        ["marriage", { marriageDateFull: HOSTILE, marriagePlace: HOSTILE }, SYMBOL_MARRIAGE],
        ["death", { deathDateFull: HOSTILE, deathPlace: HOSTILE }, SYMBOL_DEATH],
    ])("escapes the %s date and place", (_label, overrides, symbol) => {
        renderer.setTooltipHtml(event, createDatum(overrides));

        const node = div.node();

        expect(node.innerHTML).toContain("&lt;img src=x onerror=alert(1)&gt; &amp;");
        expect(node.innerHTML).not.toContain("<img");
        expect(node.querySelector("img")).toBeNull();
        expect(node.querySelector("tr.date td").textContent).toBe(HOSTILE);
        expect(node.querySelector("tr.place td").textContent).toBe(HOSTILE);
        expect(node.querySelector("tr.date th").textContent).toBe(symbol);
    });

    it("hands a fully escaped string to the tooltip element", () => {
        const received = [];
        const stub = {
            html(value) {
                received.push(value);

                return this;
            },
            style() {
                return this;
            },
            property() {
                return false;
            },
        };

        new TooltipRenderer({ div: stub }, { showSilhouettes: false }).setTooltipHtml(
            event,
            createDatum({ name: HOSTILE }),
        );

        expect(received).toEqual([`<div class="text"><div class="name">${ESCAPED}</div></div>`]);
    });

    it("does not decode entities that are part of a name", () => {
        renderer.setTooltipHtml(event, createDatum({ name: "&lt;b&gt;" }));

        expect(div.node().querySelector(".name").textContent).toBe("&lt;b&gt;");
        expect(div.node().querySelector("b")).toBeNull();
    });

    it("emits no place row for a fact without a place", () => {
        renderer.setTooltipHtml(event, createDatum({ birthDateFull: "1 Jan 1900" }));

        expect(div.node().querySelector("tr.date")).not.toBeNull();
        expect(div.node().querySelector("tr.place")).toBeNull();
    });

    it("falls back to the short date when no full date exists", () => {
        renderer.setTooltipHtml(
            event,
            createDatum({ birth: "1900", death: "1980", marriageDate: "1925" }),
        );

        const dates = [...div.node().querySelectorAll("tr.date td")].map(
            (cell) => cell.textContent,
        );

        expect(dates).toEqual(["1900", "1925", "1980"]);
    });

    it("keeps the fact symbols as markup and lists the facts in life order", () => {
        renderer.setTooltipHtml(
            event,
            createDatum({
                birthDateFull: "1 Jan 1900",
                marriageDateFull: "2 Feb 1925",
                deathDateFull: "3 Mar 1980",
            }),
        );

        const symbols = [...div.node().querySelectorAll("tr.date th")].map(
            (cell) => cell.textContent,
        );

        expect(symbols).toEqual([SYMBOL_BIRTH, SYMBOL_MARRIAGE, SYMBOL_DEATH]);
    });

    it("shows an ellipsis for a fact with a place but no date", () => {
        renderer.setTooltipHtml(event, createDatum({ birthPlace: "Springfield" }));

        const node = div.node();

        expect(node.querySelector("tr.date td").textContent).toBe(SYMBOL_ELLIPSIS);
        expect(node.querySelector("tr.place td").textContent).toBe("Springfield");
    });

    it("omits the table when the person has no facts", () => {
        renderer.setTooltipHtml(event, createDatum());

        expect(div.node().querySelector("table")).toBeNull();
        expect(div.node().querySelector(".name").textContent).toBe("Jane Doe");
    });

    it("escapes the thumbnail source so it cannot break out of the attribute", () => {
        renderer.setTooltipHtml(
            event,
            createDatum({ thumbnail: `x" onerror="alert(1)`, silhouette: "other.svg" }),
        );

        const image = div.node().querySelector(".image img");

        expect(image.getAttribute("src")).toBe(`x" onerror="alert(1)`);
        expect(image.hasAttribute("onerror")).toBe(false);
    });

    it("escapes the silhouette source when silhouettes are enabled", () => {
        renderer = build({ showSilhouettes: true });
        renderer.setTooltipHtml(event, createDatum({ silhouette: `x" onerror="alert(1)` }));

        const image = div.node().querySelector(".image-silhouette img");

        expect(image.getAttribute("src")).toBe(`x" onerror="alert(1)`);
        expect(image.hasAttribute("onerror")).toBe(false);
    });

    it.each([
        ["a dark page background", "rgb(10, 10, 10)", true],
        ["a light page background", "rgb(250, 250, 250)", false],
        ["a saturated green page background", "rgb(0, 200, 0)", false],
        ["a saturated blue page background", "rgb(0, 0, 200)", true],
        ["a saturated red page background", "rgb(200, 0, 0)", true],
        ["a grey just below the threshold", "rgb(120, 120, 120)", true],
        ["a grey just above the threshold", "rgb(136, 136, 136)", false],
        ["a missing computed colour", undefined, false],
        ["a page without a background colour", "", false],
    ])("marks the silhouette for %s", (_label, background, isDark) => {
        jest.spyOn(window, "getComputedStyle").mockReturnValue({ backgroundColor: background });
        renderer = build({ showSilhouettes: true });
        renderer.setTooltipHtml(event, createDatum({ silhouette: "silhouette.svg" }));

        const image = div.node().querySelector(".image-silhouette");

        expect(image).not.toBeNull();
        expect(image.classList.contains("image-silhouette-dark")).toBe(isDark);
    });

    it("shows no image for a silhouette when silhouettes are disabled", () => {
        renderer.setTooltipHtml(event, createDatum({ silhouette: "silhouette.svg" }));

        expect(div.node().querySelector(".image")).toBeNull();
    });

    it("shows no photo when the thumbnail is the silhouette placeholder", () => {
        renderer.setTooltipHtml(
            event,
            createDatum({ thumbnail: "silhouette.svg", silhouette: "silhouette.svg" }),
        );

        expect(div.node().querySelector(".image")).toBeNull();
    });

    it("renders nothing for an empty person", () => {
        renderer.setTooltipHtml(event, createDatum({ xref: "", name: "" }));

        expect(div.node().innerHTML).toBe("");
    });

    it("positions the tooltip near the cursor", () => {
        renderer.setTooltipHtml(event, createDatum());

        expect(div.style("left")).toBe("120px");
        expect(div.style("top")).toBe("50px");
    });

    it("binds no handlers for an empty person", () => {
        const handlers = [];
        const person = {
            on(name) {
                handlers.push(name);

                return this;
            },
        };

        renderer.bindEvents(person, createDatum({ xref: "" }));

        expect(handlers).toEqual([]);
    });

    it("binds the hover and context menu handlers for a person", () => {
        const handlers = [];
        const person = {
            on(name) {
                handlers.push(name);

                return this;
            },
        };

        renderer.bindEvents(person, createDatum());

        expect(handlers).toEqual([
            "contextmenu",
            "mouseenter",
            "mouseleave",
            "mousemove",
            "mouseover",
            "mouseout",
        ]);
    });

    it("pins the tooltip on a context menu click and releases it on the next one", () => {
        const listeners = {};
        const person = {
            on(name, listener) {
                listeners[name] = listener;

                return this;
            },
        };
        const prevented = [];
        const contextEvent = { ...event, preventDefault: () => prevented.push(true) };

        renderer.bindEvents(person, createDatum());

        listeners.contextmenu(contextEvent);

        expect(div.property("active")).toBe(true);
        expect(div.node().querySelector(".name").textContent).toBe("Jane Doe");

        listeners.contextmenu(contextEvent);

        expect(div.property("active")).toBe(false);
        expect(prevented).toHaveLength(2);
    });
});
