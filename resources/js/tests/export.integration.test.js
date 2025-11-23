/** @jest-environment node */

import { jest } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOLDENS_DIR = path.join(__dirname, "__goldens__");
const PNG_GOLDEN = path.join(GOLDENS_DIR, "fan-chart.png");
const SVG_GOLDEN = path.join(GOLDENS_DIR, "fan-chart.svg");
const FIXTURE = path.join(__dirname, "fixtures", "fan-chart-export.html");
// Allow minor rendering differences across Chromium builds while keeping goldens stable.
const MAX_DIFF_RATIO = 0.07;
const CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ?? process.env.CHROMIUM_EXECUTABLE_PATH;
const VIEWBOX_TOLERANCE = 50;
const ELEMENT_COUNT_TOLERANCE = 5;

const ensureDownloadCapture = async (page) => page.evaluate(() => {
    window.__downloads = [];

    const originalCreateElement = document.createElement.bind(document);

    document.createElement = (tagName, options) => {
        const element = originalCreateElement(tagName, options);

        if (tagName.toLowerCase() === "a") {
            const originalDispatch = element.dispatchEvent.bind(element);

            element.dispatchEvent = (event) => {
                window.__downloads.push({
                    href: element.getAttribute("href"),
                    filename: element.getAttribute("download"),
                });

                return originalDispatch(event);
            };
        }

        return element;
    };
});

const collectDownloads = async (page) => page.evaluate(async () => Promise.all(
    window.__downloads.map(async (download) => {
        if (download.href && download.href.startsWith("blob:")) {
            const response = await fetch(download.href);

            return {
                ...download,
                content: await response.text(),
            };
        }

        return {
            ...download,
            content: download.href,
        };
    })
));

const comparePng = (actualBuffer, goldenPath) => {
    const actual = PNG.sync.read(actualBuffer);
    const expected = PNG.sync.read(fs.readFileSync(goldenPath));

    expect(actual.width).toBe(expected.width);
    expect(actual.height).toBe(expected.height);

    const diffPixels = pixelmatch(
        actual.data,
        expected.data,
        null,
        expected.width,
        expected.height,
        { threshold: 0.1 }
    );

    const diffRatio = diffPixels / (expected.width * expected.height);

    expect(diffRatio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
};

const extractViewBox = (svgContent) => {
    const match = svgContent.match(/viewBox="([^"]+)"/);

    if (!match) {
        throw new Error("SVG export does not contain a viewBox attribute");
    }

    return match[1].split(/[,\s]+/).map(Number);
};

const assertViewBoxWithinTolerance = (svgContent, expectedSvg) => {
    const expectedViewBox = extractViewBox(expectedSvg);
    const actualViewBox = extractViewBox(svgContent);

    actualViewBox.forEach((value, index) => {
        expect(Math.abs(value - expectedViewBox[index])).toBeLessThanOrEqual(VIEWBOX_TOLERANCE);
    });
};

const countElements = (svgContent, tagName) => (svgContent.match(new RegExp(`<${tagName}\\b`, "g")) ?? []).length;

const extractTextNodes = (svgContent) => [...svgContent.matchAll(/>([^<>]+)</g)]
    .map(([, textContent]) => textContent.trim())
    .filter(Boolean);

const writeGoldens = (pngBuffer, svgContent) => {
    fs.mkdirSync(GOLDENS_DIR, { recursive: true });
    fs.writeFileSync(PNG_GOLDEN, pngBuffer);
    fs.writeFileSync(SVG_GOLDEN, svgContent.trim());
};

describe("fan chart export regressions", () => {
    jest.setTimeout(60000);

    it("matches the exported PNG and SVG goldens", async () => {
        const browser = await chromium.launch({
            executablePath: CHROMIUM_EXECUTABLE,
            headless: true,
        });
        const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

        try {
            await page.goto(`file://${FIXTURE}`);
            await page.waitForSelector(".webtrees-fan-chart-container svg");
            await ensureDownloadCapture(page);
            await page.waitForTimeout(250);

            await page.click("#exportPNG");
            await page.click("#exportSVG");

            const downloads = await collectDownloads(page);

            const pngDownload = downloads.find((file) => file.filename === "fan-chart.png");
            const svgDownload = downloads.find((file) => file.filename === "fan-chart.svg");

            expect(pngDownload?.content).toBeDefined();
            expect(svgDownload?.content).toBeDefined();

            if (!pngDownload?.content || !svgDownload?.content) {
                throw new Error("Export downloads were not captured from the fixture page");
            }

            const pngBuffer = Buffer.from(pngDownload.content.split(",")[1], "base64");
            const svgContent = svgDownload.content;

            if (process.env.UPDATE_GOLDENS) {
                writeGoldens(pngBuffer, svgContent);
                return;
            }

            expect(fs.existsSync(PNG_GOLDEN)).toBe(true);
            expect(fs.existsSync(SVG_GOLDEN)).toBe(true);

            comparePng(pngBuffer, PNG_GOLDEN);

            const expectedSvg = fs.readFileSync(SVG_GOLDEN, "utf8").trim();

            assertViewBoxWithinTolerance(svgContent, expectedSvg);
            expect(Math.abs(countElements(svgContent, "path") - countElements(expectedSvg, "path")))
                .toBeLessThanOrEqual(ELEMENT_COUNT_TOLERANCE);
            expect(Math.abs(countElements(svgContent, "text") - countElements(expectedSvg, "text")))
                .toBeLessThanOrEqual(ELEMENT_COUNT_TOLERANCE);

            const expectedTexts = extractTextNodes(expectedSvg);
            expectedTexts.forEach((textContent) => {
                expect(svgContent).toContain(textContent);
            });
        } finally {
            await browser.close();
        }
    });
});
