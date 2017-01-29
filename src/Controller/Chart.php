<?php
/**
 * Webtrees module.
 *
 * Copyright (C) 2017  Rico Sonntag
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301  USA
 *
 * @category   Webtrees
 * @package    Module
 * @subpackage Controller
 * @author     Rico Sonntag <mail@ricosonntag.de>
 * @link       https://github.com/magicsunday/ancestral-fan-chart/
 * @license    http://opensource.org/licenses/gpl-license.php GNU Public License
 */

namespace RSO\WebtreesModule\AncestralFanChart\Controller;

use Fisharebest\Webtrees\Controller\ChartController;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\Filter;
use Fisharebest\Webtrees\Functions\FunctionsEdit;
use Fisharebest\Webtrees\Functions\FunctionsPrint;

/**
 * Fan chart controller class.
 *
 * @category   Webtrees
 * @package    Module
 * @subpackage Controller
 * @author     Rico Sonntag <mail@ricosonntag.de>
 * @license    TBD
 * @link       https://github.com/magicsunday/ancestral-fan-chart/
 */
class Chart extends ChartController
{
    /**
     * Number of generations to display.
     *
     * @var int
     */
    protected $generations = 5;

    /**
     * Style of fan chart. (2 = full circle, 3, three-quarter circle, 4 = half circle)
     *
     * @var int
     */
    protected $fanStyle = 3;

    /**
     * Constructor.
     */
    public function __construct()
    {
        parent::__construct();

        // Get default number of generations to display
        $defaultGenerations = $this->getTree()->getPreference('DEFAULT_PEDIGREE_GENERATIONS');

        // Extract the request parameters
        $this->fanStyle    = Filter::getInteger('fanStyle', 2, 4, 3);
        $this->generations = Filter::getInteger('generations', 2, 9, $defaultGenerations);

        if ($this->root && $this->root->canShowName()) {
            $this->setPageTitle(
                I18N::translate(
                    'Ancestral fan chart of %s', $this->root->getFullName()
                )
            );
        } else {
            $this->setPageTitle(
                I18N::translate('Ancestral fan chart')
            );
        }
    }

    /**
     * Get tree instance.
     *
     * @return Tree
     */
    protected function getTree()
    {
        global $WT_TREE;
        return $WT_TREE;
    }

    /**
     * Get the default colors based on the gender of an individual.
     *
     * @param Individual $person Individual instance
     *
     * @return string HTML color code
     */
    protected function getColor(Individual $person = null)
    {
        if (!($person instanceof Individual)) {
            return '#fff';
        }

        if ($person->getSex() === 'M') {
            return '#b1cff0';
        } elseif ($person->getSex() === 'F') {
            return '#e9daf1';
        }

        return '#fff';
    }

    /**
     * Get the individual data required for display the chart.
     *
     * @param Individual $person     Start person
     * @param int        $generation Current generation
     *
     * @return array
     */
    protected function getIndividualData(
        Individual $person = null, $generation = 1
    ) {
        // We need always two individuals, so we fake the missing ones
        if (!($person instanceof Individual)) {
            return array(
                'id'       => '',
                'name'     => '',
                'born'     => '',
                'died'     => '',
                'color'    => $this->getColor(),
                'children' => array(),
            );
        }

        return array(
            'id'       => $person->getXref(),
            'name'     => strip_tags($person->getFullName()),
            'born'     => $person->getBirthYear(),
            'died'     => $person->getDeathYear(),
            'color'    => $this->getColor($person),
            'children' => array(),
        );
    }

    /**
     * Recursively build the data array of the individual ancestors.
     *
     * @param Individual $person     Start person
     * @param int        $generation Current generation
     *
     * @return array
     *
     * @todo Rebuild this to a iterative method
     */
    protected function buildJsonTree(
        Individual $person = null, $generation = 1
    ) {
        // Maximum generation reached
        if ($generation > $this->generations) {
            return array();
        }

        $json   = $this->getIndividualData($person, $generation);
        $family = null;

        if ($person instanceof Individual) {
            $family = $person->getPrimaryChildFamily();
        }

        if ($family instanceof Family) {
            $father = $family->getHusband();
            $mother = $family->getWife();
        } else {
            $father = null;
            $mother = null;
        }

        // Recursively call the method for the parents of the individual
        $fatherTree = $this->buildJsonTree($father, $generation + 1);
        $motherTree = $this->buildJsonTree($mother, $generation + 1);

        // Add array of child nodes, or empty array for leaf nodes
        // @see D3 partition layout
        if ($fatherTree) {
            $json['children'][] = $fatherTree;
        }

        if ($motherTree) {
            $json['children'][] = $motherTree;
        }

        return $json;
    }

    /**
     *
     * @param string $value String to translate
     *
     * @return string
     */
    protected function translate($value)
    {
        return I18N::translate($value);
    }

    /**
     * Get the HTML link to find an individual.
     *
     * @return string
     */
    protected function printFindIndividualLink()
    {
        return FunctionsPrint::printFindIndividualLink('rootid');
    }

    /**
     * Get the HTML for the "fanStyle" selection form control element.
     *
     * @return string
     */
    protected function getFanStyleSelectControl()
    {
        return FunctionsEdit::selectEditControl('fanStyle', $this->getFanStyles(), null, $this->fanStyle);
    }

    /**
     * Get the HTML for the "generations" input form control element.
     *
     * @return string
     */
    protected function getGenerationsInputControl()
    {
        return FunctionsEdit::editFieldInteger('generations', $this->generations, 2, 9);
    }

    /**
     * A list of options for the chart style.
     *
     * @return string[]
     */
    protected function getFanStyles()
    {
        return [
            4 => $this->translate('half circle'),
            3 => $this->translate('three-quarter circle'),
            2 => $this->translate('full circle'),
        ];
    }

    /**
     * Render the fan chart HTML and JSON data.
     *
     * @return string HTML snippet to include in page HTML
     */
    public function render()
    {
        // Encode data to json string
        $json = json_encode(
            $this->buildJsonTree($this->root)
        );

        $this->addInlineJavascript(
<<<JS
/**
 * Init widget
 */
$(function () {
    'use strict';

    var fanChart = $('#fan-chart');

    if (typeof $().ancestralFanChart === 'function') {
        fanChart.ancestralFanChart({
            fanStyle : {$this->fanStyle},
            data : {$json}
        });
    }
});
JS
        );

        $this->addInlineJavascript('autocomplete();');

        return <<<HTML
<div id="ancestral-fan-chart">
    <h2>{$this->getPageTitle()}</h2>
    <form name="people" method="get" action="?">
        <input type="hidden" name="ged" value="{$this->getTree()->getNameHtml()}">
        <input type="hidden" name="mod" value="ancestral-fan-chart">
        <table class="list_table">
            <tbody>
                <tr>
                    <td class="descriptionbox">
                        <label for="rootid">{$this->translate('Individual')}</label>
                    </td>
                    <td class="optionbox">
                        <input class="pedigree_form" data-autocomplete-type="INDI" type="text" name="rootid" id="rootid" size="3" value="{$this->root->getXref()}">
                        {$this->printFindIndividualLink()}
                    </td>
                    <td class="descriptionbox">
                        <label for="generations">{$this->translate('Generations')}</label>
                    </td>
                    <td class="optionbox">
                        {$this->getGenerationsInputControl()}
                    </td>
                    <td class="descriptionbox">
                        <label for="fanStyle">{$this->translate('Layout')}</label>
                    </td>
                    <td class="optionbox">
                        {$this->getFanStyleSelectControl()}
                    </td>
                    <td rowspan="2" class="topbottombar vmiddle">
                        <input type="submit" value="{$this->translate('view')}">
                    </td>
                </tr>
            </tbody>
        </table>
    </form>
    <div id="fan-chart"></div>
</div>
HTML;
    }
}
