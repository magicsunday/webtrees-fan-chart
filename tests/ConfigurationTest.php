<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test;

use Closure;
use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Tree;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\FanChart\Test\Support\EnglishLocaleFixture;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\ModuleBase\Model\NameAbbreviation;
use MagicSunday\Webtrees\ModuleBase\Model\PlaceFormatChoice;
use MagicSunday\Webtrees\ModuleBase\Model\PlaceStyle;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;

use function array_filter;
use function array_keys;
use function array_map;
use function count;
use function str_contains;

/**
 * Verifies that configuration handling honors defaults, validation, and
 * selectable ranges.
 */
#[CoversClass(Configuration::class)]
#[UsesClass(Module::class)]
final class ConfigurationTest extends TestCase
{
    use ModuleSettingsFixtureTrait;

    /**
     * Ensures locale and translator are initialised before each test.
     */
    protected function setUp(): void
    {
        parent::setUp();

        EnglishLocaleFixture::install();
    }

    /**
     * The request shapes of the display mode: the method, the query parameters,
     * the body and the expected visibility of images and names.
     *
     * @return array<string, array{string, array<string, string>, array<string, string>, bool, bool}>
     */
    public static function displayModeRequestProvider(): array
    {
        return [
            'query names only'                         => ['GET', ['displayMode' => 'names'], [], false, true],
            'both wins over the toggles switched off'  => ['GET', ['displayMode' => 'both', 'showImages' => '0', 'showNames' => '0'], [], true, true],
            'query wins over the single toggles'       => ['GET', ['displayMode' => 'images', 'showImages' => '0', 'showNames' => '1'], [], true, false],
            'invalid query value uses the toggles'     => ['GET', ['displayMode' => 'everything', 'showImages' => '0', 'showNames' => '1'], [], false, true],
            'body wins over the query'                 => ['POST', ['displayMode' => 'names'], ['displayMode' => 'images'], true, false],
            'a post reads the body only'               => ['POST', ['displayMode' => 'images'], [], true, true],
            'invalid body value uses the body toggles' => ['POST', ['displayMode' => 'images'], ['displayMode' => 'everything', 'showImages' => '0', 'showNames' => '1'], false, true],
        ];
    }

    /**
     * The display mode decides about images and names before the single
     * toggles and the module defaults do, and the body of a form post takes
     * precedence over the query of the same request.
     *
     * @param array<string, string> $query
     * @param array<string, string> $body
     */
    #[Test]
    #[DataProvider('displayModeRequestProvider')]
    public function theDisplayModeDecidesAboutImagesAndNames(
        string $method,
        array $query,
        array $body,
        bool $expectedImages,
        bool $expectedNames,
    ): void {
        $request = (new ServerRequest($method, '/'))->withQueryParams($query);

        if ($method === RequestMethodInterface::METHOD_POST) {
            $request = $request->withParsedBody($body);
        }

        $module = $this->createModuleWithPreferences([
            'default_showImages' => '1',
            'default_showNames'  => '1',
        ]);

        $configuration = new Configuration($request, $module);

        self::assertSame($expectedImages, $configuration->getShowImages());
        self::assertSame($expectedNames, $configuration->getShowNames());
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
     * Values that are not a six digit hex colour, among them the opener of an
     * HTML comment followed by a script opener that an inline script would
     * keep intact after JSON encoding.
     *
     * @return array<string, array{string}>
     */
    public static function invalidColourProvider(): array
    {
        return [
            'comment and script opener' => ['<!--<script>'],
            'missing hash'              => ['112233'],
            'short form'                => ['#123'],
            'non-hex digit'             => ['#11223g'],
            'trailing declaration'      => ['#112233;color:red'],
            'trailing line break'       => ["#112233\n"],
            'leading text'              => ['x#112233'],
            'surrounding space'         => [' #112233 '],
            'empty'                     => [''],
        ];
    }

    /**
     * A request value that is no hex colour never reaches the page. Both
     * lineage colours resolve to their defaults instead.
     */
    #[Test]
    #[DataProvider('invalidColourProvider')]
    public function aColourFromTheRequestThatIsNoHexColourFallsBackToTheDefault(string $value): void
    {
        $request = (new ServerRequest(RequestMethodInterface::METHOD_GET, '/'))
            ->withQueryParams(
                [
                    'paternalColor' => $value,
                    'maternalColor' => $value,
                ]
            );

        $configuration = new Configuration($request, $this->createModuleWithPreferences([]));

        self::assertSame(Configuration::PATERNAL_COLOR_DEFAULT, $configuration->getPaternalColor());
        self::assertSame(Configuration::MATERNAL_COLOR_DEFAULT, $configuration->getMaternalColor());
    }

    /**
     * A module preference that is no hex colour is ignored the same way, so
     * the stored value cannot reach the page either. The request test above
     * pins the pattern on every shape, so this one stored value shows that
     * the preference passes through the same check.
     */
    #[Test]
    public function aColourFromTheModulePreferenceThatIsNoHexColourFallsBackToTheDefault(): void
    {
        $value  = '<!--<script>';
        $module = $this->createModuleWithPreferences(
            [
                'default_paternalColor' => $value,
                'default_maternalColor' => $value,
            ]
        );

        $configuration = new Configuration(new ServerRequest(RequestMethodInterface::METHOD_GET, '/'), $module);

        self::assertSame(Configuration::PATERNAL_COLOR_DEFAULT, $configuration->getPaternalColor());
        self::assertSame(Configuration::MATERNAL_COLOR_DEFAULT, $configuration->getMaternalColor());
    }

    /**
     * A valid colour of the request wins over the module preference, and the
     * letters of the digits keep their case.
     */
    #[Test]
    public function aHexColourFromTheRequestWinsOverTheModulePreference(): void
    {
        $request = (new ServerRequest(RequestMethodInterface::METHOD_GET, '/'))
            ->withQueryParams(
                [
                    'paternalColor' => '#AbCdEf',
                    'maternalColor' => '#fEdCbA',
                ]
            );

        $module = $this->createModuleWithPreferences(
            [
                'default_paternalColor' => '#010203',
                'default_maternalColor' => '#040506',
            ]
        );

        $configuration = new Configuration($request, $module);

        self::assertSame('#AbCdEf', $configuration->getPaternalColor());
        self::assertSame('#fEdCbA', $configuration->getMaternalColor());
    }

    /**
     * A request value that is no hex colour falls back to the stored module
     * preference when that one is valid, not to the built-in default.
     */
    #[Test]
    public function aColourFromTheRequestThatIsNoHexColourFallsBackToTheValidModulePreference(): void
    {
        $request = (new ServerRequest(RequestMethodInterface::METHOD_GET, '/'))
            ->withQueryParams(
                [
                    'paternalColor' => '<!--<script>',
                    'maternalColor' => '#11223g',
                ]
            );

        $module = $this->createModuleWithPreferences(
            [
                'default_paternalColor' => '#010203',
                'default_maternalColor' => '#040506',
            ]
        );

        $configuration = new Configuration($request, $module);

        self::assertSame('#010203', $configuration->getPaternalColor());
        self::assertSame('#040506', $configuration->getMaternalColor());
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
                'showParentMarriageDates',
                'showImages',
                'showNames',
                'showNicknames',
                'innerArcs',
                'paternalColor',
                'maternalColor',
                'showDescendants',
                'showDetailPanel',
            ],
            array_keys($configuration->getRouteToggleParams())
        );
    }

    /**
     * The detail panel is off until the request or the administrator turns it on,
     * and the request wins over the module preference in both directions.
     *
     * @param array<string, string> $queryParams
     * @param array<string, string> $preferences
     */
    #[Test]
    #[DataProvider('showDetailPanelProvider')]
    public function showDetailPanelResolvesFromTheRequestThenThePreference(
        array $queryParams,
        array $preferences,
        bool $expected,
    ): void {
        $request       = (new ServerRequest(RequestMethodInterface::METHOD_GET, '/'))->withQueryParams($queryParams);
        $configuration = new Configuration($request, $this->createModuleWithPreferences($preferences));

        self::assertSame($expected, $configuration->getShowDetailPanel());
    }

    /**
     * @return array<string, array{array<string, string>, array<string, string>, bool}>
     */
    public static function showDetailPanelProvider(): array
    {
        return [
            'off without request or preference' => [[], [], false],
            'on by the administrator'           => [[], ['default_showDetailPanel' => '1'], true],
            'request switches it on'            => [['showDetailPanel' => '1'], [], true],
            'request switches it off'           => [['showDetailPanel' => '0'], ['default_showDetailPanel' => '1'], false],
        ];
    }

    /**
     * The switch travels with every URL the chart navigates to, so recentring the
     * chart keeps the panel in the state the visitor chose.
     */
    #[Test]
    public function theRouteToggleParamsCarryThePanelSwitch(): void
    {
        $off = new Configuration(
            new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
            $this->createModuleWithPreferences([])
        );
        $on = new Configuration(
            (new ServerRequest(RequestMethodInterface::METHOD_GET, '/'))->withQueryParams(['showDetailPanel' => '1']),
            $this->createModuleWithPreferences([])
        );

        $offParams = $off->getRouteToggleParams();
        $onParams  = $on->getRouteToggleParams();

        self::assertArrayHasKey('showDetailPanel', $offParams);
        self::assertArrayHasKey('showDetailPanel', $onParams);
        self::assertSame('0', $offParams['showDetailPanel']);
        self::assertSame('1', $onParams['showDetailPanel']);
    }

    /**
     * The stored name-abbreviation preference is converted to its typed case at
     * the boundary, so a valid stored value round-trips to the matching enum
     * case.
     */
    #[Test]
    public function nameAbbreviationReturnsTheStoredCase(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $module  = $this->createModuleWithPreferences([
            'default_nameAbbreviation' => 'SURNAME',
        ]);

        self::assertSame(
            NameAbbreviation::Surname,
            (new Configuration($request, $module))->getNameAbbreviation()
        );
    }

    /**
     * A stored value outside the enum's backing set (a stale or typo'd
     * preference) no longer propagates silently: tryFrom() rejects it and the
     * getter falls back to Auto instead of passing the raw string through — the
     * regression the old string-in/string-out shape allowed.
     */
    #[Test]
    public function nameAbbreviationFallsBackToAutoForAnUnknownStoredValue(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $module  = $this->createModuleWithPreferences([
            'default_nameAbbreviation' => 'not-a-strategy',
        ]);

        self::assertSame(
            NameAbbreviation::Auto,
            (new Configuration($request, $module))->getNameAbbreviation()
        );
    }

    /**
     * A POSTed nameAbbreviation parameter is validated through validator() and
     * takes precedence over the stored preference.
     */
    #[Test]
    public function nameAbbreviationReadsThePostedParameter(): void
    {
        $request = new ServerRequest(
            RequestMethodInterface::METHOD_POST,
            '/',
            [],
            null,
            '1.1'
        );

        $request = $request->withParsedBody([
            'nameAbbreviation' => 'GIVEN',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_nameAbbreviation' => 'SURNAME',
        ]);

        self::assertSame(
            NameAbbreviation::Given,
            (new Configuration($request, $module))->getNameAbbreviation()
        );
    }

    /**
     * A POSTed value takes precedence over the stored preference, so an invalid
     * POSTed value falls back to Auto rather than silently keeping a valid
     * stored strategy — the posted (invalid) value wins the precedence, then
     * tryFrom() rejects it.
     */
    #[Test]
    public function nameAbbreviationFallsBackToAutoForAnInvalidPostedValue(): void
    {
        $request = new ServerRequest(
            RequestMethodInterface::METHOD_POST,
            '/',
            [],
            null,
            '1.1'
        );

        $request = $request->withParsedBody([
            'nameAbbreviation' => 'not-a-strategy',
        ]);

        $module = $this->createModuleWithPreferences([
            'default_nameAbbreviation' => 'SURNAME',
        ]);

        self::assertSame(
            NameAbbreviation::Auto,
            (new Configuration($request, $module))->getNameAbbreviation()
        );
    }

    /**
     * The admin dropdown is keyed by the persisted enum backing values so the
     * posted selection round-trips through tryFrom() on the way back in.
     */
    #[Test]
    public function nameAbbreviationListIsKeyedByTheEnumBackingValues(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $module  = $this->createModuleWithPreferences([]);

        self::assertSame(
            [
                NameAbbreviation::Auto->value,
                NameAbbreviation::Given->value,
                NameAbbreviation::Surname->value,
            ],
            array_keys((new Configuration($request, $module))->getNameAbbreviationList())
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
        self::assertSame(PlaceFormatChoice::Levels2, $configuration->getSubmittedPlaceFormatChoice());
        self::assertSame(PlaceFormatChoice::Levels1, $configuration->getPlaceFormatChoice());
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
     * The values the pre-3.0 `default_placeParts` preference could hold that map onto a
     * choice, and the old "inherit" sentinel as the representative of every value that
     * degrades to Automatic (an unset preference, a value outside the old range and a
     * non-numeric string reach the same default arm).
     *
     * @return array<string, array{0: string, 1: PlaceFormatChoice}>
     */
    public static function legacyPlacePartsProvider(): array
    {
        return [
            'automatic sentinel' => ['-1', PlaceFormatChoice::Automatic],
            'full name'          => ['0', PlaceFormatChoice::Full],
            'one level'          => ['1', PlaceFormatChoice::Levels1],
            'two levels'         => ['2', PlaceFormatChoice::Levels2],
            'three levels'       => ['3', PlaceFormatChoice::Levels3],
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
     * The request shapes that carry a place format and must not change the chart.
     *
     * @return array<string, array{string, array<string, string>, array<string, string>}>
     */
    public static function placeFormatRequestProvider(): array
    {
        return [
            'query parameter' => ['GET', ['placeFormat' => 'city-country'], []],
            'post body'       => ['POST', [], ['placeFormat' => 'city-iso3']],
        ];
    }

    /**
     * The place format is an administrator setting. Neither a query parameter nor a
     * posted value of that name has an effect on the chart, because only the
     * submitted-value reader of the administration form looks at the body.
     *
     * @param array<string, string> $query
     * @param array<string, string> $body
     */
    #[Test]
    #[DataProvider('placeFormatRequestProvider')]
    public function placeFormatFromTheRequestDoesNotOverrideThePreference(
        string $method,
        array $query,
        array $body,
    ): void {
        $request = (new ServerRequest($method, '/'))->withQueryParams($query);

        if ($method === RequestMethodInterface::METHOD_POST) {
            $request = $request->withParsedBody($body);
        }

        $module = $this->createModuleWithPreferences([
            'default_placeFormat' => 'full',
        ]);

        self::assertSame(PlaceFormatChoice::Full, (new Configuration($request, $module))->getPlaceFormatChoice());
    }

    /**
     * The admin form posts its value, and the submitted-value reader returns it.
     *
     * @return void
     */
    #[Test]
    public function submittedPlaceFormatIsReadFromThePostBody(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_POST, '/');
        $request = $request->withParsedBody(['placeFormat' => 'city-iso3']);

        $module = $this->createModuleWithPreferences([
            'default_placeFormat' => 'full',
        ]);

        self::assertSame(
            PlaceFormatChoice::CityIso3,
            (new Configuration($request, $module))->getSubmittedPlaceFormatChoice()
        );
    }

    /**
     * An unusable posted value keeps the stored choice instead of resetting it.
     *
     * @return void
     */
    #[Test]
    public function anUnusableSubmittedPlaceFormatKeepsTheStoredChoice(): void
    {
        $request = new ServerRequest(RequestMethodInterface::METHOD_POST, '/');
        $request = $request->withParsedBody(['placeFormat' => 'nonsense']);

        $module = $this->createModuleWithPreferences([
            'default_placeFormat' => 'city-iso2',
        ]);

        self::assertSame(
            PlaceFormatChoice::CityIso2,
            (new Configuration($request, $module))->getSubmittedPlaceFormatChoice()
        );
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
     * The fan degree on and around its edges, with and without descendants. A request value
     * outside 180 to 360 falls back to the stored default of 210. While descendants are shown the
     * value is lowered to 270, and the unclamped reading keeps the accepted value.
     *
     * @return array<string, array{string, string, int, int}>
     */
    public static function fanDegreeProvider(): array
    {
        return [
            'below the minimum without descendants' => ['179', '0', 210, 210],
            'minimum without descendants'           => ['180', '0', 180, 180],
            'inside the range without descendants'  => ['210', '0', 210, 210],
            'ceiling without descendants'           => ['270', '0', 270, 270],
            'above the ceiling without descendants' => ['271', '0', 271, 271],
            'maximum without descendants'           => ['360', '0', 360, 360],
            'above the maximum without descendants' => ['361', '0', 210, 210],
            'below the minimum with descendants'    => ['179', '1', 210, 210],
            'minimum with descendants'              => ['180', '1', 180, 180],
            'inside the range with descendants'     => ['210', '1', 210, 210],
            'ceiling with descendants'              => ['270', '1', 270, 270],
            'above the ceiling with descendants'    => ['271', '1', 270, 271],
            'maximum with descendants'              => ['360', '1', 270, 360],
            'above the maximum with descendants'    => ['361', '1', 210, 210],
        ];
    }

    /**
     * Pins the clamped and the unclamped fan degree on the edges of the accepted range.
     */
    #[Test]
    #[DataProvider('fanDegreeProvider')]
    public function theFanDegreeIsTakenInsideItsRangeAndLoweredWhileDescendantsAreShown(
        string $value,
        string $showDescendants,
        int $expected,
        int $expectedUnclamped,
    ): void {
        $request = (new ServerRequest(RequestMethodInterface::METHOD_GET, '/'))->withQueryParams([
            'fanDegree'       => $value,
            'showDescendants' => $showDescendants,
        ]);

        $configuration = new Configuration(
            $request,
            $this->createModuleWithPreferences(['default_fanDegree' => '210'])
        );

        self::assertSame($expected, $configuration->getFanDegree());
        self::assertSame($expectedUnclamped, $configuration->getFanDegreeUnclamped());
    }

    /**
     * The edges of every numeric setting. A value on an edge is taken, a value one step outside is
     * rejected and the stored default of the module applies. The stored defaults of the test differ from
     * the built-in ones and from each edge, so a fallback to either shows. The fan degree is clamped
     * to its ceiling while descendants are shown, so a value just above that ceiling is taken but
     * lowered, and one below the lower edge falls back to the stored default.
     *
     * @return array<string, array{Closure(Configuration): int, array<string, string>, int}>
     */
    public static function settingBoundaryProvider(): array
    {
        $generations = static fn (Configuration $configuration): int => $configuration->getGenerations();
        $fontScale   = static fn (Configuration $configuration): int => $configuration->getFontScale();
        $innerArcs   = static fn (Configuration $configuration): int => $configuration->getInnerArcs();
        $fanDegree   = static fn (Configuration $configuration): int => $configuration->getFanDegree();

        return [
            'generations at the minimum'                    => [$generations, ['generations' => '2'], 2],
            'generations below the minimum'                 => [$generations, ['generations' => '1'], 7],
            'generations at the maximum'                    => [$generations, ['generations' => '10'], 10],
            'generations above the maximum'                 => [$generations, ['generations' => '11'], 7],
            'font scale at the minimum'                     => [$fontScale, ['fontScale' => '75'], 75],
            'font scale below the minimum'                  => [$fontScale, ['fontScale' => '74'], 90],
            'font scale at the maximum'                     => [$fontScale, ['fontScale' => '125'], 125],
            'font scale above the maximum'                  => [$fontScale, ['fontScale' => '126'], 90],
            'inner arcs at the minimum'                     => [$innerArcs, ['innerArcs' => '0'], 0],
            'inner arcs below the minimum'                  => [$innerArcs, ['innerArcs' => '-1'], 2],
            'inner arcs at the maximum'                     => [$innerArcs, ['innerArcs' => '5'], 5],
            'inner arcs above the maximum'                  => [$innerArcs, ['innerArcs' => '6'], 2],
            'fan degree at the minimum'                     => [$fanDegree, ['fanDegree' => '180'], 180],
            'fan degree below the minimum'                  => [$fanDegree, ['fanDegree' => '179'], 200],
            'fan degree at the maximum'                     => [$fanDegree, ['fanDegree' => '360'], 360],
            'fan degree above the maximum'                  => [$fanDegree, ['fanDegree' => '361'], 200],
            'fan degree at the ceiling with descendants'    => [$fanDegree, ['fanDegree' => '270', 'showDescendants' => '1'], 270],
            'fan degree above the ceiling with descendants' => [$fanDegree, ['fanDegree' => '271', 'showDescendants' => '1'], 270],
            'fan degree at the minimum with descendants'    => [$fanDegree, ['fanDegree' => '180', 'showDescendants' => '1'], 180],
            'fan degree below the minimum with descendants' => [$fanDegree, ['fanDegree' => '179', 'showDescendants' => '1'], 200],
            'fan degree above the maximum with descendants' => [$fanDegree, ['fanDegree' => '361', 'showDescendants' => '1'], 200],
        ];
    }

    /**
     * Pins the edges of the numeric settings of the chart.
     *
     * @param Closure(Configuration): int $read     Reads the setting under test
     * @param array<string, string>       $query    The request parameters
     * @param int                         $expected The value the chart uses
     */
    #[Test]
    #[DataProvider('settingBoundaryProvider')]
    public function aNumericSettingIsTakenOnItsEdgesAndRejectedOutsideThem(Closure $read, array $query, int $expected): void
    {
        $configuration = new Configuration(
            (new ServerRequest(RequestMethodInterface::METHOD_GET, '/'))->withQueryParams($query),
            $this->createModuleWithPreferences([
                'default_generations' => '7',
                'default_fontScale'   => '90',
                'default_innerArcs'   => '2',
                'default_fanDegree'   => '200',
            ])
        );

        self::assertSame($expected, $read($configuration));
    }

    /**
     * Pins the per-request query cost: however often the getters are called
     * while the tree is built, each preference is read at most once.
     */
    #[Test]
    public function readsEachPreferenceOnceHoweverOftenTheGettersAreCalled(): void
    {
        // Compares one round against ten rather than asserting a fixed number.
        // A fixed bound would encode today's preference count and fail on an
        // unrelated future addition while blaming memoisation. It would also pass
        // vacuously if the getters stopped querying at all. Constant cost is the
        // property that matters.
        $oneRound  = $this->countPreferenceQueries(1);
        $tenRounds = $this->countPreferenceQueries(10);

        self::assertGreaterThan(0, $oneRound, 'the first round must actually read the preferences');
        self::assertSame(
            $oneRound,
            $tenRounds,
            'preference lookups are not memoised — the query cost scales with the number of nodes'
        );
    }

    /**
     * Runs every per-node getter $rounds times against a FRESH configuration and
     * returns how many `module_setting` queries that produced. The instance has
     * to be fresh per measurement — reusing one would leave it memoised from the
     * previous round and report zero.
     *
     * The getter list mirrors the settings the DataFacade resolves per individual
     * while building the tree (up to ~1023 nodes for ten generations): every
     * getRouteToggleParams() member plus getDetailedDateGenerations() and
     * getPlaceFormat(), which getNodeData() reads directly.
     *
     * @param int $rounds The number of times to invoke each getter
     *
     * @return int
     */
    private function countPreferenceQueries(int $rounds): int
    {
        $request       = new ServerRequest(RequestMethodInterface::METHOD_GET, '/');
        $configuration = new Configuration($request, $this->createModuleWithPreferences([]));

        $connection = DB::connection();
        $connection->flushQueryLog();
        $connection->enableQueryLog();

        try {
            for ($i = 0; $i < $rounds; ++$i) {
                $configuration->getGenerations();
                $configuration->getDetailedDateGenerations();
                $configuration->getFontScale();
                $configuration->getShowDescendants();
                $configuration->getFanDegree();
                $configuration->getFanDegreeUnclamped();
                $configuration->getHideEmptySegments();
                $configuration->getShowFamilyColors();
                $configuration->getShowPlaces();
                $configuration->getPlaceFormatChoice();
                $configuration->getPlaceFormat();
                $configuration->getShowParentMarriageDates();
                $configuration->getShowImages();
                $configuration->getShowNames();
                $configuration->getShowNicknames();
                $configuration->getInnerArcs();
                $configuration->getPaternalColor();
                $configuration->getMaternalColor();
                $configuration->getShowDetailPanel();
            }

            // Counts only the preference reads the assertion talks about, so an
            // unrelated query inside the window cannot change the verdict.
            return count(array_filter($connection->getQueryLog(), $this->isPreferenceQuery(...)));
        } finally {
            $connection->disableQueryLog();
            $connection->flushQueryLog();
        }
    }

    /**
     * Whether a query-log entry is a preference read.
     *
     * Declared as a named method with the log entry's shape rather than an
     * inline closure: without the shape Rector wants a `(string)` cast on the
     * query and PHPStan rejects that same cast as useless, so the two gates
     * contradict each other.
     *
     * @param array{query: string, bindings: array<mixed>, time: float|null} $entry
     *
     * @return bool
     */
    private function isPreferenceQuery(array $entry): bool
    {
        return str_contains($entry['query'], 'module_setting');
    }
}
