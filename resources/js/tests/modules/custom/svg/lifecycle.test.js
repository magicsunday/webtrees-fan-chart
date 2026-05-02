import { describe, it, expect } from "@jest/globals";
import { classifyElement, fadeIfUpdating } from "resources/js/modules/custom/svg/lifecycle";

function createMockElement(classes = {}) {
    const classMap = { new: false, update: false, remove: false, ...classes };

    return {
        classed: (name) => classMap[name] ?? false,
    };
}

function createMockSelection() {
    let opacity = null;

    return {
        style: (prop, value) => {
            if (prop === "opacity") opacity = value;
        },
        getOpacity: () => opacity,
    };
}

describe("classifyElement", () => {
    it("detects new elements", () => {
        const el = createMockElement({ new: true });
        const result = classifyElement(el);

        expect(result).toEqual({ isNew: true, isUpdate: false, isRemove: false });
    });

    it("detects update elements", () => {
        const el = createMockElement({ update: true });
        const result = classifyElement(el);

        expect(result).toEqual({ isNew: false, isUpdate: true, isRemove: false });
    });

    it("detects remove elements", () => {
        const el = createMockElement({ remove: true });
        const result = classifyElement(el);

        expect(result).toEqual({ isNew: false, isUpdate: false, isRemove: true });
    });

    it("returns all false for unclassified elements", () => {
        const el = createMockElement();
        const result = classifyElement(el);

        expect(result).toEqual({ isNew: false, isUpdate: false, isRemove: false });
    });
});

describe("fadeIfUpdating", () => {
    it("sets opacity to 1e-6 when parent is updating", () => {
        const parent = createMockElement({ update: true });
        const selection = createMockSelection();

        fadeIfUpdating(selection, parent);

        expect(selection.getOpacity()).toBe(1e-6);
    });

    it("does not set opacity when parent is not updating", () => {
        const parent = createMockElement();
        const selection = createMockSelection();

        fadeIfUpdating(selection, parent);

        expect(selection.getOpacity()).toBeNull();
    });
});
