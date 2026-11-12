<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Module;

use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Services\ChartService;
use Fisharebest\Webtrees\Tree;
use GuzzleHttp\Psr7\HttpFactory;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\ModuleBase\Testing\EnglishLocaleFixture;
use MagicSunday\Webtrees\ModuleBase\Testing\RoutingFixture;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseFactoryInterface;

use function ksort;
use function sort;
use function view;

/**
 * Validates module metadata exposure and chart helpers.
 */
#[CoversClass(Module::class)]
#[UsesClass(Configuration::class)]
final class ModuleTest extends TestCase
{
    use ModuleSettingsFixtureTrait;

    /**
     * Registers the routing that every test of the module needs, also in the process of a test
     * that runs separately.
     */
    protected function setUp(): void
    {
        parent::setUp();

        RoutingFixture::register([ResponseFactoryInterface::class => new HttpFactory()]);
    }

    /**
     * Ensures trait-provided helpers return expected metadata and URLs.
     */
    #[Test]
    public function traitHelpersExposeExpectedValues(): void
    {
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
     * Pins that booting the module makes the shared views of module-base renderable under their
     * own namespace. The registration is static state, so the test runs in a process of its own,
     * where nothing else has registered the namespace.
     */
    #[Test]
    #[RunInSeparateProcess]
    #[PreserveGlobalState(false)]
    public function bootRegistersTheSharedViewsOfTheModuleBase(): void
    {
        EnglishLocaleFixture::install();

        $module = new Module(self::createStub(ChartService::class), new DataFacade());
        $module->setName('webtrees-fan-chart');
        $module->boot();

        $markup = view('webtrees-module-base::help-popover', [
            'id'         => 'booted-help-popover',
            'label'      => 'Show help',
            'rows'       => [['key' => 'Tab key', 'text' => 'Move between the persons']],
            'activeMode' => null,
        ]);

        self::assertStringContainsString('id="booted-help-popover"', $markup);
    }

    /**
     * The chart is reachable on the pretty URL of a person and accepts the form post that the options
     * form sends to that same URL. A route that moves or that lost the post would break bookmarks,
     * the links of the chart menu and the options form.
     */
    #[Test]
    public function bootRegistersTheChartRouteForGetAndPost(): void
    {
        $routeMap = RoutingFixture::register([ResponseFactoryInterface::class => new HttpFactory()]);

        $module = new Module(self::createStub(ChartService::class), new DataFacade());
        $module->setName('webtrees-fan-chart');
        $module->boot();

        $route = $routeMap->getRoute('webtrees-fan-chart');

        self::assertSame('/tree/{tree}/webtrees-fan-chart/{xref}', $route->path);

        $methods = $route->allows;

        sort($methods);

        self::assertSame([RequestMethodInterface::METHOD_GET, RequestMethodInterface::METHOD_POST], $methods);
    }

    /**
     * Pins that saving the administration form stores the posted place format
     * as the default of the chart.
     */
    #[Test]
    public function adminFormStoresThePostedPlaceFormat(): void
    {
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
}
