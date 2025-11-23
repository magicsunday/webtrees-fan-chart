import { jest } from "@jest/globals";

const SEX_MALE = "M";
const SEX_FEMALE = "F";

await jest.unstable_mockModule("resources/js/modules/custom/hierarchy", () => ({
    __esModule: true,
    SEX_MALE,
    SEX_FEMALE,
    default: jest.fn()
}));

const { default: Gradient } = await import("resources/js/modules/custom/gradient");

const createDefsContext = () => {
    const gradientAttrCalls = [];
    const stopAttrCalls = [];

    const gradientSelection = {
        attr: jest.fn((name, value) => {
            gradientAttrCalls.push({ name, value });
            return gradientSelection;
        }),
        append: jest.fn(() => {
            const calls = [];
            stopAttrCalls.push(calls);

            const stopSelection = {
                attr: jest.fn((name, value) => {
                    calls.push({ name, value });
                    return stopSelection;
                })
            };

            return stopSelection;
        })
    };

    return {
        defs: { append: jest.fn(() => gradientSelection) },
        gradientAttrCalls,
        stopAttrCalls
    };
};

const createDatum = ({ depth, id = 1, sex, parentColors = null }) => ({
    depth,
    id,
    data: {
        data: {
            sex,
            ...(parentColors ? {} : { colors: undefined })
        }
    },
    ...(parentColors
        ? {
            parent: {
                data: {
                    data: {
                        colors: parentColors
                    }
                }
            }
        }
        : {})
});

describe("Gradient.init", () => {
    it("returns early when depth is less than 1", () => {
        const defsContext = createDefsContext();
        const gradient = new Gradient({ defs: defsContext.defs });
        const datum = createDatum({ depth: 0, id: 3, sex: SEX_MALE });

        gradient.init(datum);

        expect(defsContext.defs.append).not.toHaveBeenCalled();
        expect(datum.data.data.colors).toBeUndefined();
    });

    it("creates male gradient colors for the first generation", () => {
        const defsContext = createDefsContext();
        const gradient = new Gradient({ defs: defsContext.defs });
        const datum = createDatum({ depth: 1, id: 5, sex: SEX_MALE });

        gradient.init(datum);

        expect(defsContext.defs.append).toHaveBeenCalledWith("svg:linearGradient");
        expect(defsContext.gradientAttrCalls).toEqual([{ name: "id", value: "grad-5" }]);
        expect(defsContext.stopAttrCalls).toHaveLength(2);
        expect(defsContext.stopAttrCalls[0]).toEqual([
            { name: "offset", value: "0%" },
            { name: "stop-color", value: "rgb(64,143,222)" }
        ]);
        expect(defsContext.stopAttrCalls[1]).toEqual([
            { name: "offset", value: "100%" },
            { name: "stop-color", value: "rgb(161,219,117)" }
        ]);
        expect(datum.data.data.colors).toEqual([
            [64, 143, 222],
            [161, 219, 117]
        ]);
    });

    it("creates female gradient colors for the first generation", () => {
        const defsContext = createDefsContext();
        const gradient = new Gradient({ defs: defsContext.defs });
        const datum = createDatum({ depth: 1, id: 6, sex: SEX_FEMALE });

        gradient.init(datum);

        expect(defsContext.defs.append).toHaveBeenCalledWith("svg:linearGradient");
        expect(defsContext.gradientAttrCalls).toEqual([{ name: "id", value: "grad-6" }]);
        expect(defsContext.stopAttrCalls).toHaveLength(2);
        expect(defsContext.stopAttrCalls[0]).toEqual([
            { name: "offset", value: "0%" },
            { name: "stop-color", value: "rgb(218,102,13)" }
        ]);
        expect(defsContext.stopAttrCalls[1]).toEqual([
            { name: "offset", value: "100%" },
            { name: "stop-color", value: "rgb(235,201,33)" }
        ]);
        expect(datum.data.data.colors).toEqual([
            [218, 102, 13],
            [235, 201, 33]
        ]);
    });

    it("averages parent colors and preserves male-first order for deeper generations", () => {
        const defsContext = createDefsContext();
        const gradient = new Gradient({ defs: defsContext.defs });
        const parentColors = [
            [10, 20, 30],
            [55, 65, 75]
        ];
        const datum = createDatum({
            depth: 2,
            id: 8,
            sex: SEX_MALE,
            parentColors
        });

        gradient.init(datum);

        expect(defsContext.defs.append).toHaveBeenCalledWith("svg:linearGradient");
        expect(defsContext.gradientAttrCalls).toEqual([{ name: "id", value: "grad-8" }]);
        expect(datum.data.data.colors).toEqual([
            [10, 20, 30],
            [33, 43, 53]
        ]);
        expect(defsContext.stopAttrCalls[0][1].value).toBe("rgb(10,20,30)");
        expect(defsContext.stopAttrCalls[1][1].value).toBe("rgb(33,43,53)");
    });

    it("averages parent colors and preserves female-first order for deeper generations", () => {
        const defsContext = createDefsContext();
        const gradient = new Gradient({ defs: defsContext.defs });
        const parentColors = [
            [5, 15, 25],
            [40, 60, 80]
        ];
        const datum = createDatum({
            depth: 3,
            id: 9,
            sex: SEX_FEMALE,
            parentColors
        });

        gradient.init(datum);

        expect(defsContext.defs.append).toHaveBeenCalledWith("svg:linearGradient");
        expect(defsContext.gradientAttrCalls).toEqual([{ name: "id", value: "grad-9" }]);
        expect(datum.data.data.colors).toEqual([
            [23, 38, 53],
            [40, 60, 80]
        ]);
        expect(defsContext.stopAttrCalls[0][1].value).toBe("rgb(23,38,53)");
        expect(defsContext.stopAttrCalls[1][1].value).toBe("rgb(40,60,80)");
    });
});
