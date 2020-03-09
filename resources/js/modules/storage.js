/**
 * See LICENSE.md file for further details.
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
     * Register a HTML element.
     *
     * @param {string} id The HTML element id
     */
    register(id)
    {
        let input       = document.getElementById(id);
        let storedValue = this.read(input.id);

        if (storedValue) {
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
     * This methods stores the value of an input element depending on its type.
     *
     * @param {EventTarget|HTMLInputElement} element The HTML input element
     */
    onInput(element)
    {
        if (element.type && (element.type === "checkbox")) {
            this.write(element.id, element.checked);
        } else {
            this.write(element.id, element.value);
        }
    }

    /**
     * Returns the stored value belonging to the HTML element id.
     *
     * @param {string} id
     *
     * @return {string|boolean|number}
     */
    read(id)
    {
        return this._storage[id];
    }

    /**
     * Stores a value to the given HTML element id.
     *
     * @param {string}                id
     * @param {string|boolean|number} value
     */
    write(id, value)
    {
        this._storage[id] = value;

        localStorage.setItem(this._name, JSON.stringify(this._storage));
    }
}
