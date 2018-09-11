<?php
declare(strict_types=1);

/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees;

use Fisharebest\Webtrees\Exceptions\IndividualAccessDeniedException;
use Fisharebest\Webtrees\Exceptions\IndividualNotFoundException;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Menu;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Module\ModuleChartInterface;
use Fisharebest\Webtrees\Theme;
use Fisharebest\Webtrees\Theme\ThemeInterface;
use Fisharebest\Webtrees\Tree;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ancestral fan chart module class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
class AncestralFanChartModule extends AbstractModule implements ModuleChartInterface
{
    /**
     * For custom modules - optional (recommended) version number
     *
     * @var string
     */
    const CUSTOM_VERSION = '2.0';

    /**
     * For custom modules - link for support, upgrades, etc.
     *
     * @var string
     */
    const CUSTOM_WEBSITE = 'https://github.com/magicsunday/ancestral-fan-chart';

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
     * The current theme instance.
     *
     * @var ThemeInterface
     */
    private $theme;

    /**
     * The current tree instance.
     *
     * @var Tree
     */
    private $tree;

    /**
     * Number of generations to display.
     *
     * @var int
     */
    private $generations = 6;

    /**
     * Fan chart degree.
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
     * How should this module be labelled on tabs, menus, etc.?
     *
     * @return string
     */
    public function getTitle(): string
    {
        return I18N::translate('Ancestral fan chart');
    }

    /**
     * A sentence describing what this module does.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return I18N::translate('A fan chart of an individual’s ancestors.');
    }

    /**
     * Return a menu item for this chart.
     *
     * @param Individual $individual Current individual instance
     *
     * @return Menu
     */
    public function getChartMenu(Individual $individual): Menu
    {
        $link = route('module', [
            'module' => $this->getName(),
            'action' => 'FanChart',
            'xref'   => $individual->getXref(),
            'ged'    => $individual->getTree()->getName(),
        ]);

        return new Menu(
            $this->getTitle(),
            $link,
            'menu-chart-fanchart',
            [
                'rel' => 'nofollow',
            ]
        );
    }

    /**
     * Return a menu item for this chart - for use in individual boxes.
     *
     * @param Individual $individual Current individual instance
     *
     * @return Menu
     */
    public function getBoxChartMenu(Individual $individual): Menu
    {
        return $this->getChartMenu($individual);
    }

    /**
     * Entry point action. Creates the form to configure the chart.
     *
     * @param Request $request The current HTTP request
     * @param Tree    $tree    The current tree
     *
     * @return Response
     *
     * @throws \Exception
     */
    public function getFanChartAction(Request $request, Tree $tree): Response
    {
        $this->theme = Theme::theme();
        $this->tree  = $tree;

        $xref       = $request->get('xref');
        $individual = Individual::getInstance($xref, $this->tree);

        if ($individual === null) {
            throw new IndividualNotFoundException();
        }

        if (!$individual->canShow()) {
            throw new IndividualAccessDeniedException();
        }

        $title = I18N::translate('Ancestral fan chart');

        if ($individual->canShowName()) {
            $title = I18N::translate('Ancestral fan chart of %s', $individual->getFullName());
        }

        // Get default number of generations to display
        $defaultGenerations = $this->tree->getPreference('DEFAULT_PEDIGREE_GENERATIONS');

        // Extract the request parameters
        $this->hideEmptySegments  = (bool) $request->get('hideEmptySegments');
        $this->showColorGradients = (bool) $request->get('showColorGradients');

        $this->fanDegree = (int) $request->get('fanDegree', 210);
        $this->fanDegree = min($this->fanDegree, 360);
        $this->fanDegree = max($this->fanDegree, 180);

        $this->fontScale = (int) $request->get('fontScale', 100);
        $this->fontScale = min($this->fontScale, 200);
        $this->fontScale = max($this->fontScale, 0);

        $this->generations = (int) $request->get('generations', $defaultGenerations);
        $this->generations = min($this->generations, self::MAX_GENERATIONS);
        $this->generations = max($this->generations, self::MIN_GENERATIONS);

        $chartParams = [
            'rtl'                => I18N::direction() === 'rtl',
            'fanDegree'          => $this->fanDegree,
            'generations'        => $this->generations,
            'defaultColor'       => $this->getColor(),
            'fontScale'          => $this->fontScale,
            'fontColor'          => $this->getChartFontColor(),
            'hideEmptySegments'  => $this->hideEmptySegments,
            'showColorGradients' => $this->showColorGradients,
            'updateUrl'          => $this->getUpdateRoute(),
            'individualUrl'      => $this->getIndividualRoute(),
            'data'               => $this->buildJsonTree($individual),
            'labels'             => [
                'zoom' => I18N::translate('Use Ctrl + scroll to zoom in the view'),
                'move' => I18N::translate('Move the view with two fingers'),
            ],
        ];

        return $this->viewResponse(
            'fan-chart',
            [
                'rtl'                => I18N::direction() === 'rtl',
                'title'              => $title,
                'individual'         => $individual,
                'tree'               => $this->tree,
                'fanDegree'          => $this->fanDegree,
                'fanDegrees'         => $this->getFanDegrees(),
                'generations'        => $this->generations,
                'fontScale'          => $this->fontScale,
                'hideEmptySegments'  => $this->hideEmptySegments,
                'showColorGradients' => $this->showColorGradients,
                'chartParams'        => json_encode($chartParams),
            ]
        );
    }

    /**
     * Entry point action. Creates the form to configure the chart.
     *
     * @param Request $request The current HTTP request
     * @param Tree    $tree    The current tree
     *
     * @return Response
     *
     * @throws \Exception
     */
    public function getUpdateAction(Request $request, Tree $tree): Response
    {
        $this->theme = Theme::theme();
        $this->tree  = $tree;

        $xref       = $request->get('xref');
        $individual = Individual::getInstance($xref, $tree);

        return new Response(
            json_encode(
                $this->buildJsonTree($individual)
            ),
            200,
            [
                'Content-Type' => 'application/json; charset=utf-8',
            ]
        );
    }

    /**
     * A list of options for the chart degrees.
     *
     * @return string[]
     */
    private function getFanDegrees(): array
    {
        return [
            180 => I18N::translate('180 degrees'),
            210 => I18N::translate('210 degrees'),
            240 => I18N::translate('240 degrees'),
            270 => I18N::translate('270 degrees'),
            300 => I18N::translate('300 degrees'),
            330 => I18N::translate('330 degrees'),
            360 => I18N::translate('360 degrees'),
        ];
    }

    /**
     * Returns the unescaped HTML string.
     *
     * @param string $value The value to strip the HTML tags from
     *
     * @return null|string
     */
    private function unescapedHtml(string $value = null)
    {
        return ($value === null)
            ? $value
            : html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Returns whether the given text is in RTL style or not.
     *
     * @param string $text The text to check
     *
     * @return bool
     */
    private function isRtl(string $text = null): bool
    {
        return $text ? I18N::scriptDirection(I18N::textScript($text)) === 'rtl' : false;
    }

    /**
     * Get the individual data required for display the chart.
     *
     * @param Individual $individual The start person
     * @param int        $generation The generation the person belongs to
     *
     * @return array
     */
    private function getIndividualData(Individual $individual, int $generation): array
    {
        $fullName        = $this->unescapedHtml($individual->getFullName());
        $alternativeName = $this->unescapedHtml($individual->getAddName());

        return [
            'id'              => 0,
            'xref'            => $individual->getXref(),
            'generation'      => $generation,
            'name'            => $fullName,
            'alternativeName' => $alternativeName,
            'isAltRtl'        => $this->isRtl($alternativeName),
            'sex'             => $individual->getSex(),
            'born'            => $individual->getBirthYear(),
            'died'            => $individual->getDeathYear(),
            'color'           => $this->getColor($individual),
            'colors'          => [[], []],
        ];
    }

    /**
     * Recursively build the data array of the individual ancestors.
     *
     * @param null|Individual $individual The start person
     * @param int             $generation The current generation
     *
     * @return array
     */
    private function buildJsonTree(Individual $individual = null, int $generation = 1): array
    {
        // Maximum generation reached
        if (($generation > $this->generations) || ($individual === null)) {
            return [];
        }

        $data   = $this->getIndividualData($individual, $generation);
        $family = $individual->getPrimaryChildFamily();

        if ($family === null) {
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
     * Get the raw update URL. The "xref" parameter must be the last one as the URL gets appended
     * with the clicked individual id in order to load the required chart data.
     *
     * @return string
     */
    private function getUpdateRoute(): string
    {
        return route('module', [
            'module'      => $this->getName(),
            'action'      => 'Update',
            'ged'         => $this->tree->getName(),
            'generations' => $this->generations,
            'xref'        => '',
        ]);
    }

    /**
     * Get the raw individual URL. The "xref" parameter must be the last one as the URL gets appended
     * with the clicked individual id in order to link to the right individual page.
     *
     * @return string
     */
    private function getIndividualRoute(): string
    {
        return route('individual', ['xref' => '']);
    }

    /**
     * Get the default colors based on the gender of an individual.
     *
     * @param null|Individual $individual Individual instance
     *
     * @return string HTML color code
     */
    private function getColor(Individual $individual = null): string
    {
        $genderLower = ($individual === null) ? 'u' : strtolower($individual->getSex());
        return '#' . $this->theme->parameter('chart-background-' . $genderLower);
    }

    /**
     * Get the theme defined chart font color.
     *
     * @return string HTML color code
     */
    private function getChartFontColor(): string
    {
        return '#' . $this->theme->parameter('chart-font-color');
    }
}
