import { describe, expect, jest, test } from "@jest/globals";
import PngExport from "resources/js/modules/lib/chart/svg/export/png";

describe("PngExport", () => {
    test("calculateViewBox expands bounds with padding", () => {
        const pngExport = new PngExport();
        const svgElement = { getBBox: () => ({ x: 10, y: 20, width: 30, height: 40 }) };

        expect(pngExport.calculateViewBox(svgElement)).toEqual([-40, -30, 130, 140]);
    });

    test("createCanvas prepares canvas size", () => {
        const pngExport = new PngExport();
        const canvas = pngExport.createCanvas(640, 480);

        expect(canvas.width).toBe(640);
        expect(canvas.height).toBe(480);
    });

    test("copyStylesInline clones computed styles to destination children", () => {
        const pngExport = new PngExport();
        const source = document.createElement("div");
        const destination = document.createElement("div");

        const sourceChild = document.createElement("span");
        sourceChild.style.setProperty("color", "rgb(255, 0, 0)");
        source.appendChild(sourceChild);

        const destinationChild = document.createElement("span");
        destination.appendChild(destinationChild);

        const originalGetComputedStyle = window.getComputedStyle;
        window.getComputedStyle = jest.fn(() => ({
            length: 1,
            0: "color",
            getPropertyValue: () => "rgb(255, 0, 0)",
        }));

        pngExport.copyStylesInline(source, destination);

        expect(destinationChild.style.getPropertyValue("color")).toBe("rgb(255, 0, 0)");

        window.getComputedStyle = originalGetComputedStyle;
    });

    test("cloneSvg returns a deep clone of the SVG", async () => {
        const pngExport = new PngExport();
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const child = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svg.appendChild(child);

        const clone = await pngExport.cloneSvg(svg);

        expect(clone).not.toBe(svg);
        expect(clone.childNodes).toHaveLength(svg.childNodes.length);
    });

    test("convertToDataUrl resolves with generated URI", async () => {
        const pngExport = new PngExport();
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        const originalCreateCanvas = pngExport.createCanvas.bind(pngExport);
        pngExport.createCanvas = jest.fn(() => ({
            width: 0,
            height: 0,
            getContext: () => ({
                fillStyle: "",
                fillRect: jest.fn(),
                drawImage: jest.fn(),
            }),
            toDataURL: () => "data:image/png;base64,TEST",
        }));

        const originalURL = window.URL;
        const createObjectURL = jest.fn(() => "blob:mock");
        const revokeObjectURL = jest.fn();
        Object.defineProperty(window, "URL", {
            configurable: true,
            value: { createObjectURL, revokeObjectURL },
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

        const result = await pngExport.convertToDataUrl(svg, 100, 100);

        expect(result).toBe("data:image/octet-stream;base64,TEST");
        expect(createObjectURL).toHaveBeenCalled();

        global.Image = OriginalImage;
        Object.defineProperty(window, "URL", { configurable: true, value: originalURL });
        pngExport.createCanvas = originalCreateCanvas;
    });
});
