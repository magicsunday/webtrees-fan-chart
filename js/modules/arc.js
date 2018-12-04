/*jslint es6: true */
/*jshint esversion: 6 */

/**
 * See LICENSE.md file for further details.
 */
import {Hierarchy} from "./hierarchy";
import {Options} from "./options";
import {Gradient} from "./gradient";
import {Geometry} from "./geometry";
import Click from "./arc/click";
import {Person} from "./person";

/**
 *
 */
export class Arc
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
        this.geometry  = new Geometry(options);
    }

    /**
     * Create the arc elements for each individual in the data list.
     *
     * @return {void}
     *
     * @public
     */
    createArcElements()
    {
        let self        = this;
        let personGroup = this.config.svg.select("g.personGroup");

        let gradient    = new Gradient(this.config, this.options);

        personGroup.selectAll("g.person")
            .data(this.hierarchy.getNodes())
            .enter()
            .each(entry => {
                let person = personGroup
                    .append("g")
                    .attr("class", "person")
                    .attr("id", "person-" + entry.data.id)
                    .on("click", null);

                let p = new Person(self.config, self.options, self.hierarchy);
                p.addPersonData(person, entry);

                if (self.options.showColorGradients) {
                    gradient.init(entry);
                }
            });

        let click = new Click(this.config, this.options, this.hierarchy);
        click.bindClickEventListener();
        // this.bindClickEventListener();

        gradient.addColorGroup(this.hierarchy)
            .style("opacity", 1);
    }
}
