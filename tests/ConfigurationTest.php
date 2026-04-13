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

/**
 * Verifies that configuration handling honors defaults, validation, and selectable ranges.
 */
#[CoversClass(Configuration::class)]
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
            'default_showFamilyColors'        => '1',
            'default_showParentMarriageDates' => '1',
            'default_showPlaces'              => '1',
            'default_placeParts'              => '2',
            'default_showImages'              => '1',
            'default_showNames'               => '0',
            'default_innerArcs'               => '2',
            'default_hideSvgExport'           => '1',
            'default_hidePngExport'           => '1',
            'default_detailedDateGenerations' => '5',
            'default_paternalColor'           => '#aabbcc',
            'default_maternalColor'           => '#ddeeff',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(8, $configuration->getGenerations());
        self::assertSame(125, $configuration->getFontScale());
        self::assertSame(270, $configuration->getFanDegree());
        self::assertTrue($configuration->getHideEmptySegments());
        self::assertTrue($configuration->getShowFamilyColors());
        self::assertTrue($configuration->getShowParentMarriageDates());
        self::assertTrue($configuration->getShowPlaces());
        self::assertSame(2, $configuration->getPlaceParts());
        self::assertTrue($configuration->getShowImages());
        self::assertFalse($configuration->getShowNames());
        self::assertSame(2, $configuration->getInnerArcs());
        self::assertTrue($configuration->getHideSvgExport());
        self::assertTrue($configuration->getHidePngExport());
        self::assertSame(5, $configuration->getDetailedDateGenerations());
        self::assertSame('#aabbcc', $configuration->getPaternalColor());
        self::assertSame('#ddeeff', $configuration->getMaternalColor());
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
            'showFamilyColors'        => '1',
            'showPlaces'              => '1',
            'placeParts'              => '2',
            'showParentMarriageDates' => '1',
            'showImages'              => '1',
            'showNames'               => '0',
            'innerArcs'               => '1',
            'hideSvgExport'           => '0',
            'hidePngExport'           => '1',
            'detailedDateGenerations' => '4',
            'paternalColor'           => '#112233',
            'maternalColor'           => '#445566',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_generations'             => '6',
            'default_fontScale'               => '100',
            'default_fanDegree'               => '210',
            'default_hideEmptySegments'       => '0',
            'default_showFamilyColors'        => '0',
            'default_showPlaces'              => '0',
            'default_placeParts'              => '1',
            'default_showParentMarriageDates' => '0',
            'default_showImages'              => '0',
            'default_showNames'               => '1',
            'default_innerArcs'               => '3',
            'default_hideSvgExport'           => '0',
            'default_hidePngExport'           => '0',
            'default_detailedDateGenerations' => '3',
            'default_paternalColor'           => '#70a9cf',
            'default_maternalColor'           => '#d06f94',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(4, $configuration->getGenerations());
        self::assertSame(140, $configuration->getFontScale());
        self::assertSame(300, $configuration->getFanDegree());
        self::assertTrue($configuration->getHideEmptySegments());
        self::assertTrue($configuration->getShowFamilyColors());
        self::assertTrue($configuration->getShowPlaces());
        self::assertSame(2, $configuration->getPlaceParts());
        self::assertTrue($configuration->getShowParentMarriageDates());
        self::assertTrue($configuration->getShowImages());
        self::assertFalse($configuration->getShowNames());
        self::assertSame(1, $configuration->getInnerArcs());
        self::assertFalse($configuration->getHideSvgExport());
        self::assertTrue($configuration->getHidePngExport());
        self::assertSame(4, $configuration->getDetailedDateGenerations());
        self::assertSame('#112233', $configuration->getPaternalColor());
        self::assertSame('#445566', $configuration->getMaternalColor());
    }

    /**
     * Ensures placeParts values outside the allowed range 0-3 fall back to the default.
     */
    #[Test]
    public function placePartsOutOfRangeFallsBackToDefault(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams(['placeParts' => '4']);

        $module = $this->createModuleWithPreferences([
            'default_placeParts' => '1',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(1, $configuration->getPlaceParts());
    }

    /**
     * Ensures the maximum allowed placeParts value (3) is accepted.
     */
    #[Test]
    public function placePartsMaximumValueIsAccepted(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams(['placeParts' => '3']);

        $module = $this->createModuleWithPreferences([
            'default_placeParts' => '1',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(3, $configuration->getPlaceParts());
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
     * Ensures getShowDescendants() defaults to false when not set.
     */
    #[Test]
    public function showDescendantsDefaultsToFalse(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $module = $this->createModuleWithPreferences([]);

        $configuration = new Configuration($request, $module);

        self::assertFalse($configuration->getShowDescendants());
    }

    /**
     * Ensures getFanDegree() returns unclamped value when showDescendants is false.
     */
    #[Test]
    public function fanDegreeUnclampedWhenDescendantsDisabled(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams([
            'fanDegree'       => '300',
            'showDescendants' => '0',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_fanDegree' => '210',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(300, $configuration->getFanDegree());
    }

    /**
     * Ensures getFanDegree() clamps to 270 ceiling when showDescendants is true.
     */
    #[Test]
    public function fanDegreeCeilingWhenDescendantsEnabled(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams([
            'fanDegree'       => '300',
            'showDescendants' => '1',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_fanDegree' => '210',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(270, $configuration->getFanDegree());
    }

    /**
     * Ensures getFanDegree() does not clamp values within 180-270 range.
     */
    #[Test]
    public function fanDegreeWithinRangeUnchanged(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams([
            'fanDegree'       => '210',
            'showDescendants' => '1',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_fanDegree' => '210',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame(210, $configuration->getFanDegree());
    }

    /**
     * Ensures getFanDegree() returns default (210) when input is out of isBetween range,
     * even when showDescendants is true (90 is rejected by validator, default 210 returned).
     */
    #[Test]
    public function fanDegreeOutOfRangeFallsBackToDefault(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams([
            'fanDegree'       => '90',
            'showDescendants' => '1',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_fanDegree' => '210',
        ]);

        $configuration = new Configuration($request, $module);

        // isBetween(180,360) rejects 90, falls back to default 210
        // Descendant clamp: min(270, max(180, 210)) = 210
        self::assertSame(210, $configuration->getFanDegree());
    }

    /**
     * Ensures getFanDegreeUnclamped() returns the value WITHOUT descendant clamp.
     */
    #[Test]
    public function fanDegreeUnclampedIgnoresDescendantClamp(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams([
            'fanDegree'       => '300',
            'showDescendants' => '1',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_fanDegree' => '210',
        ]);

        $configuration = new Configuration($request, $module);

        // getFanDegreeUnclamped should return 300 (no descendant clamp)
        self::assertSame(300, $configuration->getFanDegreeUnclamped());
        // getFanDegree should return 270 (clamped)
        self::assertSame(270, $configuration->getFanDegree());
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

        $chartService = self::createStub(ChartService::class);
        $module       = new Module($chartService, new DataFacade());

        $reflection = new ReflectionProperty(AbstractModule::class, 'name');
        $reflection->setValue($module, 'webtrees-fan-chart');

        return $module;
    }
}
