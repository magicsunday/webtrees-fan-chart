import { jest } from "@jest/globals";

import Filter from "resources/js/modules/custom/svg/filter";

const createDefsSelection = () => {
    const feDropShadowAttrCalls = [];

    const feDropShadowSelection = {
        attr: jest.fn((name, value) => {
            feDropShadowAttrCalls.push({ name, value });
            return feDropShadowSelection;
        })
    };

    const filterAttrCalls = [];

    const filterSelection = {
        attr: jest.fn((name, value) => {
            filterAttrCalls.push({ name, value });
            return filterSelection;
        }),
        append: jest.fn(() => feDropShadowSelection)
    };

    const defsSelection = {
        append: jest.fn(() => filterSelection)
    };

    return { defsSelection, filterAttrCalls, feDropShadowAttrCalls, filterSelection };
};

describe("Filter", () => {
    it("creates a drop shadow filter and exposes the defs selection", () => {
        const context = createDefsSelection();

        const filter = new Filter(context.defsSelection);

        expect(context.defsSelection.append).toHaveBeenCalledWith("filter");
        expect(context.filterAttrCalls).toEqual([{ name: "id", value: "drop-shadow" }]);
        expect(context.filterSelection.append).toHaveBeenCalledWith("feDropShadow");
        expect(context.feDropShadowAttrCalls).toEqual([
            { name: "stdDeviation", value: "7 7" },
            { name: "dx", value: "0" },
            { name: "dy", value: "0" },
            { name: "flood-opacity", value: "0.3" },
            { name: "flood-color", value: "rgb(0,0,0)" }
        ]);
        expect(filter.get()).toBe(context.defsSelection);
    });
});
