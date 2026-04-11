/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * Persists chart configuration form values to localStorage so settings survive
 * a page reload. Each field is registered by its element ID; the stored value
 * is restored to the input on page load, and an "input" event listener keeps
 * it in sync thereafter.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export class Storage {
    /**
     * @param {string} name The localStorage key under which all values are stored as a JSON object
     */
    constructor(name) {
        this._name = name;
        this._storage = JSON.parse(localStorage.getItem(this._name)) || {};
    }

    /**
     * Registers an input or select element by its ID prefix. If a stored value
     * exists it is restored to the element; otherwise the current element value
     * is written to storage. An "input" event listener is added to all matching
     * elements so future changes are persisted automatically. Uses querySelector
     * with a prefix match to support checkbox IDs that include the checked value.
     *
     * @param {string} name The element ID (or ID prefix for checkboxes/radios)
     */
    register(name) {
        // Use "querySelector" here as the ID of checkbox elements may additionally contain a hyphen and the value
        // Query checked elements (radio and checkbox) separately
        const input = document.querySelector('input[id^="' + name + '"]:checked, select[id^="' + name + '"]')
            || document.querySelector('input[id^="' + name + '"]');

        if (input === null) {
            return;
        }

        const storedValue = this.read(name);

        if (storedValue !== null) {
            if (input.type === "radio" || input.type === "checkbox") {
                input.checked = storedValue;
            } else {
                input.value = storedValue;
            }
        } else {
            this.onInput(input);
        }

        // Add event listener to all inputs by their IDs
        document
            .querySelectorAll('input[id^="' + name + '"], select[id^="' + name + '"]')
            .forEach(
                (input) => input.addEventListener("input", (event) => {
                    this.onInput(event.target);
                }),
            );
    }

    /**
     * Persists the current value of an input to storage. For checkboxes the
     * boolean checked state is stored; for all other inputs the string value.
     *
     * @param {EventTarget|HTMLInputElement} element The input or select element
     *
     * @private
     */
    onInput(element) {
        if (element.type && (element.type === "checkbox")) {
            this.write(element.name, element.checked);
        } else {
            this.write(element.name, element.value);
        }
    }

    /**
     * Returns the value previously stored under the given key, or null if
     * no entry exists.
     *
     * @param {string} name The element id or name attribute used as storage key
     *
     * @return {null|string|boolean|number}
     */
    read(name) {
        if (Object.prototype.hasOwnProperty.call(this._storage, name)) {
            return this._storage[name];
        }

        return null;
    }

    /**
     * Persists a value under the given key and flushes the entire storage
     * object to localStorage. Logs a warning (but does not throw) when
     * localStorage quota is exceeded.
     *
     * @param {string}                name  The element id or name attribute used as storage key
     * @param {string|boolean|number} value The value to store
     */
    write(name, value) {
        this._storage[name] = value;

        try {
            localStorage.setItem(this._name, JSON.stringify(this._storage));
        } catch (_exception) {
            console.log(
                "There wasn't enough space to store '" + name + "' with value '" + value + "' in the local storage.",
            );
        }
    }
}
