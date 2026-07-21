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
use Fisharebest\Webtrees\Tree;
use GuzzleHttp\Psr7\ServerRequest;
use Illuminate\Database\Schema\Blueprint;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\ModuleBase\Model\PlaceFormatChoice;
use MagicSunday\Webtrees\ModuleBase\Model\PlaceStyle;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

use function array_keys;
use function array_map;

/**
 * Verifies that configuration handling honors defaults, validation, and
 * selectable ranges.
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
     * Ensures GET requests fall back to configured defaults when parameters are
     * absent.
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
            'default_placeFormat'             => 'levels-2',
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
        self::assertSame(PlaceFormatChoice::Levels2, $configuration->getPlaceFormatChoice());
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
     * Locks the route-toggle parameter list. Forgetting to add a new toggle
     * here is the regression that lets a freshly added form option silently
     * fall back to module-preference defaults on click-to-recenter.
     */
    #[Test]
    public function routeToggleParamsCarryEveryFormToggle(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $module  = $this->createModuleWithPreferences([]);

        $configuration = new Configuration($request, $module);

        self::assertSame(
            [
                'generations',
                'fanDegree',
                'fontScale',
                'hideEmptySegments',
                'showFamilyColors',
                'showPlaces',
                'placeFormat',
                'showParentMarriageDates',
                'showImages',
                'showNames',
                'showNicknames',
                'innerArcs',
                'paternalColor',
                'maternalColor',
                'showDescendants',
            ],
            array_keys($configuration->getRouteToggleParams())
        );
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
            'fontScale'               => '120',
            'fanDegree'               => '300',
            'hideEmptySegments'       => '1',
            'showFamilyColors'        => '1',
            'showPlaces'              => '1',
            'placeFormat'             => 'levels-2',
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
            'default_placeFormat'             => 'levels-1',
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
        self::assertSame(120, $configuration->getFontScale());
        self::assertSame(300, $configuration->getFanDegree());
        self::assertTrue($configuration->getHideEmptySegments());
        self::assertTrue($configuration->getShowFamilyColors());
        self::assertTrue($configuration->getShowPlaces());
        self::assertSame(PlaceFormatChoice::Levels2, $configuration->getPlaceFormatChoice());
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
     * A stored legacy integer preference keeps working after the upgrade: this is
     * every installation that configured the option before the format model
     * existed.
     *
     * @param string            $legacyValue
     * @param PlaceFormatChoice $expected
     *
     * @return void
     */
    #[Test]
    #[DataProvider('legacyPlacePartsProvider')]
    public function legacyPlacePartsPreferenceMapsOntoAChoice(
        string $legacyValue,
        PlaceFormatChoice $expected,
    ): void {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $module = $this->createModuleWithPreferences([
            'default_placeParts' => $legacyValue,
        ]);

        self::assertSame($expected, (new Configuration($request, $module))->getPlaceFormatChoice());
    }

    /**
     * @return array<string, array{0: string, 1: PlaceFormatChoice}>
     */
    public static function legacyPlacePartsProvider(): array
    {
        return [
            'automatic sentinel'        => ['-1', PlaceFormatChoice::Automatic],
            'full name'                 => ['0', PlaceFormatChoice::Full],
            'one level'                 => ['1', PlaceFormatChoice::Levels1],
            'two levels'                => ['2', PlaceFormatChoice::Levels2],
            'three levels'              => ['3', PlaceFormatChoice::Levels3],
            'no legacy value'           => ['', PlaceFormatChoice::Automatic],
            'out-of-range legacy value' => ['9', PlaceFormatChoice::Automatic],
            'garbage legacy value'      => ['nonsense', PlaceFormatChoice::Automatic],
        ];
    }

    /**
     * The new preference wins over a leftover legacy value.
     *
     * @return void
     */
    #[Test]
    public function newPreferenceTakesPrecedenceOverTheLegacyOne(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $module = $this->createModuleWithPreferences([
            'default_placeParts'  => '2',
            'default_placeFormat' => 'city-iso2',
        ]);

        self::assertSame(PlaceFormatChoice::CityIso2, (new Configuration($request, $module))->getPlaceFormatChoice());
    }

    /**
     * An unusable query parameter must not discard the admin's stored setting.
     * The pre-3.0 behaviour was exactly this: a value failing isBetween() fell
     * back to the preference, not to the built-in default.
     *
     * @return void
     */
    #[Test]
    public function anInvalidQueryParameterKeepsTheStoredPreference(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams(['placeFormat' => 'nonsense']);

        $module = $this->createModuleWithPreferences([
            'default_placeFormat' => 'city-iso2',
        ]);

        self::assertSame(PlaceFormatChoice::CityIso2, (new Configuration($request, $module))->getPlaceFormatChoice());
    }

    /**
     * A stored value written by a newer version — the downgrade case — is not
     * usable either, and must fall through to the legacy key rather than being
     * treated as valid.
     *
     * @return void
     */
    #[Test]
    public function anUnknownStoredPreferenceFallsBackToTheLegacyKey(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $module = $this->createModuleWithPreferences([
            'default_placeFormat' => 'city-iso4',
            'default_placeParts'  => '2',
        ]);

        self::assertSame(PlaceFormatChoice::Levels2, (new Configuration($request, $module))->getPlaceFormatChoice());
    }

    /**
     * With no preference at all the option inherits the tree settings.
     *
     * @return void
     */
    #[Test]
    public function placeFormatDefaultsToAutomatic(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        self::assertSame(
            PlaceFormatChoice::Automatic,
            (new Configuration($request, $this->createModuleWithPreferences([])))->getPlaceFormatChoice()
        );
    }

    /**
     * The query parameter overrides the stored preference — this is how the
     * chart's navigation URLs carry the setting.
     *
     * @return void
     */
    #[Test]
    public function placeFormatQueryParameterOverridesThePreference(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $request = $request->withQueryParams(['placeFormat' => 'city-country']);

        $module = $this->createModuleWithPreferences([
            'default_placeFormat' => 'full',
        ]);

        self::assertSame(PlaceFormatChoice::CityCountry, (new Configuration($request, $module))->getPlaceFormatChoice());
    }

    /**
     * The admin form posts its value; the POST path is the one that actually
     * configures the module.
     *
     * @return void
     */
    #[Test]
    public function placeFormatIsReadFromThePostBody(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_POST, '/');
        $request = $request->withParsedBody(['placeFormat' => 'city-iso3']);

        $module = $this->createModuleWithPreferences([
            'default_placeFormat' => 'full',
        ]);

        self::assertSame(PlaceFormatChoice::CityIso3, (new Configuration($request, $module))->getPlaceFormatChoice());
    }

    /**
     * Automatic resolves against the tree preferences — and against the RIGHT
     * ones: swapping SHOW_PEDIGREE_PLACES with its _SUFFIX sibling must fail this.
     *
     * @return void
     */
    #[Test]
    public function automaticResolvesTheTreePreferencesIntoASpec(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $tree = self::createStub(Tree::class);
        // Two-element rows: getPreference() is called with ONE argument, and
        // ReturnValueMap matches on the arguments actually passed. A three-element
        // row would never match, the stub would return null, and the string return
        // type would throw.
        $tree->method('getPreference')->willReturnMap([
            ['SHOW_PEDIGREE_PLACES', '2'],
            ['SHOW_PEDIGREE_PLACES_SUFFIX', '1'],
        ]);

        $configuration = new Configuration($request, $this->createModuleWithPreferences([]), $tree);
        $spec          = $configuration->getPlaceFormat();

        self::assertSame(PlaceStyle::Levels, $spec->style);
        self::assertSame(2, $spec->levels);
        self::assertTrue($spec->fromEnd);
    }

    /**
     * Without a tree there is nothing to inherit; the module falls back to a
     * single level, matching the pre-3.0 DEFAULT_PLACE_PARTS.
     *
     * @return void
     */
    #[Test]
    public function automaticWithoutATreeFallsBackToOneLevel(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $spec = (new Configuration($request, $this->createModuleWithPreferences([])))->getPlaceFormat();

        self::assertSame(PlaceStyle::Levels, $spec->style);
        self::assertSame(1, $spec->levels);
        self::assertFalse($spec->fromEnd);
    }

    /**
     * An explicit choice ignores the tree's suffix preference — the module
     * exposes no direction control of its own.
     *
     * @return void
     */
    #[Test]
    public function anExplicitChoiceIgnoresTheTreeSuffix(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');

        $tree = self::createStub(Tree::class);
        // Two-element rows: getPreference() is called with ONE argument, and
        // ReturnValueMap matches on the arguments actually passed. A three-element
        // row would never match, the stub would return null, and the string return
        // type would throw.
        $tree->method('getPreference')->willReturnMap([
            ['SHOW_PEDIGREE_PLACES', '2'],
            ['SHOW_PEDIGREE_PLACES_SUFFIX', '1'],
        ]);

        $module = $this->createModuleWithPreferences(['default_placeFormat' => 'levels-3']);
        $spec   = (new Configuration($request, $module, $tree))->getPlaceFormat();

        // All three axes: the predecessor asserted the level count as well, and a
        // regression mapping levels-3 onto Full or Levels1 must not slip through.
        self::assertSame(PlaceStyle::Levels, $spec->style);
        self::assertSame(3, $spec->levels);
        self::assertFalse($spec->fromEnd, 'the module exposes no direction control');
    }

    /**
     * Every choice needs a label, and every label key must round-trip through
     * tryFrom() — otherwise a select option silently fails to store.
     *
     * @return void
     */
    #[Test]
    public function everyChoiceHasALabelKeyedByItsStoredValue(): void
    {
        $request       = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $configuration = new Configuration($request, $this->createModuleWithPreferences([]));

        // Canonicalising: every choice needs a label and every key must be a valid
        // backing value, but the display order of the select is not a contract.
        self::assertEqualsCanonicalizing(
            array_map(static fn (PlaceFormatChoice $case): string => $case->value, PlaceFormatChoice::cases()),
            array_keys($configuration->getPlaceFormatList())
        );
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
     * Ensures getFanDegree() returns unclamped value when showDescendants is
     * false.
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
     * Ensures getFanDegree() clamps to 270 ceiling when showDescendants is
     * true.
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
     * Ensures getFanDegree() returns default (210) when input is out of
     * isBetween range, even when showDescendants is true (90 is rejected by
     * validator, default 210 returned).
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
     * Ensures getFanDegreeUnclamped() returns the value WITHOUT descendant
     * clamp.
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
