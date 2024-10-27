/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * This class handles the storage of form values.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
export class Storage
{
    /**
     * Constructor.
     *
     * @param {string} name The name of the storage
     */
    constructor(name)
    {
        this._name    = name;
        this._storage = JSON.parse(localStorage.getItem(this._name)) || {};
    }

    /**
     * Register an HTML element.
     *
     * @param {string} name The ID of an HTML element
     */
    register(name)
    {
        // Use "querySelector" here as the ID of checkbox elements may additionally contain a hyphen and the value
        // Query checked elements (radio and checkbox) separately
        let input = document.querySelector('input[id^="' + name + '"]:checked, select[id^="' + name + '"]')
            || document.querySelector('input[id^="' + name + '"]');

        if (input === null) {
            return;
        }

        let storedValue = this.read(name);

        if (storedValue !== null) {
            if (input.type && (input.type === "radio")) {
                input.checked = storedValue;
            } else {
                if (input.type && (input.type === "checkbox")) {
                    input.checked = storedValue;
                } else {
                    input.value = storedValue;
                }
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
                })
            );
    }

    /**
     * This method stores the value of an input element depending on its type.
     *
     * @param {EventTarget|HTMLInputElement} element The HTML input element
     */
    onInput(element)
    {
        if (element.type && (element.type === "checkbox")) {
            this.write(element.name, element.checked);
        } else {
            this.write(element.name, element.value);
        }
    }

    /**
     * Returns the stored value belonging to the HTML element id.
     *
     * @param {string} name The id or name of an HTML element
     *
     * @returns {null|String|Boolean|Number}
     */
    read(name)
    {
        if (this._storage.hasOwnProperty(name)) {
            return this._storage[name];
        }

        return null;
    }

    /**
     * Stores a value to the given HTML element id.
     *
     * @param {string}                name  The id or name of an HTML element
     * @param {string|Boolean|Number} value The value to store
     */
    write(name, value)
    {
        this._storage[name] = value;

        try {
            localStorage.setItem(this._name, JSON.stringify(this._storage));
        }
        catch (exception) {
            console.log(
                "There wasn't enough space to store '" + name + "' with value '" + value + "' in the local storage."
            );
        }
    }
}
