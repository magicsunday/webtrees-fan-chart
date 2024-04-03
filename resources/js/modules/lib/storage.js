/**
 * This file is part of the package magicsunday/webtrees-descendants-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

/**
 * This class handles the storage of form values.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-descendants-chart/
 */
export class Storage
{
    /**
     * Constructor.
     *
     * @param {String} name The name of the storage
     */
    constructor(name)
    {
        this._name    = name;
        this._storage = JSON.parse(localStorage.getItem(this._name)) || {};
    }

    /**
     * Register an HTML element.
     *
     * @param {String} name The id or name of an HTML element
     */
    register(name)
    {
        // Use "querySelector" here as the ID of a checkbox elements may additionally contain a hyphen and the value
        let input = document.querySelector('[id^="' + name + '"]');

        if (input === null) {
            return;
        }

        let storedValue = this.read(name);

        if (storedValue !== null) {
            if (input.type && (input.type === "checkbox")) {
                input.checked = storedValue;
            } else {
                input.value = storedValue;
            }
        } else {
            this.onInput(input);
        }

        // Add event listener
        input.addEventListener("input", (event) => {
            this.onInput(event.target);
        });
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
     * @param {String} name The id or name of an HTML element
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
     * @param {String}                name  The id or name of an HTML element
     * @param {String|Boolean|Number} value The value to store
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
