import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// The chart library is used as it is. The page script keeps its state in the local storage of
// the document under this key, so a test seeds that key before the page is initialised.
const STORAGE_KEY = "webtrees-fan-chart";

const seedStorage = (values) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
};

const storedValues = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");

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
        <input type="checkbox" id="showDescendants-1" name="showDescendants" value="1"${overrides.descendants ? " checked" : ""}>
        <div id="fan-chart-url"></div>
        ${overrides.noPanelBox ? "" : `<input type="checkbox" id="showDetailPanel-1" name="showDetailPanel" value="1"${overrides.panel ? " checked" : ""}>`}
        ${overrides.placesBox ? '<input type="checkbox" id="showPlaces-1" name="showPlaces" value="1">' : ""}
        <button class="btn-help" aria-expanded="false" aria-controls="fan-chart-help-popover">Help</button>
        <div id="fan-chart-help-popover" class="help-popover d-none" role="region">
            <div data-help-mode="tooltip" id="help-tooltip"></div>
            <div data-help-mode="panel" id="help-panel" class="d-none"></div>
        </div>
    `;

    window.WebtreesFanChart = {};
    window.webtrees = { load: jest.fn() };
}

const defaultConfig = {
    ajaxUrl: "https://example.com/chart",
    defaultShowDescendants: false,
    defaultFanDegreeRaw: 210,
    fanDegreeMin: 180,
    fanDegreeMaxWithDescendants: 270,
    defaultDetailedDateGenerations: 0,
};

function getAjaxUrl() {
    return new URL(document.getElementById("fan-chart-url").getAttribute("data-wt-ajax-url"));
}

beforeEach(() => {
    localStorage.clear();
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

    it("wires the help button to its popover", () => {
        initPage(defaultConfig);

        document.querySelector(".btn-help").click();

        expect(document.getElementById("fan-chart-help-popover").classList.contains("d-none")).toBe(
            false,
        );
        expect(document.querySelector(".btn-help").getAttribute("aria-expanded")).toBe("true");
    });

    it("shows the help entries of the detail panel mode that the chart loads with", () => {
        setupDom({ panel: true });

        initPage(defaultConfig);

        expect(document.getElementById("help-panel").classList.contains("d-none")).toBe(false);
        expect(document.getElementById("help-tooltip").classList.contains("d-none")).toBe(true);
    });

    it("keeps the help entries until the chart is loaded again", () => {
        initPage(defaultConfig);

        const panelBox = document.querySelector('input[name="showDetailPanel"][type="checkbox"]');

        panelBox.checked = true;
        panelBox.dispatchEvent(new Event("change", { bubbles: true }));

        expect(document.getElementById("help-panel").classList.contains("d-none")).toBe(true);
        expect(document.getElementById("help-tooltip").classList.contains("d-none")).toBe(false);
    });

    it("switches the help entries when the descendants switch loads the chart again", () => {
        initPage(defaultConfig);

        const panelBox = document.querySelector('input[name="showDetailPanel"][type="checkbox"]');

        panelBox.checked = true;

        const cb = document.getElementById("showDescendants-1");

        cb.checked = true;
        cb.dispatchEvent(new Event("change"));

        expect(document.getElementById("help-panel").classList.contains("d-none")).toBe(false);
        expect(document.getElementById("help-tooltip").classList.contains("d-none")).toBe(true);
    });

    it("includes showPlaces=0 when storage has showPlaces=false", () => {
        seedStorage({ showPlaces: false });

        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.get("showPlaces")).toBe("0");
    });

    it("uses defaultDetailedDateGenerations for the initial URL, ignoring a stale storage value", () => {
        // A value left in localStorage by an older module version (which had a
        // slider) must not override the admin preference on the initial render.
        seedStorage({ detailedDateGenerations: "0" });

        initPage({ ...defaultConfig, defaultDetailedDateGenerations: 3 });

        expect(getAjaxUrl().searchParams.get("detailedDateGenerations")).toBe("3");
    });

    it("sets showDescendants=1 when enabled via config default", () => {
        // The server renders the checkbox ticked for the default
        setupDom({ descendants: true });

        initPage({ ...defaultConfig, defaultShowDescendants: true });

        expect(getAjaxUrl().searchParams.get("showDescendants")).toBe("1");
    });

    it("deletes showDescendants param when disabled", () => {
        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.has("showDescendants")).toBe(false);
    });
});

describe("detail panel switch (via initPage AJAX URL)", () => {
    it("omits showDetailPanel while the page has no such checkbox", () => {
        setupDom({ noPanelBox: true });

        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.has("showDetailPanel")).toBe(false);
    });

    it("sends showDetailPanel=0 for a checkbox that is not ticked on the first visit", () => {
        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.get("showDetailPanel")).toBe("0");
    });

    it("sends showDetailPanel=1 for the stored state of the checkbox", () => {
        seedStorage({ showDetailPanel: true });

        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.get("showDetailPanel")).toBe("1");
    });

    it("sends showDetailPanel=0 when the stored state switches the panel off", () => {
        seedStorage({ showDetailPanel: false });

        initPage(defaultConfig);

        expect(getAjaxUrl().searchParams.get("showDetailPanel")).toBe("0");
    });

    it("stores the state of the checkbox in the browser storage when it is changed", () => {
        initPage(defaultConfig);

        const panelBox = document.querySelector('input[name="showDetailPanel"][type="checkbox"]');

        panelBox.checked = true;
        panelBox.dispatchEvent(new Event("input", { bubbles: true }));

        expect(storedValues().showDetailPanel).toBe(true);
    });

    it("does not publish the switch in the chartOptions of the page", () => {
        seedStorage({ showDetailPanel: true });

        initPage(defaultConfig);

        expect(window.WebtreesFanChart.chartOptions).not.toHaveProperty("showDetailPanel");
    });

    it("keeps the stored state of the switch when the descendants are toggled", () => {
        seedStorage({ showDetailPanel: true });

        initPage(defaultConfig);

        document.getElementById("showDescendants-1").checked = true;
        document.getElementById("showDescendants-1").dispatchEvent(new Event("change"));

        const reloaded = new URL(window.webtrees.load.mock.calls[0][1]);

        expect(reloaded.searchParams.get("showDetailPanel")).toBe("1");
    });
});

describe("showDescendants change handler", () => {
    it("reads showPlaces live from storage on each toggle (not stale capture)", () => {
        setupDom({ placesBox: true });

        initPage(defaultConfig);

        // The user ticks showPlaces after initPage ran
        const placesBox = document.getElementById("showPlaces-1");

        placesBox.checked = true;
        placesBox.dispatchEvent(new Event("input", { bubbles: true }));

        const cb = document.getElementById("showDescendants-1");

        cb.checked = true;
        cb.dispatchEvent(new Event("change"));

        expect(getAjaxUrl().searchParams.get("showPlaces")).toBe("1");
    });

    it("keeps the admin default detailedDateGenerations on toggle, ignoring a stale storage value", () => {
        // A value left in localStorage by an older module version, which must be ignored
        seedStorage({ detailedDateGenerations: "5" });

        initPage({ ...defaultConfig, defaultDetailedDateGenerations: 2 });

        const cb = document.getElementById("showDescendants-1");

        cb.checked = true;
        cb.dispatchEvent(new Event("change"));

        expect(getAjaxUrl().searchParams.get("detailedDateGenerations")).toBe("2");
    });

    it("restores fanDegreeRaw when unchecking descendants", () => {
        seedStorage({ fanDegreeRaw: "320" });

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
        seedStorage({ fanDegree: "340", showDescendants: true });
        setupDom({ fanDegree: "340" });

        initPage({ ...defaultConfig, defaultShowDescendants: true });

        expect(Number(window.WebtreesFanChart.chartOptions.fanDegree)).toBe(270);
    });

    it("takes the clamp bounds for descendants from the page configuration", () => {
        seedStorage({ fanDegree: "340", showDescendants: true });
        setupDom({ fanDegree: "340" });

        initPage({
            ...defaultConfig,
            defaultShowDescendants: true,
            fanDegreeMin: 100,
            fanDegreeMaxWithDescendants: 200,
        });

        expect(window.WebtreesFanChart.chartOptions.fanDegree).toBe(200);
        expect(document.getElementById("fanDegree").max).toBe("200");
    });

    it("raises a fanDegree to the lower bound of the page configuration", () => {
        seedStorage({ fanDegree: "200", showDescendants: true });
        setupDom({ fanDegree: "200" });

        initPage({
            ...defaultConfig,
            defaultShowDescendants: true,
            fanDegreeMin: 220,
            fanDegreeMaxWithDescendants: 250,
        });

        expect(window.WebtreesFanChart.chartOptions.fanDegree).toBe(220);
    });

    it("raises a fanDegree below the lower bound when descendants are enabled", () => {
        seedStorage({ fanDegree: "90", showDescendants: true });
        setupDom({ fanDegree: "90" });

        initPage({ ...defaultConfig, defaultShowDescendants: true });

        expect(window.WebtreesFanChart.chartOptions.fanDegree).toBe(180);
        expect(document.getElementById("fanDegreeOutput").value).toBe("180°");
    });
});
