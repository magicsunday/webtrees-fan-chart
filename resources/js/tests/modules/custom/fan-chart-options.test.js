import { jest } from "@jest/globals";
import { FAN_CHART_BASE_DEFAULTS } from "resources/js/modules/custom/fan-chart-definitions";
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

    it("coerces numeric string options to finite numbers", () => {
        const resolved = resolveFanChartOptions({
            fanDegree: "275",
            fontScale: "125.5",
            innerArcs: "3",
        });

        expect(resolved.fanDegree).toBe(275);
        expect(resolved.fontScale).toBeCloseTo(125.5);
        expect(resolved.innerArcs).toBe(3);
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
                onUnknown: jest.fn(),
            },
        });

        expect(resolved.controls).toEqual({ onResize });
    });

    it("preserves shared defaults for selector, css files, and d3", () => {
        const resolved = resolveFanChartOptions({ selector: 123 });

        expect(resolved.selector).toBe(FAN_CHART_BASE_DEFAULTS.selector);
        expect(resolved.d3).toBe(FAN_CHART_BASE_DEFAULTS.d3);
        expect(resolved.cssFiles).toEqual(FAN_CHART_BASE_DEFAULTS.cssFiles);
    });

    it("returns copies when applying default arrays", () => {
        const resolved = resolveFanChartOptions();

        resolved.cssFiles.push("fan.css");

        expect(resolved.cssFiles).toContain("fan.css");
        expect(FAN_CHART_BASE_DEFAULTS.cssFiles).toHaveLength(0);
        expect(FAN_CHART_DEFAULTS.cssFiles).toHaveLength(0);
    });
});
