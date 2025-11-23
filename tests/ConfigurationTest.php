<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test;

use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Localization\Locale;
use Fisharebest\Localization\Translator;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Services\ChartService;
use GuzzleHttp\Psr7\ServerRequest;
use Illuminate\Database\Schema\Blueprint;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Module;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

#[CoversClass(Configuration::class)]
/**
 * Verifies that configuration handling honors defaults, validation, and selectable ranges.
 */
final class ConfigurationTest extends TestCase
{
    /**
     * Ensures locale and translator are initialised before each test.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $locale     = Locale::create('en');
        $translator = new Translator([], $locale->pluralRule());

        $localeProperty = new ReflectionProperty(I18N::class, 'locale');
        $localeProperty->setValue(null, $locale);

        $translatorProperty = new ReflectionProperty(I18N::class, 'translator');
        $translatorProperty->setValue(null, $translator);
    }

    /**
     * Ensures GET requests fall back to configured defaults when parameters are absent.
     */
    #[Test]
    public function queriesUseDefaultsWhenMissingParameters(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $module = $this->createModuleWithPreferences([
            'default_generations'             => '8',
            'default_fontScale'               => '125',
            'default_fanDegree'               => '270',
            'default_hideEmptySegments'       => '1',
            'default_showColorGradients'      => '1',
            'default_showParentMarriageDates' => '1',
            'default_innerArcs'               => '2',
            'default_hideSvgExport'           => '1',
            'default_hidePngExport'           => '1',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(8, $configuration->getGenerations());
        self::assertSame(125, $configuration->getFontScale());
        self::assertSame(270, $configuration->getFanDegree());
        self::assertTrue($configuration->getHideEmptySegments());
        self::assertTrue($configuration->getShowColorGradients());
        self::assertTrue($configuration->getShowParentMarriageDates());
        self::assertSame(2, $configuration->getInnerArcs());
        self::assertTrue($configuration->getHideSvgExport());
        self::assertTrue($configuration->getHidePngExport());
    }

    /**
     * Ensures POSTed values are validated against allowed ranges and sanitised.
     */
    #[Test]
    public function postRequestsAreValidatedAgainstRanges(): void
    {
        $request = new ServerRequest(
            RequestMethodInterface::METHOD_POST,
            '/',
            [],
            null,
            '1.1'
        );

        $request = $request->withParsedBody([
            'generations'             => '4',
            'fontScale'               => '140',
            'fanDegree'               => '300',
            'hideEmptySegments'       => '1',
            'showColorGradients'      => '1',
            'showParentMarriageDates' => '1',
            'innerArcs'               => '1',
            'hideSvgExport'           => '0',
            'hidePngExport'           => '1',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_generations'             => '6',
            'default_fontScale'               => '100',
            'default_fanDegree'               => '210',
            'default_hideEmptySegments'       => '0',
            'default_showColorGradients'      => '0',
            'default_showParentMarriageDates' => '0',
            'default_innerArcs'               => '3',
            'default_hideSvgExport'           => '0',
            'default_hidePngExport'           => '0',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(4, $configuration->getGenerations());
        self::assertSame(140, $configuration->getFontScale());
        self::assertSame(300, $configuration->getFanDegree());
        self::assertTrue($configuration->getHideEmptySegments());
        self::assertTrue($configuration->getShowColorGradients());
        self::assertTrue($configuration->getShowParentMarriageDates());
        self::assertSame(1, $configuration->getInnerArcs());
        self::assertFalse($configuration->getHideSvgExport());
        self::assertTrue($configuration->getHidePngExport());
    }

    /**
     * Confirms list getters expose complete ranges derived from default configuration.
     */
    #[Test]
    public function selectableListsReflectDefinedRanges(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $module = $this->createModuleWithPreferences([
            'default_generations' => '6',
            'default_fontScale'   => '100',
            'default_fanDegree'   => '210',
            'default_innerArcs'   => '3',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertCount(9, $configuration->getGenerationsList());
        self::assertSame('2', $configuration->getGenerationsList()[2]);
        self::assertSame('10', $configuration->getGenerationsList()[10]);
        self::assertCount(6, $configuration->getInnerArcsList());
        self::assertSame('0', $configuration->getInnerArcsList()[0]);
        self::assertSame('5', $configuration->getInnerArcsList()[5]);
    }

    /**
     * Creates a module instance prepopulated with the provided preferences.
     *
     * @param array<string, string> $preferences
     */
    private function createModuleWithPreferences(array $preferences): Module
    {
        static $initialised = false;

        if ($initialised === false) {
            $database = new DB();
            $database->addConnection([
                'driver'   => 'sqlite',
                'database' => ':memory:',
            ]);
            $database->setAsGlobal();
            $database->bootEloquent();
            DB::connection()->getSchemaBuilder()->create('module_setting', static function (Blueprint $table): void {
                $table->string('module_name');
                $table->string('setting_name');
                $table->string('setting_value');
            });

            $initialised = true;
        }

        DB::table('module_setting')->delete();
        DB::table('module_setting')->insert(
            array_map(
                static fn (string $name, string $value): array => [
                    'module_name'   => 'webtrees-fan-chart',
                    'setting_name'  => $name,
                    'setting_value' => $value,
                ],
                array_keys($preferences),
                $preferences
            )
        );

        $chartService = $this->createMock(ChartService::class);
        $module       = new Module($chartService, new DataFacade());

        $reflection = new ReflectionProperty(AbstractModule::class, 'name');
        $reflection->setValue($module, 'webtrees-fan-chart');

        return $module;
    }
}
