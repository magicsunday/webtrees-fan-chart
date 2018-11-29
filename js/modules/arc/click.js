/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import {Hierarchy} from "../hierarchy";
import {Options} from "../options";
import {config} from "../config";
import Update from "../update";

/**
 *
 */
export class Click
{
    /**
     * Constructor.
     *
     * @param {Config}    config
     * @param {Options}   options
     * @param {Hierarchy} hierarchy
     */
    constructor(config, options, hierarchy)
    {
        this.config    = config;
        this.options   = options;
        this.hierarchy = hierarchy;
        this.svg       = config.svg;
    }

    /**
     * This method bind the "click" event listeners to a "person" element.
     */
    bindClickEventListener()
    {
        let self = this;

        let personGroup = this.svg
            .select("g.personGroup")
            .selectAll("g.person")
            .data(this.hierarchy.getNodes())
            .filter((d) => (d.data.xref !== ""))
            .classed("available", true);

        // Trigger method on click
        personGroup.on("click", self.personClick.bind(this));
    }

    /**
     * Method triggers either the "update" or "individual" method on the click on an person.
     *
     * @param {Object} data The D3 data object
     */
    personClick(data)
    {
        // Trigger either "update" or "individual" method on click depending on person in chart
        (data.depth === 0) ? individual(data) : this.update(data);
    }

    /**
     * Redirect the current page the the individual page.
     *
     * @param {Object} d D3 data object
     */
    individual(d)
    {
        window.location = this.options.individualUrl + d.data.xref;
    }

    /**
     * Redirect the current page the the individual page.
     *
     * @param {Object} d D3 data object
     */
    update(d)
    {
        let update = new Update(this.config, this.options, this.hierarchy);
        update.update(d);
    }
}
