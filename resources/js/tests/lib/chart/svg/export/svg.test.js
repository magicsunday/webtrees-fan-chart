import { describe, expect, jest, test, beforeEach } from "@jest/globals";
import SvgExport from "resources/js/modules/lib/chart/svg/export/svg";

describe("SvgExport", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("createSandbox attaches hidden iframe", () => {
        const exporter = new SvgExport();
        const node = document.createElement("div");

        const result = exporter.createSandbox(node);

        expect(result).toBe(node);
        expect(exporter._sandbox).toBeDefined();
        expect(document.querySelectorAll("iframe")).toHaveLength(1);

        document.body.removeChild(exporter._sandbox);
        exporter._sandbox = null;
    });

    test("getDefaultComputedStyle caches style declarations", () => {
        const exporter = new SvgExport();
        const defaultStyle = { cached: true };
        const sandbox = {
            contentWindow: {
                document: {
                    createElement: jest.fn(() => ({ tagName: "SPAN", textContent: "" })),
                    body: {
                        appendChild: jest.fn(),
                        removeChild: jest.fn(),
                    },
                },
                getComputedStyle: jest.fn(() => defaultStyle),
            },
        };

        exporter._sandbox = sandbox;

        const first = exporter.getDefaultComputedStyle({ tagName: "SPAN" });
        const second = exporter.getDefaultComputedStyle({ tagName: "SPAN" });

        expect(sandbox.contentWindow.document.createElement).toHaveBeenCalledTimes(1);
        expect(first).toBe(defaultStyle);
        expect(second).toBe(defaultStyle);
    });

    test("cloneStyles copies style differences", async () => {
        const exporter = new SvgExport();
        const defaultStyle = {
            length: 1,
            0: "color",
            getPropertyValue: () => "rgb(0, 0, 0)",
        };
        exporter._defaultStyles = { SPAN: defaultStyle };

        const sourceStyle = {
            length: 1,
            0: "color",
            getPropertyValue: (name) => (name === "color" ? "rgb(1, 2, 3)" : ""),
            getPropertyPriority: () => "",
        };
        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = jest.fn(() => sourceStyle);

        const target = document.createElement("span");
        const result = await exporter.cloneStyles({ tagName: "SPAN" }, target, null);

        expect(result.style.getPropertyValue("color")).toBe("rgb(1, 2, 3)");

        window.getComputedStyle = originalGetComputedStyle;
    });

    test("cloneChildren duplicates child nodes", async () => {
        const exporter = new SvgExport();
        const source = document.createElement("div");
        source.appendChild(document.createElement("span"));

        exporter._sandbox = {
            contentWindow: {
                document: {
                    createElement: jest.fn(() => document.createElement("div")),
                    body: { appendChild: jest.fn(), removeChild: jest.fn() },
                },
                getComputedStyle: jest.fn(() => ({ length: 0, getPropertyValue: () => "" })),
            },
        };

        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = jest.fn(() => ({ length: 0, getPropertyValue: () => "" }));

        const target = document.createElement("div");
        const result = await exporter.cloneChildren(source, target);

        expect(result.childNodes).toHaveLength(1);

        window.getComputedStyle = originalGetComputedStyle;
    });

    test("convertToObjectUrl produces blob URL", async () => {
        const exporter = new SvgExport();
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        const originalURL = window.URL;
        const createObjectURL = jest.fn(() => "blob:svg");
        Object.defineProperty(window, "URL", {
            configurable: true,
            value: { createObjectURL },
        });

        const mockImage = {
            set src(value) {
                this._src = value;
                this.onload();
            },
            onload: () => {},
        };
        const OriginalImage = global.Image;
        // eslint-disable-next-line func-names
        global.Image = function () {
            return mockImage;
        };

        const result = await exporter.convertToObjectUrl(svg);

        expect(result).toBe("blob:svg");
        expect(createObjectURL).toHaveBeenCalled();

        global.Image = OriginalImage;
        Object.defineProperty(window, "URL", { configurable: true, value: originalURL });
    });

    test("cleanUp removes sandbox", () => {
        const exporter = new SvgExport();
        const sandbox = document.createElement("iframe");
        document.body.appendChild(sandbox);
        exporter._sandbox = sandbox;

        const result = exporter.cleanUp("blob:svg");

        expect(result).toBe("blob:svg");
        expect(document.querySelector("iframe")).toBeNull();
    });

    test("svgToImage orchestrates export steps", async () => {
        class TestExport extends SvgExport {
            constructor() {
                super();
                this.triggerDownload = jest.fn();
            }

            createSandbox(node) {
                this._sandbox = {
                    contentWindow: {
                        document: {
                            createElement: () => node,
                            body: { appendChild: jest.fn(), removeChild: jest.fn() },
                        },
                        getComputedStyle: () => ({ length: 0, getPropertyValue: () => "" }),
                    },
                };

                return node;
            }

            cloneStyles(source, target) {
                return Promise.resolve(target);
            }

            cloneChildren(source, target) {
                return Promise.resolve(target);
            }

            convertToObjectUrl() {
                return Promise.resolve("blob:svg");
            }

            cleanUp(objectUrl) {
                return objectUrl;
            }
        }

        const exporter = new TestExport();
        const svg = { node: () => document.createElementNS("http://www.w3.org/2000/svg", "svg") };

        await exporter.svgToImage(svg, [], "fan-chart", "chart.svg");
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(exporter.triggerDownload).toHaveBeenCalledWith("blob:svg", "chart.svg");
    });
});
