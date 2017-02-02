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

use \Fisharebest\Webtrees\Controller\ChartController;
use \Fisharebest\Webtrees\Family;
use \Fisharebest\Webtrees\Filter;
use \Fisharebest\Webtrees\Functions\FunctionsEdit;
use \Fisharebest\Webtrees\Functions\FunctionsPrint;
use \Fisharebest\Webtrees\Individual;
use \Fisharebest\Webtrees\Theme;
use \Fisharebest\Webtrees\Theme\ThemeInterface;
use \Fisharebest\Webtrees\Tree;

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
    protected $fanDegree = 210;

    /**
     * Font size scaling factor in percent.
     *
     * @var int
     */
    protected $fontScale = 100;

    /**
     * Constructor.
     */
    public function __construct()
    {
        parent::__construct();

        // Get default number of generations to display
        $defaultGenerations = $this->getTree()->getPreference('DEFAULT_PEDIGREE_GENERATIONS');

        // Extract the request parameters
        $this->fanDegree   = Filter::getInteger('fanDegree', 180, 360, 210);
        $this->generations = Filter::getInteger('generations', 2, 9, $defaultGenerations);
        $this->fontScale   = Filter::getInteger('fontScale', 0, 200, 100);

        // Create page title
        $title = 'Ancestral fan chart';
        if ($this->root && $this->root->canShowName()) {
            $title = 'Ancestral fan chart of %s';
        }

        $this->setPageTitle(
            $this->translate($title, $this->root->getFullName())
        );
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
     * Get the theme instance.
     *
     * @return ThemeInterface
     */
    protected function getTheme()
    {
        return Theme::theme();
    }

    /**
     * Translate a string, and then substitute placeholders.
     *
     * @return string
     */
    protected function translate(/* var_args */)
    {
        // Damn ugly static methods all around :(
        return call_user_func_array(
            '\\Fisharebest\\Webtrees\\I18N::translate',
            func_get_args()
        );
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
        if ($person instanceof Individual) {
            if ($person->getSex() === 'M') {
                return '#' . $this->getTheme()->parameter('chart-background-m');
            } elseif ($person->getSex() === 'F') {
                return '#' . $this->getTheme()->parameter('chart-background-f');
            }
        }

        return '#' . $this->getTheme()->parameter('chart-background-u');
    }

    /**
     * Get the individual data required for display the chart.
     *
     * @param Individual $person Start person
     *
     * @return array
     */
    protected function getIndividualData(Individual $person = null)
    {
        // We need always two individuals, so we fake the missing ones
        if (!($person instanceof Individual)) {
            return array(
                'id'    => '',
                'name'  => '',
                'born'  => '',
                'died'  => '',
                'color' => $this->getColor(),
            );
        }

        return array(
            'id'    => $person->getXref(),
            'name'  => html_entity_decode(strip_tags($person->getFullName())),
            'born'  => $person->getBirthYear(),
            'died'  => $person->getDeathYear(),
            'color' => $this->getColor($person),
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

        $data   = $this->getIndividualData($person);
        $father = null;
        $mother = null;

        if ($person instanceof Individual) {
            $family = $person->getPrimaryChildFamily();

            if ($family instanceof Family) {
                $father = $family->getHusband();
                $mother = $family->getWife();
            }
        }

        // Recursively call the method for the parents of the individual
        $fatherTree = $this->buildJsonTree($father, $generation + 1);
        $motherTree = $this->buildJsonTree($mother, $generation + 1);

        // Add array of child nodes, or empty array for leaf nodes
        // @see D3 partition layout
        if ($fatherTree) {
            $data['children'][] = $fatherTree;
        }

        if ($motherTree) {
            $data['children'][] = $motherTree;
        }

        return $data;
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
     * Get the HTML for the "fanDegree" selection form control element.
     *
     * @return string
     */
    protected function getFanStyleSelectControl()
    {
        return FunctionsEdit::selectEditControl(
            'fanDegree', $this->getFanStyles(), null, $this->fanDegree
        );
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
            180 => $this->translate('180 degree'),
            210 => $this->translate('210 degree'),
            240 => $this->translate('240 degree'),
            270 => $this->translate('270 degree'),
            300 => $this->translate('300 degree'),
            330 => $this->translate('330 degree'),
            360 => $this->translate('360 degree'),
        ];
    }

    /**
     * Get the theme defined chart font color.
     *
     * @return string HTML color code
     */
    protected function getChartFontColor()
    {
        return '#' . $this->getTheme()->parameter('chart-font-color');
    }

    /**
     * Returns the content HTML, including form and chart placeholder.
     *
     * @return string
     */
    protected function getContentHtml()
    {
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
                        <label for="fanDegree">{$this->translate('Degrees')}</label>
                    </td>
                    <td class="optionbox">
                        {$this->getFanStyleSelectControl()}
                    </td>
                    <td class="descriptionbox">
                        <label for="fontScale">{$this->translate('Font size')}</label>
                    </td>
                    <td class="optionbox">
                        <input class="fontScale" type="text" name="fontScale" id="fontScale" size="3" value="{$this->fontScale}">
                        {$this->translate('%')}
                    </td>
                    <td rowspan="2" class="topbottombar vmiddle">
                        <input type="submit" value="{$this->translate('view')}">
                    </td>
                </tr>
            </tbody>
        </table>
    </form>
    <div id="fan_chart"></div>
</div>
HTML;
    }

    /**
     * Render the fan chart form HTML and JSON data.
     *
     * @return string HTML snippet to include in page HTML
     */
    public function render()
    {
        // Encode chart parameters to json string
        $chartParams = json_encode(
            array(
                'fanDegree' => $this->fanDegree,
                'fontScale' => $this->fontScale,
                'fontColor' => $this->getChartFontColor(),
                'data'      => $this->buildJsonTree($this->root),
            )
        );

        $this->addInlineJavascript('autocomplete();')
            ->addInlineJavascript(
<<<JS
// Init widget
if (typeof $().ancestralFanChart === 'function') {
    $('#fan_chart').ancestralFanChart({$chartParams});
}
JS
        );

        return $this->getContentHtml();
    }
}
