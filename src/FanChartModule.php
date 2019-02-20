<?php
declare(strict_types=1);

/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees\FanChart;

use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\Exceptions\IndividualAccessDeniedException;
use Fisharebest\Webtrees\Exceptions\IndividualNotFoundException;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\FanChartModule as WebtreesFanChartModule;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Module\ModuleThemeInterface;
use Fisharebest\Webtrees\Services\ChartService;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\View;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fan chart module class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
class FanChartModule extends WebtreesFanChartModule implements ModuleCustomInterface
{
    /**
     * @var string
     */
    public const CUSTOM_VERSION = '2.0';

    /**
     * @var string
     */
    public const CUSTOM_WEBSITE = 'https://github.com/magicsunday/ancestral-fan-chart';

    /**
     * The current theme instance.
     *
     * @var ModuleThemeInterface
     */
    private $theme;

    /**
     * The current tree instance.
     *
     * @var Tree
     */
    private $tree;

    /**
     * The configuration instance.
     *
     * @var Config
     */
    private $config;

    /**
     * The module base directory.
     *
     * @var string
     */
    private $moduleDirecotry;

    /**
     * Constructor.
     *
     * @param string $moduleDirectory The module base directory
     */
    public function __construct(string $moduleDirectory)
    {
        $this->moduleDirecotry = $moduleDirectory;
    }

    /**
     * Boostrap.
     *
     * @param UserInterface $user A user (or visitor) object.
     * @param Tree|null     $tree Note that $tree can be null (if all trees are private).
     */
    public function boot(UserInterface $user, ?Tree $tree): void
    {
        // The boot() function is called after the framework has been booted.
        if (($tree !== null) && !Auth::isAdmin($user)) {
            return;
        }

        // Here is also a good place to register any views (templates) used by the module.
        // This command allows the module to use: view($this->name() . '::', 'fish')
        // to access the file ./resources/views/fish.phtml
        View::registerNamespace($this->name(), $this->moduleDirecotry . '/resources/views/');
    }

    /**
     * @inheritDoc
     */
    public function customModuleAuthorName(): string
    {
        return 'Rico Sonntag';
    }

    /**
     * @inheritDoc
     */
    public function customModuleVersion(): string
    {
        return self::CUSTOM_VERSION;
    }

    /**
     * @inheritDoc
     */
    public function customModuleLatestVersionUrl(): string
    {
        return self::CUSTOM_WEBSITE;
    }

    /**
     * @inheritDoc
     */
    public function customModuleSupportUrl(): string
    {
        return self::CUSTOM_WEBSITE;
    }

    /**
     * @inheritDoc
     *
     * @throws IndividualNotFoundException
     * @throws IndividualAccessDeniedException
     */
    public function getChartAction(
        Request $request,
        Tree $tree,
        UserInterface $user,
        ChartService $chart_service
    ): Response {
        $this->config = new Config($request, $tree);
        $this->theme  = app()->make(ModuleThemeInterface::class);
        $this->tree   = $tree;

        $xref       = $request->get('xref');
        $individual = Individual::getInstance($xref, $this->tree);

        Auth::checkIndividualAccess($individual);
        Auth::checkComponentAccess($this, 'chart', $tree, $user);

        $title = I18N::translate('Ancestral fan chart');

        if ($individual && $individual->canShowName()) {
            $title = I18N::translate('Ancestral fan chart of %s', $individual->fullName());
        }

        $chartParams = [
            'rtl'                => I18N::direction() === 'rtl',
            'defaultColor'       => $this->getColor(),
            'fontColor'          => $this->getChartFontColor(),
            'fanDegree'          => $this->config->getFanDegree(),
            'generations'        => $this->config->getGenerations(),
            'fontScale'          => $this->config->getFontScale(),
            'hideEmptySegments'  => $this->config->getHideEmptySegments(),
            'showColorGradients' => $this->config->getShowColorGradients(),
            'updateUrl'          => $this->getUpdateRoute(),
            'individualUrl'      => $this->getIndividualRoute(),
            'data'               => $this->buildJsonTree($individual),
            'labels'             => [
                'zoom' => I18N::translate('Use Ctrl + scroll to zoom in the view'),
                'move' => I18N::translate('Move the view with two fingers'),
            ],
        ];

        return $this->viewResponse(
            $this->name() . '::chart',
            [
                'rtl'         => I18N::direction() === 'rtl',
                'title'       => $title,
                'moduleName'  => $this->name(),
                'individual'  => $individual,
                'tree'        => $this->tree,
                'fanDegrees'  => $this->getFanDegrees(),
                'config'      => $this->config,
                'chartParams' => json_encode($chartParams),
            ]
        );
    }

    /**
     * Update action.
     *
     * @param Request       $request The current HTTP request
     * @param Tree          $tree    The current tree
     * @param UserInterface $user    The current user
     * @param Config        $config  The module configuration
     *
     * @return Response
     *
     * @throws IndividualNotFoundException
     * @throws IndividualAccessDeniedException
     */
    public function getUpdateAction(Request $request, Tree $tree, UserInterface $user, Config $config): Response
    {
        $this->config = $config;
        $this->theme  = app()->make(ModuleThemeInterface::class);
        $this->tree   = $tree;

        $xref       = $request->get('xref');
        $individual = Individual::getInstance($xref, $tree);

        Auth::checkIndividualAccess($individual);
        Auth::checkComponentAccess($this, 'chart', $tree, $user);

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
    private function unescapedHtml(string $value = null): ?string
    {
        return ($value === null) ? $value : html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
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
        $fullName        = $this->unescapedHtml($individual->fullName());
        $alternativeName = $this->unescapedHtml($individual->alternateName());

        return [
            'id'              => 0,
            'xref'            => $individual->xref(),
            'generation'      => $generation,
            'name'            => $fullName,
            'alternativeName' => $alternativeName,
            'isAltRtl'        => $this->isRtl($alternativeName),
            'sex'             => $individual->sex(),
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
        if (($individual === null) || ($generation > $this->config->getGenerations())) {
            return [];
        }

        $data   = $this->getIndividualData($individual, $generation);
        $family = $individual->primaryChildFamily();

        if ($family === null) {
            return $data;
        }

        // Recursively call the method for the parents of the individual
        $fatherTree = $this->buildJsonTree($family->husband(), $generation + 1);
        $motherTree = $this->buildJsonTree($family->wife(), $generation + 1);

        // Add array of child nodes
        if (!empty($fatherTree)) {
            $data['children'][] = $fatherTree;
        }

        if (!empty($motherTree)) {
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
            'module'      => $this->name(),
            'action'      => 'Update',
            'ged'         => $this->tree->name(),
            'generations' => $this->config->getGenerations(),
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
        $genderLower = ($individual === null) ? 'u' : strtolower($individual->sex());
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
