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
        $individual = Individual::getInstance($xref, $tree);

        $this->configuration = new Configuration($request);

        if ($individual === null) {
            throw new IndividualNotFoundException();
        }

        // Convert POST requests into GET requests for pretty URLs.
        // if ($request->getMethod() === RequestMethodInterface::METHOD_POST) {
        //     $params = (array) $request->getParsedBody();
        //
        //     return redirect(route(self::ROUTE_DEFAULT, [
        //         'tree'               => $tree->name(),
        //         'xref'               => $params['xref'],
        //         'generations'        => $params['generations'],
        //         'fanDegree'          => $params['fanDegree'],
        //         'hideEmptySegments'  => $params['hideEmptySegments'] ?? '0',
        //         'showColorGradients' => $params['showColorGradients'] ?? '0',
        //         'innerArcs'          => $params['innerArcs'],
        //         'fontScale'          => $params['fontScale'],
        //         'showMore'           => $params['showMore'] ?? '0',
        //     ]));
        // }

        Auth::checkIndividualAccess($individual);
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
                'chartParams'   => json_encode($this->getChartParameters($individual)),
                'stylesheet'    => $this->assetUrl('css/fan-chart.css'),
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

        if ($individual && $individual->canShowName()) {
            $title = I18N::translate('Fan chart of %s', $individual->fullName());
        }

        return $title;
    }

    /**
     * Collects and returns the required chart data.
     *
     * @param Individual $individual The individual used in the current chart
     *
     * @return string[]
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
        $allNames = $individual->getAllNames()[$individual->getPrimaryName()];

        // The formatted name of the individual (containing HTML)
        $full = $allNames['full'];

        // The name of the person without formatting of the individual parts of the name.
        // Remove placeholders as we do not need them in this module
        $fullNN = str_replace(['@N.N.', '@P.N.'], '', $allNames['fullNN']);

        // Extract name parts
        $preferredName   = $this->preferredName($full);
        $nickName        = $this->nickname($full);
        $lastNames       = $this->lastNames($full);
        $firstNames      = $this->firstNames($full, $lastNames, $nickName);
        $alternativeName = $this->unescapedHtml($individual->alternateName());

        return [
            'id'               => 0,
            'xref'             => $individual->xref(),
            'url'              => $individual->url(),
            'updateUrl'        => $this->getUpdateRoute($individual),
            'generation'       => $generation,
            'name'             => $fullNN,
            'firstNames'       => $firstNames,
            'lastNames'        => $lastNames,
            'preferredName'    => $preferredName,
            'alternativeNames' => array_filter(explode(' ', $alternativeName)),
            'isAltRtl'         => $this->isRtl($alternativeName),
            'sex'              => $individual->sex(),
            'born'             => $individual->getBirthYear(),
            'died'             => $individual->getDeathYear(),
            'color'            => $this->getColor($individual),
            'colors'           => [[], []],
        ];
    }

    /**
     * Returns all first names from the given full name.
     *
     * @param string   $fullName  The formatted name of the individual (containing HTML)
     * @param string[] $lastNames The list of last names of the individual
     * @param string   $nickname  The nickname of the individual if any
     *
     * @return string[]
     */
    public function firstNames(string $fullName, array $lastNames, string $nickname): array
    {
        // Remove all HTML from the formatted full name
        $fullName = $this->unescapedHtml($fullName);

        // Extract the leftover first names of the individual (removing last names and nickname)
        $firstNames = array_filter(explode(' ', $fullName));

        return array_values(array_diff($firstNames, $lastNames, [ $nickname ]));
    }

    /**
     * Returns all last names from the given full name.
     *
     * @param string $fullName The formatted name of the individual (containing HTML)
     *
     * @return string[]
     */
    public function lastNames(string $fullName): array
    {
        // Extract all last names
        $matches = [];
        preg_match_all('/<span class="SURN">(.*?)<\/span>/i', $fullName, $matches);

        return array_values(array_filter($matches[1])) ?? [];
    }

    /**
     * Returns the preferred name from the given full name.
     *
     * @param string $fullName The formatted name of the individual (containing HTML)
     *
     * @return string
     */
    public function preferredName(string $fullName): string
    {
        $matches = [];
        preg_match('/<span class="starredname">(.*?)<\/span>/i', $fullName, $matches);

        return $matches[1] ?? '';
    }

    /**
     * Returns the nickname from the given full name.
     *
     * @param string $fullName The formatted name of the individual (containing HTML)
     *
     * @return string
     */
    public function nickname(string $fullName): string
    {
        $matches = [];
        preg_match('/<q class="wt-nickname">(.*?)<\/q>/i', $fullName, $matches);

        return $matches[1] ?? '';
    }

    /**
     * Recursively build the data array of the individual ancestors.
     *
     * @param null|Individual $individual The start person
     * @param int             $generation The current generation
     *
     * @return string[][]
     */
    private function buildJsonTree(?Individual $individual, int $generation = 1): array
    {
        // Maximum generation reached
        if (($individual === null) || ($generation > $this->configuration->getGenerations())) {
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
        return route('module', [
            'module'      => $this->name(),
            'action'      => 'update',
            'xref'        => $individual->xref(),
            'tree'        => $individual->tree()->name(),
            'generations' => $this->configuration->getGenerations(),
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

    public function customModuleAuthorName(): string
    {
        return self::CUSTOM_AUTHOR;
    }


    public function customModuleVersion(): string
    {
        return self::CUSTOM_VERSION;
    }


    public function customModuleLatestVersionUrl(): string
    {
        return self::CUSTOM_WEBSITE;
    }


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
     * @param null|string $value The value to strip the HTML tags from
     *
     * @return string
     */
    public function unescapedHtml(?string $value): string
    {
        return ($value === null)
            ? ''
            : html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Returns whether the given text is in RTL style or not.
     *
     * @param null|string $text The text to check
     *
     * @return bool
     */
    public function isRtl(?string $text): bool
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
    public function getColor(?Individual $individual): string
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
