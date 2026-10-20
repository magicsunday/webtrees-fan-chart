import { describe, expect, it } from "@jest/globals";
import * as d3 from "resources/js/modules/d3";
import Filter from "resources/js/modules/svg/filter";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const createDefs = () => {
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    const defs = document.createElementNS(SVG_NAMESPACE, "defs");

    svg.appendChild(defs);

    return defs;
};

describe("Filter", () => {
    it("registers the drop-shadow filter in the given defs element", () => {
        const defs = createDefs();

        new Filter(d3.select(defs));

        const filters = defs.querySelectorAll("filter");

        expect(filters).toHaveLength(1);
        expect(filters[0].getAttribute("id")).toBe("drop-shadow");
        expect(filters[0].namespaceURI).toBe(SVG_NAMESPACE);
    });

    it("emits a centred, translucent black drop shadow primitive", () => {
        const defs = createDefs();

        new Filter(d3.select(defs));

        const shadow = defs.querySelector("filter#drop-shadow > feDropShadow");

        expect(shadow).not.toBeNull();
        expect(shadow.getAttribute("stdDeviation")).toBe("7 7");
        expect(shadow.getAttribute("dx")).toBe("0");
        expect(shadow.getAttribute("dy")).toBe("0");
        expect(shadow.getAttribute("flood-opacity")).toBe("0.3");
        expect(shadow.getAttribute("flood-color")).toBe("rgb(0,0,0)");
    });

    it("does not touch other definitions in the defs element", () => {
        const defs = createDefs();
        const existing = document.createElementNS(SVG_NAMESPACE, "clipPath");

        defs.appendChild(existing);

        new Filter(d3.select(defs));

        expect(defs.firstChild).toBe(existing);
        expect(defs.children).toHaveLength(2);
    });
});
