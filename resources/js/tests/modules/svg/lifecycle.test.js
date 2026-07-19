import { describe, it, expect } from "@jest/globals";
import { classifyElement } from "resources/js/modules/svg/lifecycle";

function createMockElement(classes = {}) {
    const classMap = { new: false, update: false, remove: false, ...classes };

    return {
        classed: (name) => classMap[name] ?? false,
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
