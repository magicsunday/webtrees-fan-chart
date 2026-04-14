/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

import { Storage } from "../lib/storage.js";

/**
 * Builds the AJAX URL for fetching chart data from the current form state.
 *
 * @param {string}              baseUrl              The base AJAX endpoint URL
 * @param {string|null}         generations          Number of ancestor generations to display
 * @param {string|number|null}  detailedDateGenerations Number of generations showing full dates
 * @param {string|boolean|null} showPlaces           Whether to display places in the arcs
 * @param {string|null}         placeParts           Number of place hierarchy levels to show
 * @param {boolean}             showDescendantsParam Whether to include descendants in the response
 *
 * @returns {string}
 */
function getUrl(baseUrl, generations, detailedDateGenerations, showPlaces, placeParts, showDescendantsParam) {
    const url = new URL(baseUrl);
    url.searchParams.set("xref", document.getElementById("xref").value);
    url.searchParams.set("generations", generations);
    url.searchParams.set("detailedDateGenerations", detailedDateGenerations);

    if (showPlaces !== null && showPlaces !== undefined) {
        url.searchParams.set("showPlaces", showPlaces ? "1" : "0");
    }

    if (placeParts !== null && placeParts !== undefined) {
        url.searchParams.set("placeParts", placeParts);
    }

    if (showDescendantsParam) {
        url.searchParams.set("showDescendants", "1");
    } else {
        url.searchParams.delete("showDescendants");
    }

    return url.toString();
}

/**
 * Restores the "Show more options" collapse state from localStorage and
 * toggles the button label text on each click.
 *
 * @param {Storage} storage The storage instance for reading/writing collapse state
 */
function toggleMoreOptions(storage) {
    const showMoreOptions = document.getElementById("showMoreOptions");
    const optionsToggle = document.getElementById("options");

    showMoreOptions.addEventListener("shown.bs.collapse", () => {
        storage.write("showMoreOptions", true);
    });

    showMoreOptions.addEventListener("hidden.bs.collapse", () => {
        storage.write("showMoreOptions", false);
    });

    optionsToggle.addEventListener("click", () => {
        Array.from(optionsToggle.children).forEach((element) => {
            element.classList.toggle("d-none");
        });
    });

    if (storage.read("showMoreOptions")) {
        optionsToggle.click();
    }
}

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
        const input = document.getElementById(id);
        const output = document.getElementById(`${id}Output`);

        input.value = stored;
        output.value = stored + suffix;
    }
}

/**
 * Initialises the fan chart page: restores form values from localStorage,
 * sets up event listeners for interactive form elements, builds the initial
 * AJAX URL, and triggers the first chart data load.
 *
 * @param {Object}  config
 * @param {string}  config.ajaxUrl                        The base AJAX endpoint URL
 * @param {boolean} config.defaultShowDescendants         Server-side default for showDescendants
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
    storage.register("innerArcs");
    storage.register("fontScale");
    storage.register("detailedDateGenerations");
    storage.register("showDescendants");

    // Restore collapse state and range sliders
    toggleMoreOptions(storage);

    initRangeSlider(storage, "fanDegree", "°");
    initRangeSlider(storage, "generations");
    initRangeSlider(storage, "fontScale", "%");
    initRangeSlider(storage, "innerArcs");

    // Restore displayMode radio from storage and sync showNames/showImages on change
    const storedDisplayMode = storage.read("displayMode");

    if (storedDisplayMode) {
        const radioToCheck = document.getElementById(`displayMode-${storedDisplayMode}`);

        if (radioToCheck) {
            radioToCheck.checked = true;
        }
    }

    document.querySelectorAll('input[name="displayMode"]').forEach((radio) => {
        radio.addEventListener("input", () => {
            storage.write("displayMode", radio.value);
            storage.write("showNames", radio.value === "both" || radio.value === "names");
            storage.write("showImages", radio.value === "both" || radio.value === "images");
        });
    });

    // Keep fanDegreeRaw in sync with the slider when descendants are not active
    const fanSliderElement = document.getElementById("fanDegree");

    if (fanSliderElement) {
        fanSliderElement.addEventListener("input", () => {
            if (!storage.read("showDescendants")) {
                storage.write("fanDegreeRaw", fanSliderElement.value);
            }
        });
    }

    // Expose chart configuration values under the WebtreesFanChart namespace
    // so chart.phtml getters can read the user's localStorage overrides
    // instead of falling back to server-side defaults only.
    const displayMode = storage.read("displayMode");

    const chartOptions = {
        fanDegree:               storage.read("fanDegree"),
        generations:             storage.read("generations") === null ? null : Number(storage.read("generations")),
        hideEmptySegments:       storage.read("hideEmptySegments"),
        showFamilyColors:        storage.read("showFamilyColors"),
        paternalColor:           storage.read("paternalColor"),
        maternalColor:           storage.read("maternalColor"),
        showPlaces:              storage.read("showPlaces"),
        showParentMarriageDates: storage.read("showParentMarriageDates"),
        showImages:              displayMode ? (displayMode === "both" || displayMode === "images") : storage.read("showImages"),
        showNames:               displayMode ? (displayMode === "both" || displayMode === "names") : storage.read("showNames"),
        innerArcs:               storage.read("innerArcs"),
        fontScale:               storage.read("fontScale"),
        showDescendants:         storage.read("showDescendants") ?? config.defaultShowDescendants,
        detailedDateGenerations: storage.read("detailedDateGenerations") ?? config.defaultDetailedDateGenerations,
    };

    // Store the unclamped fan degree so it can be restored when descendants are disabled
    if (storage.read("fanDegreeRaw") === null) {
        storage.write("fanDegreeRaw", config.defaultFanDegreeRaw);
    }

    // Clamp the fan degree slider when descendants are active (covers the case
    // where the page is loaded from storage with showDescendants already enabled)
    if (chartOptions.showDescendants) {
        const fanSlider = document.getElementById("fanDegree");
        const fanOutput = document.getElementById("fanDegreeOutput");

        if (fanSlider) {
            fanSlider.max = 270;
            chartOptions.fanDegree = Math.min(270, Math.max(180, Number(fanSlider.value)));
            fanSlider.value = chartOptions.fanDegree;

            if (fanOutput) {
                fanOutput.value = `${chartOptions.fanDegree}°`;
            }
        }
    }

    // Attach to the UMD global so chart.phtml getters can read the user's
    // localStorage overrides instead of falling back to server-side defaults.
    // Written after the clamp block so fanDegree is consistent with the slider.
    if (typeof window.WebtreesFanChart !== "undefined") {
        window.WebtreesFanChart.chartOptions = chartOptions;
    }

    const ajaxUrl = getUrl(
        config.ajaxUrl,
        storage.read("generations"),
        chartOptions.detailedDateGenerations,
        chartOptions.showPlaces,
        storage.read("placeParts"),
        chartOptions.showDescendants,
    );

    document.getElementById("fan-chart-url")
        .setAttribute("data-wt-ajax-url", ajaxUrl);

    // showDescendants checkbox: persist to storage, restore raw fan degree, AJAX reload.
    // The slider max/value clamping is handled by the shared script in display.phtml
    // which fires first (registered earlier in DOM order, so the slider value is
    // already clamped when this handler reads it).
    const showDescendantsCheckbox = document.getElementById("showDescendants-1");

    if (showDescendantsCheckbox) {
        showDescendantsCheckbox.addEventListener("change", () => {
            const checked = showDescendantsCheckbox.checked;
            const fanSlider = document.getElementById("fanDegree");
            const fanOutput = document.getElementById("fanDegreeOutput");

            storage.write("showDescendants", checked);

            if (!checked) {
                const raw = storage.read("fanDegreeRaw");

                if (raw !== null && fanSlider) {
                    fanSlider.value = raw;

                    if (fanOutput) {
                        fanOutput.value = `${raw}°`;
                    }
                }
            }

            storage.write("fanDegree", fanSlider ? fanSlider.value : null);

            const container = document.getElementById("fan-chart-url");
            const newUrl = getUrl(
                config.ajaxUrl,
                storage.read("generations"),
                storage.read("detailedDateGenerations") ?? config.defaultDetailedDateGenerations,
                storage.read("showPlaces"),
                storage.read("placeParts"),
                checked,
            );

            container.setAttribute("data-wt-ajax-url", newUrl);
            webtrees.load(container, newUrl); // eslint-disable-line no-undef
        });
    }
}
