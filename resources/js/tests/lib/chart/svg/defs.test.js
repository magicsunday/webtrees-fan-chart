import { describe, expect, jest, test } from "@jest/globals";
import Defs from "resources/js/modules/lib/chart/svg/defs";

describe("Defs", () => {
    test("appends defs element and proxies helpers", () => {
        const defsSelection = {
            select: jest.fn(),
            append: jest.fn(),
        };
        const parentSelection = {
            append: jest.fn(() => defsSelection),
        };

        const defs = new Defs(parentSelection);

        expect(parentSelection.append).toHaveBeenCalledWith("defs");
        expect(defs.get()).toBe(defsSelection);

        defs.select("pattern");
        defs.append("style");

        expect(defsSelection.select).toHaveBeenCalledWith("pattern");
        expect(defsSelection.append).toHaveBeenCalledWith("style");
    });
});
