<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart;

use Aura\Router\Exception\ImmutableProperty;
use Aura\Router\Exception\RouteAlreadyExists;
use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Http\Exceptions\HttpAccessDeniedException;
use Fisharebest\Webtrees\Http\Exceptions\HttpBadRequestException;
use Fisharebest\Webtrees\Http\Exceptions\HttpNotFoundException;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\FanChartModule;
use Fisharebest\Webtrees\Module\ModuleChartInterface;
use Fisharebest\Webtrees\Module\ModuleConfigInterface;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Module\ModuleThemeInterface;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\ChartService;
use Fisharebest\Webtrees\Validator;
use Fisharebest\Webtrees\View;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Traits\ModuleChartTrait;
use MagicSunday\Webtrees\FanChart\Traits\ModuleConfigTrait;
use MagicSunday\Webtrees\FanChart\Traits\ModuleCustomTrait;
use Override;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\NotFoundExceptionInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Entry point for the webtrees fan chart module. Registers the chart route, handles
 * GET/POST chart requests, builds AJAX data responses via DataFacade, and wires in
 * the module's custom translations, config page, and chart menu entries.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class Module extends FanChartModule implements ModuleCustomInterface, ModuleConfigInterface
{
    use ModuleCustomTrait;
    use ModuleChartTrait;
    use ModuleConfigTrait;

    private const string ROUTE_DEFAULT = 'webtrees-fan-chart';

    private const string ROUTE_DEFAULT_URL = '/tree/{tree}/webtrees-fan-chart/{xref}';

    private const string GITHUB_REPO = 'magicsunday/webtrees-fan-chart';

    public const string CUSTOM_AUTHOR = 'Rico Sonntag';

    public const string CUSTOM_VERSION = '3.2.0';

    public const string CUSTOM_SUPPORT_URL = 'https://github.com/' . self::GITHUB_REPO . '/issues';

    public const string CUSTOM_LATEST_VERSION = 'https://api.github.com/repos/' . self::GITHUB_REPO . '/releases/latest';

    /**
     * The configuration instance.
     */
    private Configuration $configuration;

    /**
     * @param ChartService $chartService
     * @param DataFacade   $dataFacade
     */
    public function __construct(
        ChartService $chartService,
        private DataFacade $dataFacade,
    ) {
        parent::__construct($chartService);
    }

    /**
     * Registers the chart route, allows POST on it, and registers the Blade
     * namespace and the custom chart view override.
     *
     * @throws ImmutableProperty
     * @throws RouteAlreadyExists
     */
    #[Override]
    public function boot(): void
    {
        Registry::routeFactory()
            ->routeMap()
            ->get(self::ROUTE_DEFAULT, self::ROUTE_DEFAULT_URL, $this)
            ->allows(RequestMethodInterface::METHOD_POST);

        View::registerNamespace($this->name(), $this->resourcesFolder() . 'views/');
        View::registerCustomView('::modules/charts/chart', $this->name() . '::modules/charts/chart');
    }

    /**
     * Returns the module title shown in the control panel and chart menus.
     *
     * @return string
     */
    #[Override]
    public function title(): string
    {
        return I18N::translate('Fan chart');
    }

    /**
     * Returns a short description shown in the module list in the control panel.
     *
     * @return string
     */
    #[Override]
    public function description(): string
    {
        return I18N::translate('A fan chart of an individual’s ancestors.');
    }

    /**
     * Returns the absolute path to this module's resources directory.
     *
     * @return string
     */
    #[Override]
    public function resourcesFolder(): string
    {
        return __DIR__ . '/../resources/';
    }

    /**
     * Handles the chart route. POST requests are redirected to a canonical GET URL
     * so the browser address bar always reflects the current settings. GET requests
     * render the page shell or, when the "ajax" flag is set, the inner chart partial.
     *
     * @param ServerRequestInterface $request
     *
     * @return ResponseInterface
     */
    #[Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $tree = Validator::attributes($request)->tree();
        $xref = Validator::attributes($request)->isXref()->string('xref');
        $user = Validator::attributes($request)->user();
        $ajax = Validator::queryParams($request)->boolean('ajax', false);

        $this->configuration = new Configuration($request, $this);

        // Convert POST requests into GET requests for pretty URLs.
        // This also updates the name above the form, which won't get updated if only a POST request is used
        if ($request->getMethod() === RequestMethodInterface::METHOD_POST) {
            return redirect(
                route(
                    self::ROUTE_DEFAULT,
                    [
                        'tree' => $tree->name(),
                        // xref identifies the individual, not a chart setting — read directly from POST body
                        'xref'                    => Validator::parsedBody($request)->string('xref', ''),
                        'generations'             => $this->configuration->getGenerations(),
                        'fanDegree'               => $this->configuration->getFanDegree(),
                        'fontScale'               => $this->configuration->getFontScale(),
                        'hideEmptySegments'       => $this->configuration->getHideEmptySegments() ? '1' : '0',
                        'showFamilyColors'        => $this->configuration->getShowFamilyColors() ? '1' : '0',
                        'showPlaces'              => $this->configuration->getShowPlaces() ? '1' : '0',
                        'placeParts'              => $this->configuration->getPlaceParts(),
                        'showParentMarriageDates' => $this->configuration->getShowParentMarriageDates() ? '1' : '0',
                        'showImages'              => $this->configuration->getShowImages() ? '1' : '0',
                        'showNames'               => $this->configuration->getShowNames() ? '1' : '0',
                        'innerArcs'               => $this->configuration->getInnerArcs(),
                        'paternalColor'           => $this->configuration->getPaternalColor(),
                        'maternalColor'           => $this->configuration->getMaternalColor(),
                        'detailedDateGenerations' => $this->configuration->getDetailedDateGenerations(),
                    ]
                )
            );
        }

        Auth::checkComponentAccess($this, ModuleChartInterface::class, $tree, $user);

        $individual = Registry::individualFactory()->make($xref, $tree);
        $individual = Auth::checkIndividualAccess($individual, false, true);

        if ($ajax) {
            $this->layout = $this->name() . '::layouts/ajax';

            return $this->viewResponse(
                $this->name() . '::modules/fan-chart/chart',
                [
                    'id'                => uniqid(),
                    'data'              => $this->dataFacade->createTreeStructure($this, $this->configuration, $individual),
                    'configuration'     => $this->configuration,
                    'chartParams'       => $this->getChartParameters($individual),
                    'exportStylesheets' => $this->getExportStylesheets(),
                    'stylesheets'       => $this->getStylesheets(),
                    'javascript'        => $this->assetUrl('js/fan-chart-' . self::CUSTOM_VERSION . '.min.js'),
                ]
            );
        }

        return $this->viewResponse(
            $this->name() . '::modules/fan-chart/page',
            [
                'ajaxUrl'       => $this->getAjaxRoute($individual, $xref),
                'title'         => $this->getPageTitle($individual),
                'moduleName'    => $this->name(),
                'individual'    => $individual,
                'tree'          => $tree,
                'configuration' => $this->configuration,
                'stylesheets'   => $this->getStylesheets(),
                'javascript'    => $this->assetUrl('js/fan-chart-storage.min.js'),
            ]
        );
    }

    /**
     * Returns the localised page title. Falls back to the generic "Fan chart" label
     * when the individual's name is hidden by privacy settings.
     *
     * @param Individual $individual
     *
     * @return string
     */
    private function getPageTitle(Individual $individual): string
    {
        if ($individual->canShowName()) {
            return I18N::translate('Fan chart of %s', $individual->fullName());
        }

        return I18N::translate('Fan chart');
    }

    /**
     * Returns the static chart parameters passed to the JavaScript initialiser —
     * RTL direction flag, image/silhouette visibility, and localised UI labels.
     *
     * @param Individual $individual
     *
     * @return array<string, bool|array<string, string>>
     */
    private function getChartParameters(Individual $individual): array
    {
        return [
            'rtl'             => I18N::direction() === 'rtl',
            'showImages'      => $this->showImages($individual),
            'showSilhouettes' => $this->showSilhouettes($individual),
            'labels'          => [
                'zoom' => I18N::translate('Use Ctrl + scroll to zoom in the view'),
                'move' => I18N::translate('Move the view with two fingers'),
            ],
        ];
    }

    /**
     * Builds the AJAX chart URL embedded in the page shell. The JavaScript uses
     * this URL to fetch the chart partial after the page has loaded.
     *
     * @param Individual $individual
     * @param string     $xref
     *
     * @return string
     */
    private function getAjaxRoute(
        Individual $individual,
        string $xref,
    ): string {
        return $this->chartUrl(
            $individual,
            [
                'ajax'                    => true,
                'generations'             => $this->configuration->getGenerations(),
                'detailedDateGenerations' => $this->configuration->getDetailedDateGenerations(),
                'showPlaces'              => $this->configuration->getShowPlaces(),
                'placeParts'              => $this->configuration->getPlaceParts(),
                'xref'                    => $xref,
            ]
        );
    }

    /**
     * Returns true when highlight images are enabled for the tree and the individual is visible.
     *
     * @param Individual $individual
     *
     * @return bool
     */
    private function showImages(Individual $individual): bool
    {
        return $individual->canShow()
            && ($individual->tree()->getPreference('SHOW_HIGHLIGHT_IMAGES') === '1');
    }

    /**
     * Returns true when silhouette placeholders should be shown as a fallback when
     * the individual has no highlight image. Requires showImages() to also be true.
     *
     * @param Individual $individual
     *
     * @return bool
     */
    private function showSilhouettes(Individual $individual): bool
    {
        return $this->showImages($individual)
            && ($individual->tree()->getPreference('USE_SILHOUETTE') === '1');
    }

    /**
     * AJAX action called by the JavaScript when the user clicks an ancestor to re-root the chart.
     * Validates access, rebuilds the tree structure for the new individual, and returns JSON.
     *
     * @param ServerRequestInterface $request
     *
     * @return ResponseInterface
     *
     * @throws HttpBadRequestException
     * @throws HttpAccessDeniedException
     * @throws HttpNotFoundException
     */
    public function getUpdateAction(ServerRequestInterface $request): ResponseInterface
    {
        $this->configuration = new Configuration($request, $this);

        $tree = Validator::attributes($request)->tree();
        $user = Validator::attributes($request)->user();
        $xref = Validator::queryParams($request)->isXref()->string('xref');

        Auth::checkComponentAccess($this, ModuleChartInterface::class, $tree, $user);

        $individual = Registry::individualFactory()->make($xref, $tree);
        $individual = Auth::checkIndividualAccess($individual, false, true);

        return response([
            'title' => $this->getPageTitle($individual),
            'data'  => $this->dataFacade->createTreeStructure($this, $this->configuration, $individual),
        ]);
    }

    /**
     * Returns the asset URLs of the module's own stylesheets.
     *
     * @return array<string>
     */
    private function getStylesheets(): array
    {
        return [
            $this->assetUrl('css/fan-chart.css'),
            $this->assetUrl('css/svg.css'),
        ];
    }

    /**
     * Returns the stylesheets that must be inlined during SVG/PNG export —
     * the active webtrees theme sheets plus the module's SVG-specific stylesheet.
     *
     * @return array<string>
     *
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     */
    private function getExportStylesheets(): array
    {
        /** @var ModuleThemeInterface $currentTheme */
        $currentTheme  = Registry::container()->get(ModuleThemeInterface::class);
        $stylesheets   = $currentTheme->stylesheets();
        $stylesheets[] = $this->assetUrl('css/svg.css');

        return $stylesheets;
    }
}
