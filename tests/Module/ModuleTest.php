<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Tests\Module;

use Fisharebest\Webtrees\Contracts\ContainerInterface;
use Fisharebest\Webtrees\Contracts\RouteFactoryInterface;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Tree;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Module;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

#[CoversClass(Module::class)]
final class ModuleTest extends TestCase
{
    public function testTraitHelpersExposeExpectedValues(): void
    {
        $routeFactory = new class implements RouteFactoryInterface {
            public function route(string $route_name, array $parameters = []): string
            {
                return '/route/' . $route_name . '?' . http_build_query($parameters);
            }

            public function routeMap(): \Aura\Router\Map
            {
                return new \Aura\Router\Map(new \Aura\Router\Route());
            }
        };

        $container = new class($routeFactory) implements ContainerInterface {
            public function __construct(private readonly RouteFactoryInterface $routeFactory)
            {
            }

            public function get(string $id): mixed
            {
                return $this->routeFactory;
            }

            public function has(string $id): bool
            {
                return $id === RouteFactoryInterface::class;
            }

            public function set(string $id, object $object): static
            {
                return $this;
            }
        };

        \Fisharebest\Webtrees\Registry::routeFactory($routeFactory);
        \Fisharebest\Webtrees\Registry::container($container);

        $chartService = $this->createMock(\Fisharebest\Webtrees\Services\ChartService::class);
        $module       = new Module($chartService, new DataFacade());
        $individual   = $this->createMock(Individual::class);
        $tree         = $this->createMock(Tree::class);

        $locale     = \Fisharebest\Localization\Locale::create('en');
        $translator = new \Fisharebest\Localization\Translator([], $locale->pluralRule());

        $localeProperty = new ReflectionProperty(I18N::class, 'locale');
        $localeProperty->setAccessible(true);
        $localeProperty->setValue($locale);

        $translatorProperty = new ReflectionProperty(I18N::class, 'translator');
        $translatorProperty->setAccessible(true);
        $translatorProperty->setValue($translator);

        $individual->method('fullName')->willReturn('Example Person');
        $individual->method('xref')->willReturn('I1');
        $individual->method('tree')->willReturn($tree);
        $tree->method('name')->willReturn('main');

        self::assertSame('menu-chart-fanchart', $module->chartMenuClass());
        self::assertStringContainsString('Example Person', $module->chartTitle($individual));
        self::assertStringContainsString('/route/webtrees-fan-chart?', $module->chartUrl($individual));
        self::assertSame(Module::CUSTOM_AUTHOR, $module->customModuleAuthorName());
        self::assertSame(Module::CUSTOM_VERSION, $module->customModuleVersion());
        self::assertSame(Module::CUSTOM_SUPPORT_URL, $module->customModuleSupportUrl());
        self::assertSame(Module::CUSTOM_LATEST_VERSION, $module->customModuleLatestVersionUrl());
        self::assertSame([], $module->customTranslations('zz'));
    }
}
