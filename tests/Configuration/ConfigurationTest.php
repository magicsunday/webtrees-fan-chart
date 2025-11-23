<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Tests\Configuration;

use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Webtrees\DB;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Module;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

#[CoversClass(Configuration::class)]
final class ConfigurationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $locale     = \Fisharebest\Localization\Locale::create('en');
        $translator = new \Fisharebest\Localization\Translator([], $locale->pluralRule());

        $localeProperty = new ReflectionProperty(\Fisharebest\Webtrees\I18N::class, 'locale');
        $localeProperty->setAccessible(true);
        $localeProperty->setValue($locale);

        $translatorProperty = new ReflectionProperty(\Fisharebest\Webtrees\I18N::class, 'translator');
        $translatorProperty->setAccessible(true);
        $translatorProperty->setValue($translator);
    }

    public function testQueriesUseDefaultsWhenMissingParameters(): void
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

    public function testPostRequestsAreValidatedAgainstRanges(): void
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

    public function testSelectableListsReflectDefinedRanges(): void
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
            DB::connection()->getSchemaBuilder()->create('module_setting', static function (\Illuminate\Database\Schema\Blueprint $table): void {
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

        $chartService = $this->createMock(\Fisharebest\Webtrees\Services\ChartService::class);
        $module       = new Module($chartService, new DataFacade());

        $reflection = new ReflectionProperty(\Fisharebest\Webtrees\Module\AbstractModule::class, 'name');
        $reflection->setAccessible(true);
        $reflection->setValue($module, 'webtrees-fan-chart');

        return $module;
    }
}
