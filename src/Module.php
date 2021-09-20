<?php

/**
 * See LICENSE.md file for further details.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart;

use Aura\Router\RouterContainer;
use Exception;
use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Exceptions\IndividualNotFoundException;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Module\ModuleChartInterface;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Module\ModuleThemeInterface;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\View;
use MagicSunday\Webtrees\FanChart\Traits\IndividualTrait;
use MagicSunday\Webtrees\FanChart\Traits\ModuleChartTrait;
use MagicSunday\Webtrees\FanChart\Traits\ModuleCustomTrait;
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
    use ModuleCustomTrait;
    use ModuleChartTrait;
    use IndividualTrait;

    private const ROUTE_DEFAULT     = 'webtrees-fan-chart';
    private const ROUTE_DEFAULT_URL = '/tree/{tree}/webtrees-fan-chart/{xref}';

    /**
     * @var string
     */
    private const GITHUB_REPO = 'magicsunday/webtrees-fan-chart';

    /**
     * @var string
     */
    public const CUSTOM_AUTHOR = 'Rico Sonntag';

    /**
     * @var string
     */
    public const CUSTOM_VERSION = '2.2.2-dev';

    /**
     * @var string
     */
    public const CUSTOM_SUPPORT_URL = 'https://github.com/' . self::GITHUB_REPO . '/issues';

    /**
     * @var string
     */
    public const CUSTOM_LATEST_VERSION = 'https://api.github.com/repos/' . self::GITHUB_REPO . '/releases/latest';

    /**
     * The configuration instance.
     *
     * @var Configuration
     */
    private $configuration;

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
        $individual = Registry::individualFactory()->make($xref, $tree);

        $this->configuration = new Configuration($request);

        if ($individual === null) {
            throw new IndividualNotFoundException();
        }

        // Convert POST requests into GET requests for pretty URLs.
        // This also updates the name above the form, which wont get updated if only a POST request is used
        if ($request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $params = (array) $request->getParsedBody();

            return redirect(route(self::ROUTE_DEFAULT, [
                'tree'                    => $tree->name(),
                'xref'                    => $params['xref'],
                'generations'             => $params['generations'],
                'fanDegree'               => $params['fanDegree'] ?? '210',
                'fontScale'               => $params['fontScale'] ?? '100',
                'hideEmptySegments'       => $params['hideEmptySegments'] ?? '0',
                'showColorGradients'      => $params['showColorGradients'] ?? '0',
                'showParentMarriageDates' => $params['showParentMarriageDates'] ?? '0',
                'innerArcs'               => $params['innerArcs'] ?? '3',
            ]));
        }

        Auth::checkIndividualAccess($individual, false, true);
        Auth::checkComponentAccess($this, 'chart', $tree, $user);

        $ajaxUrl = route('module', [
            'module' => $this->name(),
            'action' => 'update',
            'tree'   => $individual->tree()->name(),
            'xref'   => '',
        ]);

        return $this->viewResponse(
            $this->name() . '::chart',
            [
                'title'         => $this->getPageTitle($individual),
                'ajaxUrl'       => $ajaxUrl,
                'moduleName'    => $this->name(),
                'individual'    => $individual,
                'tree'          => $tree,
                'configuration' => $this->configuration,
                'chartParams'   => json_encode($this->getChartParameters($individual), JSON_THROW_ON_ERROR),
                'stylesheet'    => $this->assetUrl('css/fan-chart.css'),
                'svgStylesheet' => $this->assetUrl('css/svg.css'),
                'javascript'    => $this->assetUrl('js/fan-chart.min.js'),
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

        if ($individual->canShowName()) {
            $title = I18N::translate('Fan chart of %s', $individual->fullName());
        }

        return $title;
    }

    /**
     * Collects and returns the required chart data.
     *
     * @param Individual $individual The individual used in the current chart
     *
     * @return mixed[]
     */
    private function getChartParameters(Individual $individual): array
    {
        return [
            'rtl'          => I18N::direction() === 'rtl',
            'defaultColor' => $this->getColor($individual),
            'fontColor'    => $this->getChartFontColor(),
            'labels'       => [
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
        $this->configuration = new Configuration($request);

        $tree         = $request->getAttribute('tree');
        $user         = $request->getAttribute('user');
        $xref         = $request->getQueryParams()['xref'];
        $individual   = Registry::individualFactory()->make($xref, $tree);

        Auth::checkIndividualAccess($individual, false, true);
        Auth::checkComponentAccess($this, 'chart', $tree, $user);

        return response(
            $this->buildJsonTree($individual)
        );
    }

    /**
     * Recursively build the data array of the individual ancestors.
     *
     * @param null|Individual $individual The start person
     * @param int             $generation The current generation
     *
     * @return mixed[]
     */
    private function buildJsonTree(?Individual $individual, int $generation = 1): array
    {
        // Maximum generation reached
        if (($individual === null) || ($generation > $this->configuration->getGenerations())) {
            return [];
        }

        $data = $this->getIndividualData($individual, $generation);

        /** @var null|Family $family */
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
        return route('module', [
            'module'      => $this->name(),
            'action'      => 'update',
            'xref'        => $individual->xref(),
            'tree'        => $individual->tree()->name(),
            'generations' => $this->configuration->getGenerations(),
        ]);
    }

    /**
     * Returns whether the given text is in RTL style or not.
     *
     * @param string[] $text The text to check
     *
     * @return bool
     */
    private function isRtl(array $text): bool
    {
        foreach ($text as $entry) {
            if (I18N::scriptDirection(I18N::textScript($entry)) === 'rtl') {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the default colors based on the gender of an individual.
     *
     * @param null|Individual $individual Individual instance
     *
     * @return string HTML color code
     */
    private function getColor(?Individual $individual): string
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
