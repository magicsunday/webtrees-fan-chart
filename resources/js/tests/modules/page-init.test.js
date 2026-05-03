import { jest, describe, it, expect, beforeEach } from "@jest/globals";

let storageInstances = [];
let storageData = {};

await jest.unstable_mockModule("@magicsunday/webtrees-chart-lib", () => ({
    Storage: jest.fn().mockImplementation(() => {
        const read = (key) =>
            Object.prototype.hasOwnProperty.call(storageData, key) ? storageData[key] : null;

        const instance = {
            register: jest.fn(),
            read: jest.fn(read),
            readString: jest.fn((key, fallback = null) => {
                const value = read(key);
                return value === null ? fallback : String(value);
            }),
            readBool: jest.fn((key, fallback = null) => {
                const value = read(key);
                if (value === null) return fallback;
                if (typeof value === "boolean") return value;
                if (typeof value === "number") return value !== 0;
                if (value === "true" || value === "1") return true;
                if (value === "false" || value === "0") return false;
                return Boolean(value);
            }),
            readNumber: jest.fn((key, fallback = null) => {
                const value = read(key);
                if (value === null) return fallback;
                if (typeof value === "number") {
                    return Number.isFinite(value) ? value : fallback;
                }
                const parsed = Number(value);
                return Number.isFinite(parsed) ? parsed : fallback;
            }),
            write: jest.fn((key, value) => {
                storageData[key] = value;
            }),
        };

        storageInstances.push(instance);

        return instance;
    }),
}));

const { initPage } = await import("resources/js/modules/page-init.js");

function setupDom(overrides = {}) {
    document.body.innerHTML = `
        <div id="showMoreOptions" class="collapse"></div>
        <button id="options"><span>Show</span><span class="d-none">Hide</span></button>
        <input id="xref" value="${overrides.xref || "X1"}">
        <input id="fanDegree" type="range" min="180" max="360" value="${overrides.fanDegree || "210"}">
        <output id="fanDegreeOutput">${overrides.fanDegree || "210"}°</output>
        <input id="generations" type="range" min="2" max="10" value="${overrides.generations || "6"}">
        <output id="generationsOutput">${overrides.generations || "6"}</output>
        <input id="fontScale" type="range" min="50" max="150" value="100">
        <output id="fontScaleOutput">100%</output>
        <input id="innerArcs" type="range" min="0" max="5" value="3">
        <output id="innerArcsOutput">3</output>
        <input type="hidden" name="showDescendants" value="0">
        <input type="checkbox" id="showDescendants-1" name="showDescendants" value="1">
        <div id="fan-chart-url"></div>
    `;

    window.WebtreesFanChart = {};
    window.webtrees = { load: jest.fn() };
}

const defaultConfig = {
    ajaxUrl: "https://example.com/chart",
    defaultShowDescendants: false,
    defaultFanDegreeRaw: 210,
    defaultDetailedDateGenerations: 0,
};

function getAjaxUrl() {
    return new URL(document.getElementById("fan-chart-url").getAttribute("data-wt-ajax-url"));
}

beforeEach(() => {
    storageData = {};
    storageInstances = [];
    setupDom();
});

describe("getUrl (via initPage AJAX URL)", () => {
    it("builds a valid URL with xref and generations", () => {
        initPage(defaultConfig);

        const url = getAjaxUrl();

        expect(url.searchParams.get("xref")).toBe("X1");
        expect(url.searchParams.get("generations")).not.toBeNull();
    });

    it("omits showPlaces param when storage value is null", () => {
        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.has("showPlaces")).toBe(false);
    });

    it("includes showPlaces=0 when storage has showPlaces=false", () => {
        storageData.showPlaces = false;

        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.get("showPlaces")).toBe("0");
    });

    it("includes placeParts in URL when storage has a value", () => {
        storageData.placeParts = "2";

        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.get("placeParts")).toBe("2");
    });

    it("uses defaultDetailedDateGenerations when storage is empty", () => {
        initPage({ ...defaultConfig, defaultDetailedDateGenerations: 3 });

        expect(getAjaxUrl().searchParams.get("detailedDateGenerations")).toBe("3");
    });

    it("sets showDescendants=1 when enabled via config default", () => {
        initPage({ ...defaultConfig, defaultShowDescendants: true });

        expect(getAjaxUrl().searchParams.get("showDescendants")).toBe("1");
    });

    it("deletes showDescendants param when disabled", () => {
        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.has("showDescendants")).toBe(false);
    });
});

describe("showDescendants change handler", () => {
    it("reads showPlaces live from storage on each toggle (not stale capture)", () => {
        initPage(defaultConfig);

        const storage = storageInstances[0];

        // Simulate user changing showPlaces after initPage ran
        storage.read.mockImplementation((key) => {
            if (key === "showPlaces") return true;
            if (key === "generations") return "6";
            if (key === "placeParts") return "1";
            if (key === "detailedDateGenerations") return "3";

            return null;
        });

        const cb = document.getElementById("showDescendants-1");

        cb.checked = true;
        cb.dispatchEvent(new Event("change"));

        expect(getAjaxUrl().searchParams.get("showPlaces")).toBe("1");
    });

    it("reads detailedDateGenerations live from storage on toggle", () => {
        initPage(defaultConfig);

        const storage = storageInstances[0];

        storage.read.mockImplementation((key) => {
            if (key === "detailedDateGenerations") return "5";
            if (key === "generations") return "6";

            return null;
        });

        const cb = document.getElementById("showDescendants-1");

        cb.checked = true;
        cb.dispatchEvent(new Event("change"));

        expect(getAjaxUrl().searchParams.get("detailedDateGenerations")).toBe("5");
    });

    it("includes placeParts from storage in rebuilt URL", () => {
        initPage(defaultConfig);

        const storage = storageInstances[0];

        storage.read.mockImplementation((key) => {
            if (key === "placeParts") return "3";
            if (key === "generations") return "6";

            return null;
        });

        const cb = document.getElementById("showDescendants-1");

        cb.checked = true;
        cb.dispatchEvent(new Event("change"));

        expect(getAjaxUrl().searchParams.get("placeParts")).toBe("3");
    });

    it("restores fanDegreeRaw when unchecking descendants", () => {
        storageData.fanDegreeRaw = "320";

        initPage(defaultConfig);

        const slider = document.getElementById("fanDegree");
        const output = document.getElementById("fanDegreeOutput");

        // First enable descendants
        const cb = document.getElementById("showDescendants-1");

        cb.checked = true;
        cb.dispatchEvent(new Event("change"));

        // Then disable — should restore raw value
        cb.checked = false;
        cb.dispatchEvent(new Event("change"));

        expect(slider.value).toBe("320");
        expect(output.value).toBe("320°");
    });

    it("triggers webtrees.load on toggle", () => {
        initPage(defaultConfig);

        const cb = document.getElementById("showDescendants-1");

        cb.checked = true;
        cb.dispatchEvent(new Event("change"));

        expect(window.webtrees.load).toHaveBeenCalled();
    });
});

describe("chartOptions namespace", () => {
    it("attaches chartOptions to WebtreesFanChart global", () => {
        initPage(defaultConfig);

        expect(window.WebtreesFanChart.chartOptions).toBeDefined();
        expect(window.WebtreesFanChart.chartOptions.showDescendants).toBe(false);
    });

    it("clamps fanDegree in chartOptions when descendants enabled", () => {
        storageData.fanDegree = "340";
        storageData.showDescendants = true;
        setupDom({ fanDegree: "340" });

        initPage({ ...defaultConfig, defaultShowDescendants: true });

        expect(Number(window.WebtreesFanChart.chartOptions.fanDegree)).toBe(270);
    });

    it("does not register fanDegreeRaw as a DOM element", () => {
        initPage(defaultConfig);

        const storage = storageInstances[0];
        const registeredNames = storage.register.mock.calls.map((call) => call[0]);

        expect(registeredNames).not.toContain("fanDegreeRaw");
    });
});
