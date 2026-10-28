<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Module;

use Aura\Router\Map;
use Aura\Router\Route;
use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Webtrees\Contracts\ContainerInterface;
use Fisharebest\Webtrees\Contracts\RouteFactoryInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\ChartService;
use Fisharebest\Webtrees\Tree;
use GuzzleHttp\Psr7\HttpFactory;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\FanChart\Test\Support\EnglishLocaleFixture;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseFactoryInterface;

use function in_array;
use function ksort;

/**
 * Validates module metadata exposure and chart helpers.
 */
#[CoversClass(Module::class)]
#[UsesClass(Configuration::class)]
final class ModuleTest extends TestCase
{
    use ModuleSettingsFixtureTrait;

    /**
     * Ensures trait-provided helpers return expected metadata and URLs.
     */
    #[Test]
    public function traitHelpersExposeExpectedValues(): void
    {
        $this->registerRouteFactory();

        $chartService = self::createStub(ChartService::class);
        $module       = new Module($chartService, new DataFacade());
        $individual   = self::createStub(Individual::class);
        $tree         = self::createStub(Tree::class);

        EnglishLocaleFixture::install();

        $individual->method('fullName')->willReturn('Example Person');
        $individual->method('xref')->willReturn('I1');
        $individual->method('tree')->willReturn($tree);
        $tree->method('name')->willReturn('main');

        self::assertSame('menu-chart-fanchart', $module->chartMenuClass());
        self::assertStringContainsString('Example Person', $module->chartTitle($individual));
        self::assertStringContainsString('/route/webtrees-fan-chart?', $module->chartUrl($individual));
    }

    /**
     * Pins that saving the administration form stores the posted place format
     * as the default of the chart.
     */
    #[Test]
    public function adminFormStoresThePostedPlaceFormat(): void
    {
        $this->registerRouteFactory();
        EnglishLocaleFixture::install();

        $module = $this->createModuleWithPreferences(['default_placeFormat' => 'full']);

        $module->postAdminAction(
            (new ServerRequest(RequestMethodInterface::METHOD_POST, '/'))
                ->withParsedBody(['placeFormat' => 'city-iso3'])
        );

        self::assertSame('city-iso3', $module->getPreference('default_placeFormat'));
    }

    /**
     * Pins that saving the administration form stores the detail panel option
     * as the default of the chart.
     */
    #[Test]
    public function adminFormStoresThePanelDefault(): void
    {
        $this->registerRouteFactory();
        EnglishLocaleFixture::install();

        $module = $this->createModuleWithPreferences([]);

        $module->postAdminAction(
            (new ServerRequest(RequestMethodInterface::METHOD_POST, '/'))
                ->withParsedBody(['showDetailPanel' => '1'])
        );

        $stored = new Configuration(new ServerRequest(RequestMethodInterface::METHOD_GET, '/'), $module);

        self::assertSame('1', $module->getPreference('default_showDetailPanel'));
        self::assertTrue($stored->getShowDetailPanel());
    }

    /**
     * Pins that saving the administration form with the switch off takes the panel
     * default back. The form submits a hidden zero for an unchecked box.
     */
    #[Test]
    public function adminFormTakesThePanelDefaultBackWhenTheSwitchIsOff(): void
    {
        $this->registerRouteFactory();
        EnglishLocaleFixture::install();

        $module = $this->createModuleWithPreferences(['default_showDetailPanel' => '1']);

        $module->postAdminAction(
            (new ServerRequest(RequestMethodInterface::METHOD_POST, '/'))
                ->withParsedBody(['showDetailPanel' => '0'])
        );

        $stored = new Configuration(new ServerRequest(RequestMethodInterface::METHOD_GET, '/'), $module);

        self::assertFalse($stored->getShowDetailPanel());
    }

    /**
     * Pins that saving the administration form stores every default of the chart
     * with its default value, also when the form submits nothing, so a default can
     * neither be dropped from the saved set nor stored with a value that differs
     * from its default. Settings that share the same default value are not told
     * apart from each other by this test.
     */
    #[Test]
    public function adminFormStoresEveryDefaultOfTheChart(): void
    {
        $this->registerRouteFactory();
        EnglishLocaleFixture::install();

        $module = $this->createModuleWithPreferences([]);

        $module->postAdminAction(new ServerRequest(RequestMethodInterface::METHOD_POST, '/'));

        $stored = DB::table('module_setting')
            ->where('module_name', '=', 'webtrees-fan-chart')
            ->pluck('setting_value', 'setting_name')
            ->all();

        ksort($stored);

        self::assertSame(
            [
                'default_detailedDateGenerations' => '0',
                'default_fanDegree'               => '210',
                'default_fontScale'               => '100',
                'default_generations'             => '6',
                'default_hideEmptySegments'       => '1',
                'default_hidePngExport'           => '',
                'default_hideSvgExport'           => '',
                'default_innerArcs'               => '3',
                'default_maternalColor'           => '#d06f94',
                'default_nameAbbreviation'        => 'AUTO',
                'default_paternalColor'           => '#70a9cf',
                'default_placeFormat'             => 'auto',
                'default_showDescendants'         => '',
                'default_showDetailPanel'         => '',
                'default_showFamilyColors'        => '1',
                'default_showImages'              => '',
                'default_showNames'               => '1',
                'default_showNicknames'           => '',
                'default_showParentMarriageDates' => '',
                'default_showPlaces'              => '',
            ],
            $stored
        );
    }

    /**
     * Registers a route factory that renders a route as its name and query.
     */
    private function registerRouteFactory(): void
    {
        $routeFactory = new class implements RouteFactoryInterface {
            public function route(string $route_name, array $parameters = []): string
            {
                return '/route/' . $route_name . '?' . http_build_query($parameters);
            }

            public function routeMap(): Map
            {
                return new Map(new Route());
            }
        };

        $container = new readonly class($routeFactory, new HttpFactory()) implements ContainerInterface {
            public function __construct(
                private RouteFactoryInterface $routeFactory,
                private ResponseFactoryInterface $responseFactory,
            ) {
            }

            public function get(string $id): object
            {
                return $id === ResponseFactoryInterface::class ? $this->responseFactory : $this->routeFactory;
            }

            public function has(string $id): bool
            {
                return in_array($id, [RouteFactoryInterface::class, ResponseFactoryInterface::class], true);
            }

            public function set(string $id, object $object): static
            {
                return $this;
            }
        };

        Registry::routeFactory($routeFactory);
        Registry::container($container);
    }
}
