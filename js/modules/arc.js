/**
 * See LICENSE.md file for further details.
 */
import Gradient from "./gradient";
import Click from "./arc/click";
import Person from "./person";

/**
 * The class handles the creation of the person group and the person elements of the chart. It assignes
 * the click handler and the color group on to of each person.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
export default class Arc
{
    /**
     * Constructor.
     *
     * @param {Config}    config    The configuration
     * @param {Options}   options
     * @param {Hierarchy} hierarchy
     */
    constructor(config, options, hierarchy)
    {
        this.config    = config;
        this.options   = options;
        this.hierarchy = hierarchy;

        this.init();
    }

    /**
     * Create the arc elements for each individual in the data list.
     *
     * @return {void}
     *
     * @public
     */
    init()
    {
        let personGroup = this.config.svg.select("g.personGroup");
        let gradient    = new Gradient(this.config, this.options);

        personGroup.selectAll("g.person")
            .data(this.hierarchy.nodes)
            .enter()
            .each(entry => {
                let person = personGroup
                    .append("g")
                    .attr("class", "person")
                    .attr("id", "person-" + entry.data.id)
                    .on("click", null);

                new Person(this.config, this.options, this.hierarchy, person, entry);

                if (this.options.showColorGradients) {
                    gradient.init(entry);
                }
            });

        let click = new Click(this.config, this.options, this.hierarchy);
        click.bindClickEventListener();

        gradient.addColorGroup(this.hierarchy)
            .style("opacity", 1);
    }
}
