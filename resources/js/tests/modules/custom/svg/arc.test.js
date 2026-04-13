import { jest, describe, expect, test } from "@jest/globals";

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
}));

const { appendArc } = await import("resources/js/modules/custom/svg/arc");

const createParentSelection = (isNew = false) => {
    const styles = {};
    const path = {
        attr: jest.fn(function () { return this; }),
        style: jest.fn((name, value) => { styles[name] = value; return path; }),
    };
    const arcGroup = {
        attr: jest.fn(function () { return this; }),
        append: jest.fn(() => path),
    };
    const parent = {
        append: jest.fn(() => arcGroup),
        classed: jest.fn((name) => name === "new" ? isNew : false),
    };

    return { parent, arcGroup, path, styles };
};

describe("appendArc", () => {
    test("sets both fill and opacity on new elements", () => {
        const { parent, styles } = createParentSelection(true);

        appendArc(parent, jest.fn(), "#ff0000");

        expect(styles.fill).toBe("#ff0000");
        expect(styles.opacity).toBe(1e-6);
    });

    test("sets fill color on existing elements", () => {
        const { parent, styles } = createParentSelection(false);

        appendArc(parent, jest.fn(), "#ff0000");

        expect(styles.fill).toBe("#ff0000");
        expect(styles.opacity).toBeUndefined();
    });

    test("sets neither fill nor opacity when not new and no color", () => {
        const { parent, path } = createParentSelection(false);

        appendArc(parent, jest.fn(), null);

        expect(path.style).not.toHaveBeenCalled();
    });

    test("appends g.arc group with path using arc generator", () => {
        const { parent, arcGroup } = createParentSelection(false);
        const arcGenerator = jest.fn();

        appendArc(parent, arcGenerator, null);

        expect(parent.append).toHaveBeenCalledWith("g");
        expect(arcGroup.append).toHaveBeenCalledWith("path");
    });
});
