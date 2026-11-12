import { describe, it, expect } from "@jest/globals";
import { classifyElement } from "resources/js/modules/svg/lifecycle";

function createMockElement(classes = {}) {
    const classMap = { new: false, update: false, remove: false, ...classes };

    return {
        classed: (name) => classMap[name] ?? false,
    };
}

describe("classifyElement", () => {
    // One row per class a person arc can carry during an update, and one without any
    it.each([
        ["a new element", { new: true }, { isNew: true, isUpdate: false, isRemove: false }],
        ["an update element", { update: true }, { isNew: false, isUpdate: true, isRemove: false }],
        ["a remove element", { remove: true }, { isNew: false, isUpdate: false, isRemove: true }],
        ["an unclassified element", {}, { isNew: false, isUpdate: false, isRemove: false }],
    ])("classifies %s", (_label, classes, expected) => {
        expect(classifyElement(createMockElement(classes))).toEqual(expected);
    });
});
