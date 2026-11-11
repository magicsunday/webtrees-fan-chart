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

/**
 * Reads the AJAX URL that the page has set after the descendants switch ran, which is the URL of
 * the reload path. The initial URL is read with getAjaxUrl() before the switch is used.
 */
function reloadAjaxUrl(checked = false) {
    const checkbox = document.getElementById("showDescendants-1");

    checkbox.checked = checked;
    checkbox.dispatchEvent(new Event("change"));

    return getAjaxUrl();
}

describe("AJAX URL parameters on the initial path and the reload path", () => {
    const paths = [
        ["initial URL", (config) => (initPage(config), getAjaxUrl())],
        ["reload URL", (config) => (initPage(config), reloadAjaxUrl())],
    ];

    describe.each(paths)("%s", (_name, buildUrl) => {
        it("sends showNicknames=1 for a stored true", () => {
            seedStorage({ showNicknames: true });

            expect(buildUrl(defaultConfig).searchParams.get("showNicknames")).toBe("1");
        });

        it("sends showNicknames=0 for a stored false", () => {
            seedStorage({ showNicknames: false });

            expect(
                buildUrl({ ...defaultConfig, defaultShowNicknames: true }).searchParams.get(
                    "showNicknames",
                ),
            ).toBe("0");
        });

        it("takes showNicknames from the page default while the storage has none", () => {
            expect(
                buildUrl({ ...defaultConfig, defaultShowNicknames: true }).searchParams.get(
                    "showNicknames",
                ),
            ).toBe("1");
        });

        it("omits showNicknames while neither the storage nor the page has a value", () => {
            expect(buildUrl(defaultConfig).searchParams.has("showNicknames")).toBe(false);
        });

        it("sends the stored generations", () => {
            seedStorage({ generations: "8" });

            expect(buildUrl(defaultConfig).searchParams.get("generations")).toBe("8");
        });

        it("falls back to the generations slider while the storage has none", () => {
            setupDom({ generations: "7" });

            expect(buildUrl(defaultConfig).searchParams.get("generations")).toBe("7");
        });

        it("sends showPlaces=1 for a stored true", () => {
            seedStorage({ showPlaces: true });

            expect(buildUrl(defaultConfig).searchParams.get("showPlaces")).toBe("1");
        });

        it("sends showPlaces=0 for a stored false", () => {
            seedStorage({ showPlaces: false });

            expect(buildUrl(defaultConfig).searchParams.get("showPlaces")).toBe("0");
        });

        it("sends showDetailPanel=1 for a stored true", () => {
            seedStorage({ showDetailPanel: true });

            expect(buildUrl(defaultConfig).searchParams.get("showDetailPanel")).toBe("1");
        });

        it("sends the admin default detailedDateGenerations", () => {
            seedStorage({ detailedDateGenerations: "5" });

            expect(
                buildUrl({ ...defaultConfig, defaultDetailedDateGenerations: 3 }).searchParams.get(
                    "detailedDateGenerations",
                ),
            ).toBe("3");
        });
    });

    it("sends showDescendants=1 on the initial URL when the page default is on", () => {
        // The server renders the checkbox ticked for the default
        setupDom({ descendants: true });
        initPage({ ...defaultConfig, defaultShowDescendants: true });

        expect(getAjaxUrl().searchParams.get("showDescendants")).toBe("1");
    });

    it("sends showDescendants=1 on the reload URL when the switch is ticked", () => {
        initPage(defaultConfig);

        expect(reloadAjaxUrl(true).searchParams.get("showDescendants")).toBe("1");
    });

    it("leaves showDescendants out of the reload URL when the switch is cleared", () => {
        setupDom({ descendants: true });
        initPage({ ...defaultConfig, defaultShowDescendants: true });

        expect(reloadAjaxUrl(false).searchParams.has("showDescendants")).toBe(false);
    });
});

describe("display mode and fan degree handling", () => {
    const addDisplayModes = () => {
        document.body.insertAdjacentHTML(
            "beforeend",
            ["both", "names", "images"]
                .map(
                    (mode) =>
                        `<input type="radio" name="displayMode" id="displayMode-${mode}" value="${mode}">`,
                )
                .join(""),
        );
    };

    it("restores the stored display mode into its radio button", () => {
        addDisplayModes();
        seedStorage({ displayMode: "images" });

        initPage(defaultConfig);

        expect(document.getElementById("displayMode-images").checked).toBe(true);
        expect(document.getElementById("displayMode-names").checked).toBe(false);
    });

    it.each([
        ["both", true, true],
        ["names", true, false],
        ["images", false, true],
    ])("syncs showNames and showImages for the display mode %s", (mode, names, images) => {
        addDisplayModes();
        initPage(defaultConfig);

        const radio = document.getElementById(`displayMode-${mode}`);

        radio.checked = true;
        radio.dispatchEvent(new Event("input", { bubbles: true }));

        expect(storedValues()).toMatchObject({
            displayMode: mode,
            showNames: names,
            showImages: images,
        });
    });

    it("derives the published showNames and showImages from the stored display mode", () => {
        addDisplayModes();
        seedStorage({ displayMode: "names", showNames: false, showImages: true });

        initPage(defaultConfig);

        expect(window.WebtreesFanChart.chartOptions ?? window.WebtreesFanChart).toMatchObject({
            showNames: true,
            showImages: false,
        });
    });

    it("keeps the raw fan degree in step with the slider", () => {
        initPage(defaultConfig);

        const slider = document.getElementById("fanDegree");

        slider.value = "300";
        slider.dispatchEvent(new Event("input", { bubbles: true }));

        expect(storedValues().fanDegreeRaw).toBe("300");
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
