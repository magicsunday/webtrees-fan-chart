<?php
/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees\AncestralFanChart\Controller;

use Fisharebest\Webtrees\Controller\ChartController;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\Filter;
use Fisharebest\Webtrees\Functions\FunctionsEdit;
use Fisharebest\Webtrees\Functions\FunctionsPrint;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Theme;
use Fisharebest\Webtrees\Theme\ThemeInterface;
use Fisharebest\Webtrees\Tree;

/**
 * Chart controller class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
class Chart extends ChartController
{
    /**
     * Minimum number of displayable generations.
     *
     * @var int
     */
    const MIN_GENERATIONS = 2;

    /**
     * Maximum number of displayable generations.
     *
     * @var int
     */
    const MAX_GENERATIONS = 10;

    /**
     * Number of generations to display.
     *
     * @var int
     */
    private $generations = 6;

    /**
     * Style of fan chart. (2 = full circle, 3, three-quarter circle, 4 = half circle)
     *
     * @var int
     */
    private $fanDegree = 210;

    /**
     * Font size scaling factor in percent.
     *
     * @var int
     */
    private $fontScale = 100;

    /**
     * Whether to hide empty segments of chart or not.
     *
     * @var bool
     */
    private $hideEmptySegments = false;

    /**
     * Whether to show gradient colors or not.
     *
     * @var bool
     */
    private $showColorGradients = false;

    /**
     * Constructor.
     */
    public function __construct()
    {
        parent::__construct();

        // Get default number of generations to display
        $defaultGenerations = $this->getTree()->getPreference('DEFAULT_PEDIGREE_GENERATIONS');

        // Extract the request parameters
        $this->fanDegree          = Filter::getInteger('fanDegree', 180, 360, 210);
        $this->generations        = Filter::getInteger('generations', self::MIN_GENERATIONS, self::MAX_GENERATIONS, $defaultGenerations);
        $this->fontScale          = Filter::getInteger('fontScale', 0, 200, 100);
        $this->hideEmptySegments  = Filter::getBool('hideEmptySegments');
        $this->showColorGradients = Filter::getBool('showColorGradients');

        // Create page title
        $title = $this->translate('Ancestral fan chart');

        if ($this->root && $this->root->canShowName()) {
            $title = $this->translate('Ancestral fan chart of %s', $this->root->getFullName());
        }

        $this->setPageTitle($title);
    }

    /**
     * Get tree instance.
     *
     * @return Tree
     */
    private function getTree()
    {
        global $WT_TREE;
        return $WT_TREE;
    }

    /**
     * Get the theme instance.
     *
     * @return ThemeInterface
     */
    private function getTheme()
    {
        return Theme::theme();
    }

    /**
     * Translate a string, and then substitute placeholders.
     *
     * @return string
     */
    private function translate(/* var_args */)
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
    private function getColor(Individual $person = null)
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

    private function isRtl($text)
    {
        return I18N::scriptDirection(I18N::textScript($text)) === 'rtl';
    }

    /**
     * Get the individual data required for display the chart.
     *
     * @param Individual $person     Start person
     * @param int        $generation Generation the person belongs to
     *
     * @return array
     */
    private function getIndividualData(Individual $person, $generation)
    {
        $fullName        = Filter::unescapeHtml($person->getFullName());
        $alternativeName = Filter::unescapeHtml($person->getAddName());

        return array(
            'id'              => 0,
            'xref'            => $person->getXref(),
            'generation'      => $generation,
            'name'            => $fullName,
            'alternativeName' => $alternativeName,
            'isAltRtl'        => $this->isRtl($alternativeName),
            'sex'             => $person->getSex(),
            'born'            => $person->getBirthYear(),
            'died'            => $person->getDeathYear(),
            'color'           => $this->getColor($person),
            'colors'          => [[], []],
        );
    }

    /**
     * Recursively build the data array of the individual ancestors.
     *
     * @param Individual $person     Start person
     * @param int        $generation Current generation
     *
     * @return array
     */
    public function buildJsonTree(
        Individual $person = null, $generation = 1
    ) {
        // Maximum generation reached
        if (($generation > $this->generations)
            || !($person instanceof Individual)
        ) {
            return array();
        }

        $data   = $this->getIndividualData($person, $generation);
        $family = $person->getPrimaryChildFamily();

        if (!($family instanceof Family)) {
            return $data;
        }

        // Recursively call the method for the parents of the individual
        $fatherTree = $this->buildJsonTree($family->getHusband(), $generation + 1);
        $motherTree = $this->buildJsonTree($family->getWife(), $generation + 1);

        // Add array of child nodes
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
    private function printFindIndividualLink()
    {
        return FunctionsPrint::printFindIndividualLink('rootid');
    }

    /**
     * Get the HTML for the "hideEmptySegments" checkbox element.
     *
     * @return string
     */
    private function getHideEmptySegmentsCheckbox()
    {
        return FunctionsEdit::twoStateCheckbox('hideEmptySegments', $this->hideEmptySegments);
    }

    /**
     * Get the HTML for the "showColorGradients" checkbox element.
     *
     * @return string
     */
    private function getShowColorGradientsCheckbox()
    {
        return FunctionsEdit::twoStateCheckbox('showColorGradients', $this->showColorGradients);
    }

    /**
     * Get the HTML for the "fanDegree" selection form control element.
     *
     * @return string
     */
    private function getFanDegreeSelectControl()
    {
        return FunctionsEdit::selectEditControl(
            'fanDegree', $this->getFanDegrees(), null, $this->fanDegree
        );
    }

    /**
     * Get the HTML for the "generations" input form control element.
     *
     * @return string
     */
    private function getGenerationsInputControl()
    {
        return FunctionsEdit::editFieldInteger('generations', $this->generations, self::MIN_GENERATIONS, self::MAX_GENERATIONS);
    }

    /**
     * A list of options for the chart degrees.
     *
     * @return string[]
     */
    private function getFanDegrees()
    {
        return [
            180 => $this->translate('180 degrees'),
            210 => $this->translate('210 degrees'),
            240 => $this->translate('240 degrees'),
            270 => $this->translate('270 degrees'),
            300 => $this->translate('300 degrees'),
            330 => $this->translate('330 degrees'),
            360 => $this->translate('360 degrees'),
        ];
    }

    /**
     * Get the theme defined chart font color.
     *
     * @return string HTML color code
     */
    private function getChartFontColor()
    {
        return '#' . $this->getTheme()->parameter('chart-font-color');
    }

    /**
     * Returns the content HTML, including form and chart placeholder.
     *
     * @return string
     */
    private function getContentHtml()
    {
        $viewFile = __DIR__ . '/../View/form.phtml';

        if (is_file($viewFile)) {
            ob_start();
            include $viewFile;
            return ob_get_clean();
        }

        return false;
    }

    /**
     * Get the raw update url. The "rootid" parameter must be the last one as
     * the url gets appended with the clicked individual id in order to load
     * the required chart data.
     *
     * @return string
     */
    private function getUpdateUrl()
    {
        $queryData = array(
            'mod'         => 'ancestral-fan-chart',
            'mod_action'  => 'update',
            'ged'         => $this->getTree()->getNameHtml(),
            'generations' => $this->generations,
            'rootid'      => '',
        );

        return 'module.php?' . http_build_query($queryData);
    }

    /**
     * Get the raw individual url. The "pid" parameter must be the last one as
     * the url gets appended with the clicked individual id in order to link
     * to the right individual page.
     *
     * @return string
     */
    private function getIndividualUrl()
    {
        $queryData = array(
            'ged' => $this->getTree()->getNameHtml(),
            'pid' => '',
        );

        return 'individual.php?' . http_build_query($queryData);
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
                'rtl'                => I18N::direction() === 'rtl',
                'fanDegree'          => $this->fanDegree,
                'generations'        => $this->generations,
                'defaultColor'       => $this->getColor(),
                'fontScale'          => $this->fontScale,
                'fontColor'          => $this->getChartFontColor(),
                'hideEmptySegments'  => $this->hideEmptySegments,
                'showColorGradients' => $this->showColorGradients,
                'updateUrl'          => $this->getUpdateUrl(),
                'individualUrl'      => $this->getIndividualUrl(),
                'data'               => $this->buildJsonTree($this->root),
                'labels'             => array(
                    'zoom' => $this->translate('Use Ctrl + scroll to zoom in the view'),
                    'move' => $this->translate('Move the view with two fingers'),
                ),
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
