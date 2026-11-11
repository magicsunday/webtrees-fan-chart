import { jest, describe, expect, test } from "@jest/globals";

await jest.unstable_mockModule("resources/js/modules/d3", () => ({
    __esModule: true,
}));

const { appendArc } = await import("resources/js/modules/svg/arc");

const createParentSelection = () => {
    const styles = {};
    const path = {
        attr: jest.fn(function () {
            return this;
        }),
        style: jest.fn((name, value) => {
            styles[name] = value;
            return path;
        }),
    };
    const arcGroup = {
        attr: jest.fn(function () {
            return this;
        }),
        append: jest.fn(() => path),
    };
    const parent = {
        append: jest.fn(() => arcGroup),
    };

    return { parent, arcGroup, path, styles };
};

describe("appendArc", () => {
    test("sets fill color when provided", () => {
        const { parent, styles } = createParentSelection();

        appendArc(parent, jest.fn(), "#ff0000");

        expect(styles.fill).toBe("#ff0000");
    });

    test("sets no style when no color is given", () => {
        const { parent, path } = createParentSelection();

        appendArc(parent, jest.fn(), null);

        expect(path.style).not.toHaveBeenCalled();
    });

    test("appends g.arc group with path using arc generator", () => {
        const { parent, arcGroup } = createParentSelection();
        const arcGenerator = jest.fn();

        appendArc(parent, arcGenerator, null);

        expect(parent.append).toHaveBeenCalledWith("g");
        expect(arcGroup.append).toHaveBeenCalledWith("path");
    });
});
