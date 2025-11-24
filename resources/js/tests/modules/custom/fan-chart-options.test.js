import { jest } from "@jest/globals";
import { FAN_CHART_DEFAULTS, resolveFanChartOptions } from "resources/js/modules/custom/fan-chart-options";
import * as defaultD3 from "resources/js/modules/lib/d3";

describe("resolveFanChartOptions", () => {
    it("applies defaults when provided values are invalid", () => {
        const resolved = resolveFanChartOptions({
            generations: "invalid",
            fanDegree: undefined,
            fontScale: null,
            hideEmptySegments: "false",
            showColorGradients: 1,
            showParentMarriageDates: "nope",
            showImages: {},
            showSilhouettes: [],
            rtl: "rtl",
            innerArcs: "two",
            cssFiles: ["fan.css", 3],
            labels: ["Fan", true],
        });

        expect(resolved.generations).toBe(FAN_CHART_DEFAULTS.generations);
        expect(resolved.fanDegree).toBe(FAN_CHART_DEFAULTS.fanDegree);
        expect(resolved.fontScale).toBe(FAN_CHART_DEFAULTS.fontScale);
        expect(resolved.hideEmptySegments).toBe(FAN_CHART_DEFAULTS.hideEmptySegments);
        expect(resolved.showColorGradients).toBe(FAN_CHART_DEFAULTS.showColorGradients);
        expect(resolved.showParentMarriageDates).toBe(FAN_CHART_DEFAULTS.showParentMarriageDates);
        expect(resolved.showImages).toBe(FAN_CHART_DEFAULTS.showImages);
        expect(resolved.showSilhouettes).toBe(FAN_CHART_DEFAULTS.showSilhouettes);
        expect(resolved.rtl).toBe(FAN_CHART_DEFAULTS.rtl);
        expect(resolved.innerArcs).toBe(FAN_CHART_DEFAULTS.innerArcs);
        expect(resolved.cssFiles).toEqual(["fan.css"]);
        expect(resolved.labels).toEqual(["Fan"]);
        expect(resolved.d3).toBe(defaultD3);
        expect(resolved.controls).toBeUndefined();
    });

    it("collects inline callbacks when no controls object is provided", () => {
        const onRender = jest.fn();
        const resolved = resolveFanChartOptions({ onRender });

        expect(resolved.controls).toBeDefined();
        expect(resolved.controls.onRender).toBe(onRender);
    });

    it("normalizes the controls map and discards non-function entries", () => {
        const onResize = jest.fn();
        const resolved = resolveFanChartOptions({
            controls: {
                onRender: "not a function",
                onResize,
            },
        });

        expect(resolved.controls).toEqual({ onResize });
    });
});
