/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import {
    buildChartAjaxUrl,
    setChartAjaxUrl,
    setChartOptionsGlobal,
    Storage,
    syncCollapseToggle,
} from "@magicsunday/webtrees-chart-lib/chart-core";

/**
 * Restores a range slider and its output display from localStorage.
 *
 * @param {Storage} storage The storage instance
 * @param {string}  id      The element ID of the range input
 * @param {string}  suffix  Suffix for the output display (e.g. "°", "%")
 */
function initRangeSlider(storage, id, suffix = "") {
    const stored = storage.read(id);

    if (stored !== null) {
        const input = /** @type {HTMLInputElement|null} */ (document.getElementById(id));
        const output = /** @type {HTMLOutputElement|null} */ (
            document.getElementById(`${id}Output`)
        );

        if (input) {
            input.value = String(stored);
        }
        if (output) {
            output.value = stored + suffix;
        }
    }
}

/**
 * Initialises the fan chart page: restores form values from localStorage,
 * sets up event listeners for interactive form elements, builds the initial
 * AJAX URL, and triggers the first chart data load.
 *
 * @param {object}  config
 * @param {string}  config.ajaxUrl                        The base AJAX endpoint URL
 * @param {boolean} config.defaultShowDescendants         Server-side default for showDescendants
 * @param {boolean} [config.defaultShowNicknames]         Server-side default for showNicknames
 * @param {number}  config.defaultFanDegreeRaw            Server-side unclamped fan degree
 * @param {number}  config.defaultDetailedDateGenerations Server-side default for detailed date generations
 */
export function initPage(config) {
    const storage = new Storage("webtrees-fan-chart");

    // Register all form elements for localStorage persistence
    storage.register("fanDegree");
    storage.register("generations");
    storage.register("hideEmptySegments");
    storage.register("showFamilyColors");
    storage.register("paternalColor");
    storage.register("maternalColor");
    storage.register("showPlaces");
    storage.register("placeParts");
    storage.register("showParentMarriageDates");
    storage.register("showImages");
    storage.register("showNames");
    storage.register("showNicknames");
    storage.register("innerArcs");
    storage.register("fontScale");
    storage.register("detailedDateGenerations");
    storage.register("showDescendants");

    // Restore collapse state and range sliders
    syncCollapseToggle(storage);

    initRangeSlider(storage, "fanDegree", "°");
    initRangeSlider(storage, "generations");
    initRangeSlider(storage, "fontScale", "%");
    initRangeSlider(storage, "innerArcs");

    // Restore displayMode radio from storage and sync showNames/showImages on change
    const storedDisplayMode = storage.read("displayMode");

    if (storedDisplayMode) {
        const radioToCheck = /** @type {HTMLInputElement|null} */ (
            document.getElementById(`displayMode-${storedDisplayMode}`)
        );

        if (radioToCheck) {
            radioToCheck.checked = true;
        }
    }

    document.querySelectorAll('input[name="displayMode"]').forEach((radioEl) => {
        const radio = /** @type {HTMLInputElement} */ (radioEl);
        radio.addEventListener("input", () => {
            storage.write("displayMode", radio.value);
            storage.write("showNames", radio.value === "both" || radio.value === "names");
            storage.write("showImages", radio.value === "both" || radio.value === "images");
        });
    });

    // Keep fanDegreeRaw in sync with the slider so disabling descendants
    // restores the last user-chosen value (not a stale one from earlier)
    const fanSliderElement = /** @type {HTMLInputElement|null} */ (
        document.getElementById("fanDegree")
    );

    if (fanSliderElement) {
        fanSliderElement.addEventListener("input", () => {
            storage.write("fanDegreeRaw", fanSliderElement.value);
        });
    }

    // Expose chart configuration values under the WebtreesFanChart namespace
    // so chart.phtml getters can read the user's localStorage overrides
    // instead of falling back to server-side defaults only.
    const displayMode = storage.read("displayMode");

    /**
     * Resolved user options. `null` here means "user has not overridden the
     * server default"; chart.phtml falls back to the PHP-side value via `??`.
     * `showDescendants` and `detailedDateGenerations` are pre-resolved with
     * their server defaults because subsequent code in this function reads
     * them unconditionally.
     *
     * @type {{
     *   fanDegree: number|null,
     *   generations: number|null,
     *   hideEmptySegments: boolean|null,
     *   showFamilyColors: boolean|null,
     *   paternalColor: string|null,
     *   maternalColor: string|null,
     *   showPlaces: boolean|null,
     *   showParentMarriageDates: boolean|null,
     *   showImages: boolean|null,
     *   showNames: boolean|null,
     *   showNicknames: boolean|null,
     *   innerArcs: number|null,
     *   fontScale: number|null,
     *   showDescendants: boolean,
     *   detailedDateGenerations: number,
     * }}
     */
    const chartOptions = {
        fanDegree: storage.readNumber("fanDegree"),
        generations: storage.readNumber("generations"),
        hideEmptySegments: storage.readBool("hideEmptySegments"),
        showFamilyColors: storage.readBool("showFamilyColors"),
        paternalColor: storage.readString("paternalColor"),
        maternalColor: storage.readString("maternalColor"),
        showPlaces: storage.readBool("showPlaces"),
        showParentMarriageDates: storage.readBool("showParentMarriageDates"),
        showImages: displayMode
            ? displayMode === "both" || displayMode === "images"
            : storage.readBool("showImages"),
        showNames: displayMode
            ? displayMode === "both" || displayMode === "names"
            : storage.readBool("showNames"),
        showNicknames: storage.readBool("showNicknames", config.defaultShowNicknames ?? null),
        innerArcs: storage.readNumber("innerArcs"),
        fontScale: storage.readNumber("fontScale"),
        showDescendants: storage.readBool("showDescendants", config.defaultShowDescendants),
        detailedDateGenerations: storage.readNumber(
            "detailedDateGenerations",
            config.defaultDetailedDateGenerations,
        ),
    };

    // Clamp the fan degree slider when descendants are active (covers the case
    // where the page is loaded from storage with showDescendants already enabled)
    if (chartOptions.showDescendants) {
        const fanSlider = /** @type {HTMLInputElement|null} */ (
            document.getElementById("fanDegree")
        );
        const fanOutput = /** @type {HTMLOutputElement|null} */ (
            document.getElementById("fanDegreeOutput")
        );

        if (fanSlider) {
            // Save the unclamped value BEFORE clamping so it can be restored
            // when descendants are disabled later. This ensures fanDegreeRaw
            // always reflects the actual fan degree, not a stale value from
            // a previous session with a different degree.
            storage.write("fanDegreeRaw", fanSlider.value);

            fanSlider.max = "270";
            chartOptions.fanDegree = Math.min(270, Math.max(180, Number(fanSlider.value)));
            fanSlider.value = String(chartOptions.fanDegree);

            if (fanOutput) {
                fanOutput.value = `${chartOptions.fanDegree}°`;
            }
        }
    }

    // Attach to the UMD global so chart.phtml getters can read the user's
    // localStorage overrides instead of falling back to server-side defaults.
    // Written after the clamp block so fanDegree is consistent with the slider.
    // WebtreesFanChart is the UMD global exposed by the chart-page bundle;
    // chart.phtml reads chartOptions from it.
    setChartOptionsGlobal("WebtreesFanChart", chartOptions);

    const ajaxUrl = buildChartAjaxUrl(config.ajaxUrl, {
        query: [
            {
                key: "generations",
                value:
                    storage.read("generations") ??
                    /** @type {HTMLInputElement|null} */ (document.getElementById("generations"))
                        ?.value ??
                    null,
            },
            { key: "detailedDateGenerations", value: chartOptions.detailedDateGenerations },
            { key: "showPlaces", value: chartOptions.showPlaces, mode: "boolean-1-0" },
            { key: "placeParts", value: storage.read("placeParts") },
            {
                key: "showDescendants",
                value: Boolean(chartOptions.showDescendants),
                mode: "boolean-1-or-delete",
            },
            { key: "showNicknames", value: chartOptions.showNicknames, mode: "boolean-1-0" },
        ],
    });
    setChartAjaxUrl("fan-chart-url", ajaxUrl);

    // showDescendants checkbox: persist to storage, restore raw fan degree, AJAX reload.
    // The slider max/value clamping is handled by the shared script in display.phtml
    // which fires first (registered earlier in DOM order, so the slider value is
    // already clamped when this handler reads it).
    const showDescendantsCheckbox = /** @type {HTMLInputElement|null} */ (
        document.getElementById("showDescendants-1")
    );

    if (showDescendantsCheckbox) {
        showDescendantsCheckbox.addEventListener("change", () => {
            const checked = showDescendantsCheckbox.checked;
            const fanSlider = /** @type {HTMLInputElement|null} */ (
                document.getElementById("fanDegree")
            );
            const fanOutput = /** @type {HTMLOutputElement|null} */ (
                document.getElementById("fanDegreeOutput")
            );

            storage.write("showDescendants", checked);

            if (!checked) {
                const raw = storage.read("fanDegreeRaw");

                if (raw !== null && fanSlider) {
                    fanSlider.value = String(raw);

                    if (fanOutput) {
                        fanOutput.value = `${raw}°`;
                    }
                }
            }

            storage.write("fanDegree", fanSlider ? fanSlider.value : null);

            const container = document.getElementById("fan-chart-url");
            const newUrl = buildChartAjaxUrl(config.ajaxUrl, {
                query: [
                    {
                        key: "generations",
                        value:
                            storage.read("generations") ??
                            /** @type {HTMLInputElement|null} */ (
                                document.getElementById("generations")
                            )?.value ??
                            null,
                    },
                    {
                        key: "detailedDateGenerations",
                        value:
                            storage.read("detailedDateGenerations") ??
                            config.defaultDetailedDateGenerations,
                    },
                    { key: "showPlaces", value: storage.read("showPlaces"), mode: "boolean-1-0" },
                    { key: "placeParts", value: storage.read("placeParts") },
                    { key: "showDescendants", value: checked, mode: "boolean-1-or-delete" },
                    {
                        key: "showNicknames",
                        value: storage.read("showNicknames") ?? config.defaultShowNicknames,
                        mode: "boolean-1-0",
                    },
                ],
            });

            setChartAjaxUrl("fan-chart-url", newUrl);
            // window.webtrees is injected by the host page (webtrees core), not
            // declared in our types. Reach for it via an opaque widening cast.
            /** @type {{webtrees: {load: (el: HTMLElement|null, url: string) => void}}} */ (
                /** @type {unknown} */ (window)
            ).webtrees.load(container, newUrl);
        });
    }
}
