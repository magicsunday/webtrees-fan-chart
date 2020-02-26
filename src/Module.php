<?php
declare(strict_types=1);

/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees\FanChart;

use Aura\Router\RouterContainer;
use Exception;
use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Localization\Translation;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Exceptions\IndividualNotFoundException;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Menu;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Module\ModuleChartInterface;
use Fisharebest\Webtrees\Module\ModuleChartTrait;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Module\ModuleCustomTrait;
use Fisharebest\Webtrees\Module\ModuleThemeInterface;
use Fisharebest\Webtrees\View;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Fan chart module class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class Module extends AbstractModule implements ModuleCustomInterface, ModuleChartInterface, RequestHandlerInterface
{
    private const ROUTE_DEFAULT     = 'webtrees-fan-chart';
    private const ROUTE_DEFAULT_URL = '/tree/{tree}/webtrees-fan-chart/{xref}';

//    private const ROUTE_UPDATE     = 'webtrees-fan-chart.update';
//    private const ROUTE_UPDATE_URL = '/tree/{tree}/webtrees-fan-chart/{xref}/update/';

    use ModuleCustomTrait;
    use ModuleChartTrait;

    /**
     * @var string
     */
    public const CUSTOM_AUTHOR = 'Rico Sonntag';

    /**
     * @var string
     */
    public const CUSTOM_VERSION = '2.0';

    /**
     * @var string
     */
    public const CUSTOM_WEBSITE = 'https://github.com/magicsunday/webtrees-fan-chart';

    /**
     * The configuration instance.
     *
     * @var Config
     */
    private $config;

    /**
     * The current theme instance.
     *
     * @var ModuleThemeInterface
     */
    private $theme;

    /**
     * Initialization.
     */
    public function boot(): void
    {
        /** @var RouterContainer $routerContainer */
        $routerContainer = app(RouterContainer::class);

        $routerContainer->getMap()
            ->get(self::ROUTE_DEFAULT, self::ROUTE_DEFAULT_URL, $this)
            ->allows(RequestMethodInterface::METHOD_POST);

//        $routerContainer->getMap()
//            ->get(self::ROUTE_UPDATE, self::ROUTE_UPDATE_URL, $this)
//            ->allows(RequestMethodInterface::METHOD_GET);

        $this->theme = app(ModuleThemeInterface::class);

        View::registerNamespace($this->name(), $this->resourcesFolder() . 'views/');
    }

    /**
     * How should this module be identified in the control panel, etc.?
     *
     * @return string
     */
    public function title(): string
    {
        return I18N::translate('Fan chart');
    }

    /**
     * A sentence describing what this module does.
     *
     * @return string
     */
    public function description(): string
    {
        return I18N::translate('A fan chart of an individual’s ancestors.');
    }

    /**
     * Where does this module store its resources
     *
     * @return string
     */
    public function resourcesFolder(): string
    {
        return __DIR__ . '/../resources/';
    }

    /**
     * Handles a request and produces a response.
     *
     * @param ServerRequestInterface $request
     *
     * @return ResponseInterface
     * @throws Exception
     */
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree       = $request->getAttribute('tree');
        $user       = $request->getAttribute('user');
        $xref       = $request->getAttribute('xref');
        $individual = Individual::getInstance($xref, $tree);

        $this->config = new Config($request);

        if ($individual === null) {
            throw new IndividualNotFoundException();
        }

        // Convert POST requests into GET requests for pretty URLs.
        if ($request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $params = (array) $request->getParsedBody();

            return redirect(route(self::ROUTE_DEFAULT, [
                'tree'               => $tree->name(),
                'xref'               => $params['xref'],
                'generations'        => $params['generations'],
                'fanDegree'          => $params['fanDegree'],
                'hideEmptySegments'  => $params['hideEmptySegments'] ?? '0',
                'showColorGradients' => $params['showColorGradients'] ?? '0',
                'innerArcs'          => $params['innerArcs'],
                'fontScale'          => $params['fontScale'],
                'showMore'           => $params['showMore'] ?? '0',
            ]));
        }

        Auth::checkIndividualAccess($individual);
        Auth::checkComponentAccess($this, 'chart', $tree, $user);

        return $this->viewResponse(
            $this->name() . '::chart',
            [
                'title'       => $this->getPageTitle($individual),
                'moduleName'  => $this->name(),
                'individual'  => $individual,
                'tree'        => $tree,
                'config'      => $this->config,
                'chartParams' => json_encode($this->getChartParameters($individual)),
                'stylesheet'  => $this->assetUrl('css/fan-chart.css'),
                'javascript'  => $this->assetUrl('js/fan-chart.min.js'),
            ]
        );
    }

    /**
     * Returns the page title.
     *
     * @param Individual $individual The individual used in the current chart
     *
     * @return string
     */
    private function getPageTitle(Individual $individual): string
    {
        $title = I18N::translate('Fan chart');

        if ($individual && $individual->canShowName()) {
            $title = I18N::translate('Fan chart of %s', $individual->fullName());
        }

        return $title;
    }

    /**
     * Collects and returns the required chart data.
     *
     * @param Individual $individual The individual used to gather the chart data
     *
     * @return string[]
     */
    private function getChartParameters(Individual $individual): array
    {
        return [
            'rtl'                => I18N::direction() === 'rtl',
            'defaultColor'       => $this->getColor(),
            'fontColor'          => $this->getChartFontColor(),
            'fanDegree'          => $this->config->getFanDegree(),
            'generations'        => $this->config->getGenerations(),
            'fontScale'          => $this->config->getFontScale(),
            'hideEmptySegments'  => $this->config->getHideEmptySegments(),
            'showColorGradients' => $this->config->getShowColorGradients(),
            'innerArcs'          => $this->config->getInnerArcs(),
            'data'               => $this->buildJsonTree($individual),
            'labels'             => [
                'zoom' => I18N::translate('Use Ctrl + scroll to zoom in the view'),
                'move' => I18N::translate('Move the view with two fingers'),
            ],
        ];
    }

    /**
     * Update action.
     *
     * @param ServerRequestInterface $request The current HTTP request
     *
     * @return ResponseInterface
     *
     * @throws Exception
     */
    public function getUpdateAction(ServerRequestInterface $request): ResponseInterface
    {
        $this->config = new Config($request);

        $tree         = $request->getAttribute('tree');
        $user         = $request->getAttribute('user');
        $xref         = $request->getQueryParams()['xref'];
        $individual   = Individual::getInstance($xref, $tree);

        Auth::checkIndividualAccess($individual);
        Auth::checkComponentAccess($this, 'chart', $tree, $user);

        return response(
            $this->buildJsonTree($individual)
        );
    }

    /**
     * Get the individual data required for display the chart.
     *
     * @param Individual $individual The start person
     * @param int        $generation The generation the person belongs to
     *
     * @return string[][]
     */
    private function getIndividualData(Individual $individual, int $generation): array
    {
        $fullName        = $this->unescapedHtml($individual->fullName());
        $alternativeName = $this->unescapedHtml($individual->alternateName());

        return [
            'id'              => 0,
            'xref'            => $individual->xref(),
            'url'             => $individual->url(),
            'updateUrl'       => $this->getUpdateRoute($individual),
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
     * @return string[][]
     */
    private function buildJsonTree(Individual $individual = null, int $generation = 1): array
    {
        // Maximum generation reached
        if (($individual === null) || ($generation > $this->config->getGenerations())) {
            return [];
        }

        $data   = $this->getIndividualData($individual, $generation);
        $family = $individual->childFamilies()->first();

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
     * @param Individual $individual
     *
     * @return string
     */
    private function getUpdateRoute(Individual $individual): string
    {
//        return route(self::ROUTE_UPDATE, [
        return route('module', [
            'module' => $this->name(),
            'action' => 'update',
            'xref'        => $individual->xref(),
            'tree'        => $individual->tree()->name(),
            'generations' => $this->config->getGenerations(),
        ]);
    }

    /**
     * CSS class for the URL.
     *
     * @return string
     */
    public function chartMenuClass(): string
    {
        return 'menu-chart-fanchart';
    }

    /**
     * Return a menu item for this chart - for use in individual boxes.
     *
     * @param Individual $individual
     *
     * @return Menu|null
     */
    public function chartBoxMenu(Individual $individual): ?Menu
    {
        return $this->chartMenu($individual);
    }

    /**
     * The title for a specific instance of this chart.
     *
     * @param Individual $individual
     *
     * @return string
     */
    public function chartTitle(Individual $individual): string
    {
        return I18N::translate('Fan chart of %s', $individual->fullName());
    }

    /**
     * A form to request the chart parameters.
     *
     * @param Individual $individual
     * @param string[]   $parameters
     *
     * @return string
     */
    public function chartUrl(Individual $individual, array $parameters = []): string
    {
        return route(self::ROUTE_DEFAULT, [
                'xref' => $individual->xref(),
                'tree' => $individual->tree()->name(),
            ] + $parameters);
    }

    /**
     * @inheritDoc
     */
    public function customModuleAuthorName(): string
    {
        return self::CUSTOM_AUTHOR;
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
     * Additional/updated translations.
     *
     * @param string $language
     *
     * @return string[]
     */
    public function customTranslations(string $language): array
    {
        $languageFile = $this->resourcesFolder() . 'lang/' . $language . '/messages.mo';
        return file_exists($languageFile) ? (new Translation($languageFile))->asArray() : [];
    }

    /**
     * Returns the unescaped HTML string.
     *
     * @param string $value The value to strip the HTML tags from
     *
     * @return null|string
     */
    public function unescapedHtml(string $value = null): ?string
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
    public function isRtl(string $text = null): bool
    {
        return $text ? I18N::scriptDirection(I18N::textScript($text)) === 'rtl' : false;
    }

    /**
     * Get the default colors based on the gender of an individual.
     *
     * @param null|Individual $individual Individual instance
     *
     * @return string HTML color code
     */
    public function getColor(Individual $individual = null): string
    {
        $genderLower = ($individual === null) ? 'u' : strtolower($individual->sex());
        return '#' . $this->theme->parameter('chart-background-' . $genderLower);
    }

    /**
     * Get the theme defined chart font color.
     *
     * @return string HTML color code
     */
    public function getChartFontColor(): string
    {
        return '#' . $this->theme->parameter('chart-font-color');
    }
}
