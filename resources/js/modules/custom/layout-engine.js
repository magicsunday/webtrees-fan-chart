/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

import Hierarchy from "./hierarchy";
import Geometry from "./svg/geometry";
import ArcFactory from "./svg/segments/arc-factory";

/**
 * Coordinates geometry helpers and hierarchical data.
 */
export default class LayoutEngine
{
    /**
     * @param {Configuration} configuration
     */
    constructor(configuration)
    {
        this._configuration = configuration;
        this._hierarchy     = new Hierarchy(this._configuration);
        this._geometry      = new Geometry(this._configuration);
        this._arcFactory    = new ArcFactory(this._geometry, {
            padAngle: this._configuration.padAngle,
            padRadius: this._configuration.padRadius,
            cornerRadius: this._configuration.cornerRadius,
        });
    }

    /**
     * Initializes hierarchy data and prepares geometry helpers.
     *
     * @param {Object} data
     */
    initializeHierarchy(data)
    {
        this._hierarchy.init(data);
    }

    /**
     * @returns {Hierarchy}
     */
    get hierarchy()
    {
        return this._hierarchy;
    }

    /**
     * @returns {Geometry}
     */
    get geometry()
    {
        return this._geometry;
    }

    /**
     * @returns {ArcFactory}
     */
    get arcFactory()
    {
        return this._arcFactory;
    }
}
