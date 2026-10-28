<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Facade;

use ArrayObject;
use Aura\Router\Map;
use Aura\Router\Route;
use Fisharebest\Webtrees\Contracts\ContainerInterface;
use Fisharebest\Webtrees\Contracts\RouteFactoryInterface;
use Fisharebest\Webtrees\Date;
use Fisharebest\Webtrees\Fact;
use Fisharebest\Webtrees\Factories\CalendarDateFactory;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Place;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\Validator;
use GuzzleHttp\Psr7\ServerRequest;
use Illuminate\Support\Collection;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\FanChart\Test\Support\EnglishLocaleFixture;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\ModuleBase\Contract\ModuleAssetUrlInterface;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\MockObject\Stub;
use PHPUnit\Framework\TestCase;

use function array_map;
use function is_string;
use function json_decode;
use function json_encode;

use const JSON_THROW_ON_ERROR;

/**
 * Validates tree construction and data extraction performed by the facade.
 */
#[CoversClass(DataFacade::class)]
#[UsesClass(Configuration::class)]
#[UsesClass(Module::class)]
#[UsesClass(Node::class)]
#[UsesClass(NodeData::class)]
final class DataFacadeTest extends TestCase
{
    use ModuleSettingsFixtureTrait;

    /**
     * Prepares router and translation context required by the facade.
     */
    protected function setUp(): void
    {
        parent::setUp();

        Validator::serverParams(new ServerRequest('GET', '/'));
        Registry::calendarDateFactory(new CalendarDateFactory());

        EnglishLocaleFixture::install();
    }

    /**
     * Ensures the facade builds a node hierarchy respecting generation limits
     * and URLs.
     */
    #[Test]
    public function treeStructureIncludesParentsUntilConfiguredLimit(): void
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

        $container = new readonly class($routeFactory) implements ContainerInterface {
            public function __construct(private RouteFactoryInterface $routeFactory)
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

        Registry::routeFactory($routeFactory);
        Registry::container($container);

        $configuration = $this->createConfiguration([]);

        $module = self::createStubForIntersectionOfInterfaces([ModuleCustomInterface::class, ModuleAssetUrlInterface::class]);
        $module->method('name')->willReturn('webtrees-fan-chart');

        $childFamily  = self::createStub(Family::class);
        $spouseFamily = self::createStub(Family::class);

        $tree = self::createStub(Tree::class);
        $tree->method('name')->willReturn('main');
        $tree->method('getPreference')->willReturn('1');

        $root = self::createStub(Individual::class);
        $root->method('xref')->willReturn('I1');
        $root->method('url')->willReturn('/individual/I1');
        $root->method('sex')->willReturn('M');
        $root->method('fullName')->willReturn('Root Individual');
        $root->method('canShow')->willReturn(true);
        $root->method('canShowName')->willReturn(true);
        $root->method('getAllNames')->willReturn($this->buildNameSet('Root', 'Individual'));
        $root->method('getPrimaryName')->willReturn(0);
        $root->method('getSecondaryName')->willReturn(0);
        $root->method('getBirthDate')->willReturn($this->createDate('1 JAN 1900'));
        $root->method('getDeathDate')->willReturn($this->createDate('1 JAN 1980'));
        $root->method('tree')->willReturn($tree);
        $root->method('spouseFamilies')->willReturn(new Collection([$spouseFamily]));
        $root->method('childFamilies')->willReturn(new Collection([$childFamily]));
        $root->method('findHighlightedMediaFile')->willReturn(null);

        $father = self::createStub(Individual::class);
        $father->method('xref')->willReturn('I2');
        $father->method('url')->willReturn('/individual/I2');
        $father->method('sex')->willReturn('M');
        $father->method('fullName')->willReturn('Father Individual');
        $father->method('canShow')->willReturn(true);
        $father->method('canShowName')->willReturn(true);
        $father->method('getAllNames')->willReturn($this->buildNameSet('Father', 'Individual'));
        $father->method('getPrimaryName')->willReturn(0);
        $father->method('getSecondaryName')->willReturn(0);
        $father->method('getBirthDate')->willReturn($this->createDate('1 JAN 1870'));
        $father->method('getDeathDate')->willReturn($this->createDate('1 JAN 1940'));
        $father->method('tree')->willReturn($tree);
        $father->method('spouseFamilies')->willReturn(new Collection([$spouseFamily]));
        $father->method('childFamilies')->willReturn(new Collection());
        $father->method('findHighlightedMediaFile')->willReturn(null);

        $mother = self::createStub(Individual::class);
        $mother->method('xref')->willReturn('I3');
        $mother->method('url')->willReturn('/individual/I3');
        $mother->method('sex')->willReturn('F');
        $mother->method('fullName')->willReturn('Mother Individual');
        $mother->method('canShow')->willReturn(true);
        $mother->method('canShowName')->willReturn(true);
        $mother->method('getAllNames')->willReturn($this->buildNameSet('Mother', 'Individual'));
        $mother->method('getPrimaryName')->willReturn(0);
        $mother->method('getSecondaryName')->willReturn(0);
        $mother->method('getBirthDate')->willReturn($this->createDate('1 JAN 1875'));
        $mother->method('getDeathDate')->willReturn($this->createDate('1 JAN 1950'));
        $mother->method('tree')->willReturn($tree);
        $mother->method('spouseFamilies')->willReturn(new Collection([$spouseFamily]));
        $mother->method('childFamilies')->willReturn(new Collection());
        $mother->method('findHighlightedMediaFile')->willReturn(null);

        $spouseFamily->method('husband')->willReturn($father);
        $spouseFamily->method('wife')->willReturn($mother);
        $spouseFamily->method('getMarriageDate')->willReturn($this->createDate('1 JAN 1890'));

        $childFamily->method('husband')->willReturn($father);
        $childFamily->method('wife')->willReturn($mother);
        $childFamily->method('getMarriageDate')->willReturn($this->createDate('1 JAN 1890'));

        $facade   = new DataFacade();
        $rootNode = $facade->createTreeStructure($module, $configuration, $root);

        self::assertInstanceOf(Node::class, $rootNode);

        $data           = $rootNode->getData();
        $serializedData = $data->jsonSerialize();
        self::assertSame('I1', $serializedData['xref']);
        // The real configuration forwards the settings of the chart, so the
        // update URL carries them next to module, action, xref and tree.
        self::assertSame(
            '/route/module?module=webtrees-fan-chart&action=update&xref=I1&tree=main'
            . '&generations=2&fanDegree=210&fontScale=100&hideEmptySegments=1&showFamilyColors=1'
            . '&showPlaces=0&showParentMarriageDates=0&showImages=0&showNames=1'
            . '&showNicknames=0&innerArcs=3&paternalColor=%2370a9cf&maternalColor=%23d06f94&showDescendants=0'
            . '&showDetailPanel=0',
            $serializedData['updateUrl']
        );

        $serialized = $rootNode->jsonSerialize();

        self::assertArrayHasKey('parents', $serialized);
        $parents = $serialized['parents'];

        self::assertCount(2, $parents);
        $parentIds = array_map(static fn (Node $node): int => $node->getData()->getId(), $parents);
        self::assertSame([2, 3], $parentIds);
    }

    /**
     * Ensures descendants (partners + children) are included when
     * showDescendants is true.
     */
    #[Test]
    public function treeStructureIncludesDescendantsWhenEnabled(): void
    {
        $this->registerRouting();

        $configuration = $this->createConfiguration(['showDescendants' => '1']);

        $module = self::createStubForIntersectionOfInterfaces([ModuleCustomInterface::class, ModuleAssetUrlInterface::class]);
        $module->method('name')->willReturn('webtrees-fan-chart');

        $tree = self::createStub(Tree::class);
        $tree->method('name')->willReturn('main');
        $tree->method('getPreference')->willReturn('1');

        $spouse = self::createStub(Individual::class);
        $spouse->method('xref')->willReturn('I2');
        $spouse->method('url')->willReturn('/individual/I2');
        $spouse->method('sex')->willReturn('F');
        $spouse->method('fullName')->willReturn('Spouse Person');
        $spouse->method('canShow')->willReturn(true);
        $spouse->method('canShowName')->willReturn(true);
        $spouse->method('getAllNames')->willReturn($this->buildNameSet('Spouse', 'Person'));
        $spouse->method('getPrimaryName')->willReturn(0);
        $spouse->method('getSecondaryName')->willReturn(0);
        $spouse->method('getBirthDate')->willReturn($this->createDate('1 JAN 1902'));
        $spouse->method('getDeathDate')->willReturn($this->createDate('1 JAN 1985'));
        $spouse->method('tree')->willReturn($tree);
        $spouse->method('spouseFamilies')->willReturn(new Collection());
        $spouse->method('childFamilies')->willReturn(new Collection());
        $spouse->method('findHighlightedMediaFile')->willReturn(null);

        $child = self::createStub(Individual::class);
        $child->method('xref')->willReturn('I3');
        $child->method('url')->willReturn('/individual/I3');
        $child->method('sex')->willReturn('M');
        $child->method('fullName')->willReturn('Child Person');
        $child->method('canShow')->willReturn(true);
        $child->method('canShowName')->willReturn(true);
        $child->method('getAllNames')->willReturn($this->buildNameSet('Child', 'Person'));
        $child->method('getPrimaryName')->willReturn(0);
        $child->method('getSecondaryName')->willReturn(0);
        $child->method('getBirthDate')->willReturn($this->createDate('1 JAN 1930'));
        $child->method('getDeathDate')->willReturn($this->createDate('1 JAN 2010'));
        $child->method('tree')->willReturn($tree);
        $child->method('spouseFamilies')->willReturn(new Collection());
        $child->method('childFamilies')->willReturn(new Collection());
        $child->method('findHighlightedMediaFile')->willReturn(null);

        $family = self::createStub(Family::class);
        $family->method('xref')->willReturn('F1');
        $family->method('husband')->willReturn(null);
        $family->method('wife')->willReturn(null);
        $family->method('spouse')->willReturn($spouse);
        $family->method('children')->willReturn(new Collection([$child]));
        $family->method('getMarriageDate')->willReturn($this->createDate('1 JAN 1925'));
        $family->method('facts')->willReturn(new Collection());

        $root = self::createStub(Individual::class);
        $root->method('xref')->willReturn('I1');
        $root->method('url')->willReturn('/individual/I1');
        $root->method('sex')->willReturn('M');
        $root->method('fullName')->willReturn('Root Person');
        $root->method('canShow')->willReturn(true);
        $root->method('canShowName')->willReturn(true);
        $root->method('getAllNames')->willReturn($this->buildNameSet('Root', 'Person'));
        $root->method('getPrimaryName')->willReturn(0);
        $root->method('getSecondaryName')->willReturn(0);
        $root->method('getBirthDate')->willReturn($this->createDate('1 JAN 1900'));
        $root->method('getDeathDate')->willReturn($this->createDate('1 JAN 1980'));
        $root->method('tree')->willReturn($tree);
        $root->method('spouseFamilies')->willReturn(new Collection([$family]));
        $root->method('childFamilies')->willReturn(new Collection());
        $root->method('findHighlightedMediaFile')->willReturn(null);

        $facade   = new DataFacade();
        $rootNode = $facade->createTreeStructure($module, $configuration, $root);

        self::assertInstanceOf(Node::class, $rootNode);

        $serialized = $rootNode->jsonSerialize();

        // Must have partners
        self::assertArrayHasKey('partners', $serialized);
        self::assertIsArray($serialized['partners']);
        self::assertCount(1, $serialized['partners']);

        // Partner node must have children
        $partnerNode = $serialized['partners'][0];

        $partnerSerialized = $partnerNode->jsonSerialize();
        self::assertArrayHasKey('children', $partnerSerialized);
        self::assertIsArray($partnerSerialized['children']);
        self::assertCount(1, $partnerSerialized['children']);

        // Partner generation must be -1
        $partnerData = $partnerNode->getData()->jsonSerialize();
        self::assertSame(-1, $partnerData['generation']);

        // Child generation must be -2
        $childNode = $partnerSerialized['children'][0];
        $childData = $childNode->getData()->jsonSerialize();
        self::assertSame(-2, $childData['generation']);

        // No partners when showDescendants is false
        $configNoDesc = $this->createConfiguration(['showDescendants' => '0']);

        $facade2   = new DataFacade();
        $rootNode2 = $facade2->createTreeStructure($module, $configNoDesc, $root);
        self::assertNotNull($rootNode2);
        $ser2 = $rootNode2->jsonSerialize();

        self::assertArrayNotHasKey('partners', $ser2);
    }

    /**
     * The compact timespan of a descendant child is built from the structured
     * years. Years below one thousand have fewer than four digits and years
     * before the common era have a suffix, and it must still carry them instead
     * of silently dropping the dates.
     *
     * @return array<string, array{string, string, string}>
     */
    public static function compactTimespanProvider(): array
    {
        return [
            'both years below one thousand'           => ['1 JAN 923', '1 JAN 987', '923–987'],
            'birth year below one thousand'           => ['1 JAN 923', '', "\u{2605} 923"],
            'both years before the common era'        => ['1 JAN 44 B.C.', '1 JAN 10 B.C.', "44\u{a0}BCE–10\u{a0}BCE"],
            'four digit years'                        => ['1 JAN 1853', '1 JAN 1933', '1853–1933'],
            'death year only'                         => ['', '1 JAN 987', "\u{2020} 987"],
            'no dates'                                => ['', '', ''],
            'julian calendar year without era suffix' => ['@#DJULIAN@ 1 JAN 1700', '', "\u{2605} 1700"],
        ];
    }

    /**
     * A descendant child carries the year-only timespan next to its regular
     * timespan, so the client can choose by the width of the arc.
     */
    #[Test]
    #[DataProvider('compactTimespanProvider')]
    public function descendantChildrenCarryACompactTimespan(
        string $birth,
        string $death,
        string $expected,
    ): void {
        $childData = $this->buildDescendantChildData($birth, $death)->jsonSerialize();

        self::assertSame($expected, $childData['compactTimespan']);
    }

    /**
     * The places and the regular timespan of a child do not depend on the
     * fan degree, because the client decides about the compact form.
     */
    #[Test]
    public function descendantChildrenKeepThePlacesWhateverTheFanDegree(): void
    {
        $narrow = $this->buildDescendantChildData('1 JAN 923', '1 JAN 987', Configuration::MAX_FAN_DEGREE_WITH_DESCENDANTS)->jsonSerialize();
        $wide   = $this->buildDescendantChildData('1 JAN 923', '1 JAN 987', 0)->jsonSerialize();

        self::assertSame('Rome, Italy', $narrow['birthPlace']);
        self::assertSame('Paris, France', $narrow['deathPlace']);
        self::assertStringContainsString('Rome, Italy', $narrow['timespan']);
        self::assertStringContainsString('Paris, France', $narrow['timespan']);
        self::assertStringContainsString('Rome, Italy', $wide['timespan']);
        self::assertStringContainsString('Paris, France', $wide['timespan']);
        self::assertSame($wide['timespan'], $narrow['timespan']);
    }

    /**
     * A descendant child never shows a marriage date of its own or of its
     * parents, whatever the arc width.
     */
    #[Test]
    public function descendantChildrenCarryNoMarriageDates(): void
    {
        $childData = $this->buildDescendantChildData('1 JAN 923', '1 JAN 987', 0)->jsonSerialize();

        self::assertSame(-2, $childData['generation']);
        self::assertSame('', $childData['marriageDate']);
        self::assertSame('', $childData['marriageDateOfParents']);
    }

    /**
     * The children of a partner hidden by privacy are attached to the root and
     * are built like the children of a visible partner.
     */
    #[Test]
    public function childrenOfAHiddenPartnerAreBuiltLikeOtherDescendantChildren(): void
    {
        $childData = $this->buildDescendantChildData('1 JAN 923', '1 JAN 987', Configuration::MAX_FAN_DEGREE_WITH_DESCENDANTS, true)->jsonSerialize();

        self::assertSame(-2, $childData['generation']);
        self::assertSame('', $childData['marriageDate']);
        self::assertSame('', $childData['marriageDateOfParents']);
        self::assertSame('923–987', $childData['compactTimespan']);
        self::assertSame('Rome, Italy', $childData['birthPlace']);
    }

    /**
     * Without the detail panel the payload carries no facts, so the default chart
     * pays neither their size nor their database work.
     */
    #[Test]
    public function leavesTheFactsOutWhileTheDetailPanelIsOff(): void
    {
        $factReads = new ArrayObject();
        $root      = $this->createPersonWithFacts('OCCU', ['OCCU' => $this->createFact('Occupation', '', '', 'Smith')], $factReads);

        $data = $this->buildRootData($root, ['generations' => '1']);

        self::assertArrayNotHasKey('facts', $data->jsonSerialize());
        self::assertSame([], $factReads->getArrayCopy(), 'the facts of the person are not read at all');
    }

    /**
     * The read of the facts that the test above rules out is the one that the panel needs, so the
     * log of reads discriminates and is not empty by construction.
     */
    #[Test]
    public function readsTheFactsOfThePersonWhileTheDetailPanelIsOn(): void
    {
        $factReads = new ArrayObject();
        $root      = $this->createPersonWithFacts('OCCU', ['OCCU' => $this->createFact('Occupation', '', '', 'Smith')], $factReads);

        $this->buildRootData($root, ['generations' => '1', 'showDetailPanel' => '1']);

        self::assertContains('OCCU', $factReads->getArrayCopy());
    }

    /**
     * With the detail panel on, the payload of a person carries the birth, the
     * death and one slot for every tag the tree names for the chart box. A slot
     * the person has no fact for is null.
     */
    #[Test]
    public function handsOverOneFactSlotPerRowWhileTheDetailPanelIsOn(): void
    {
        $root = $this->createPersonWithFacts(
            'OCCU',
            [
                'BIRT' => $this->createFact('Birth', 'Berlin, Germany', 'Berlin', ''),
                'OCCU' => $this->createFact('Occupation', '', '', 'Smith'),
            ]
        );

        $data = $this->buildRootData($root, ['generations' => '1', 'showDetailPanel' => '1']);

        self::assertSame(
            [
                [
                    'tag'       => 'BIRT',
                    'label'     => 'Birth',
                    'date'      => '',
                    'place'     => 'Berlin, Germany',
                    'placeFull' => 'Berlin, Germany',
                    'value'     => '',
                    'partner'   => '',
                    'sortDay'   => 0,
                ],
                null,
                [
                    'tag'       => 'OCCU',
                    'label'     => 'Occupation',
                    'date'      => '',
                    'place'     => '',
                    'placeFull' => '',
                    'value'     => 'Smith',
                    'partner'   => '',
                    'sortDay'   => 0,
                ],
            ],
            $this->serialisedFacts($data)
        );
    }

    /**
     * The panel opens for every arc of the chart, so the persons of the ancestor
     * generations and the descendants carry their facts as well.
     */
    #[Test]
    public function handsOverTheFactsToAncestorsAndDescendants(): void
    {
        $this->registerRouting();

        $module = self::createStubForIntersectionOfInterfaces([ModuleCustomInterface::class, ModuleAssetUrlInterface::class]);
        $module->method('name')->willReturn('webtrees-fan-chart');

        $tree = $this->createTreeWithChartBoxTags('');

        $father  = $this->createPerson($tree, 'I2', 'M', '1 JAN 1870', '1 JAN 1940', factsByTag: []);
        $child   = $this->createPerson($tree, 'I4', 'M', '1 JAN 1930', '', factsByTag: []);
        $partner = $this->createPerson($tree, 'I5', 'M', '1 JAN 1898', '', factsByTag: []);

        $parentFamily = self::createStub(Family::class);
        $parentFamily->method('husband')->willReturn($father);
        $parentFamily->method('wife')->willReturn(null);
        $parentFamily->method('getMarriageDate')->willReturn($this->createDate(''));

        $ownFamily = self::createStub(Family::class);
        $ownFamily->method('xref')->willReturn('F1');
        $ownFamily->method('husband')->willReturn(null);
        $ownFamily->method('wife')->willReturn(null);
        $ownFamily->method('spouse')->willReturn($partner);
        $ownFamily->method('children')->willReturn(new Collection([$child]));
        $ownFamily->method('getMarriageDate')->willReturn($this->createDate(''));
        $ownFamily->method('facts')->willReturn(new Collection());

        $root = $this->createPerson($tree, 'I1', 'F', '1 JAN 1900', '', $ownFamily, parentFamily: $parentFamily, factsByTag: []);

        $rootNode = (new DataFacade())->createTreeStructure(
            $module,
            $this->createConfiguration(['showDetailPanel' => '1', 'showDescendants' => '1']),
            $root
        );

        self::assertInstanceOf(Node::class, $rootNode);

        $serialized = $rootNode->jsonSerialize();

        self::assertArrayHasKey('parents', $serialized);
        self::assertSame([null, null], $this->serialisedFacts($rootNode->getData()));
        self::assertSame([null, null], $this->serialisedFacts($serialized['parents'][0]->getData()));

        $partnerNode = $serialized['partners'][0] ?? null;

        self::assertInstanceOf(Node::class, $partnerNode);
        self::assertSame([null, null], $this->serialisedFacts($partnerNode->getData()));

        $childNode = $partnerNode->jsonSerialize()['children'][0] ?? null;

        self::assertInstanceOf(Node::class, $childNode);
        self::assertSame([null, null], $this->serialisedFacts($childNode->getData()));
    }

    /**
     * The resolver belongs to the tree of one request. A facade that serves a second
     * request must not keep the tree and the chart box tags of the first one.
     */
    #[Test]
    public function resolvesTheFactsAgainstTheTreeOfTheCurrentRequest(): void
    {
        $this->registerRouting();

        $module = self::createStubForIntersectionOfInterfaces([ModuleCustomInterface::class, ModuleAssetUrlInterface::class]);
        $module->method('name')->willReturn('webtrees-fan-chart');

        $facade        = new DataFacade();
        $configuration = $this->createConfiguration(['generations' => '1', 'showDetailPanel' => '1']);

        $withTag = $this->createPersonWithFacts('OCCU', ['OCCU' => $this->createFact('Occupation', '', '', 'Smith')]);
        $without = $this->createPersonWithFacts('', []);

        $first  = $facade->createTreeStructure($module, $configuration, $withTag);
        $second = $facade->createTreeStructure($module, $configuration, $without);

        self::assertInstanceOf(Node::class, $first);
        self::assertInstanceOf(Node::class, $second);
        self::assertCount(3, $this->serialisedFacts($first->getData()) ?? []);
        self::assertCount(2, $this->serialisedFacts($second->getData()) ?? []);
    }

    /**
     * Builds a real configuration for a chart of two generations with the full
     * place names, from the query parameters of a chart request. The module
     * preferences stay at their defaults, except the place format, which only the
     * module preference can set.
     *
     * @param array<string, string> $query The request parameters that differ from that chart
     *
     * @return Configuration
     */
    private function createConfiguration(array $query): Configuration
    {
        $request = (new ServerRequest('GET', '/'))->withQueryParams(
            $query + [
                'generations' => '2',
            ]
        );

        return new Configuration(
            $request,
            $this->createModuleWithPreferences(['default_placeFormat' => 'full'])
        );
    }

    /**
     * Builds a root with one spouse family and one child and returns the
     * serialised data of the child node. The child has a parent family and a
     * spouse family of its own, both with a marriage date.
     *
     * @param string $birth         The GEDCOM birth date of the child
     * @param string $death         The GEDCOM death date of the child
     * @param int    $fanDegree     The fan degree of the configuration, the clamp maximum for a chart with descendants leaves a narrow descendant sector
     * @param bool   $hiddenPartner True when the partner of the root is hidden by privacy
     *
     * @return NodeData
     */
    private function buildDescendantChildData(
        string $birth,
        string $death,
        int $fanDegree = 0,
        bool $hiddenPartner = false,
    ): NodeData {
        $this->registerRouting();

        $query = [
            'showDescendants' => '1',
            'showPlaces'      => '1',
            'innerArcs'       => '1',
        ];

        // A fan degree of zero stands for the module default.
        if ($fanDegree > 0) {
            $query['fanDegree'] = (string) $fanDegree;
        }

        $configuration = $this->createConfiguration($query);

        $module = self::createStubForIntersectionOfInterfaces([ModuleCustomInterface::class, ModuleAssetUrlInterface::class]);
        $module->method('name')->willReturn('webtrees-fan-chart');

        $tree = self::createStub(Tree::class);
        $tree->method('name')->willReturn('main');
        $tree->method('getPreference')->willReturn('1');

        $spouse = $this->createPerson($tree, 'I2', 'F', '1 JAN 900', '1 JAN 960');

        // The family of the root is also the parent family of the child
        $family = self::createStub(Family::class);

        $childFamily = self::createStub(Family::class);
        $childFamily->method('xref')->willReturn('F2');
        $childFamily->method('getMarriageDate')->willReturn($this->createDate('1 JAN 950'));
        $childFamily->method('facts')->willReturn(new Collection());

        $child = $this->createPerson(
            $tree,
            'I3',
            'M',
            $birth,
            $death,
            $childFamily,
            'Rome, Italy',
            'Paris, France',
            $family,
        );

        $hiddenPartnerFact = self::createStub(Fact::class);
        $hiddenPartnerFact->method('value')->willReturn('@I9@');

        $family->method('xref')->willReturn('F1');
        $family->method('husband')->willReturn(null);
        $family->method('wife')->willReturn(null);
        $family->method('spouse')->willReturn($hiddenPartner ? null : $spouse);
        $family->method('children')->willReturn(new Collection([$child]));
        $family->method('getMarriageDate')->willReturn($this->createDate('1 JAN 920'));
        $family->method('facts')->willReturn($hiddenPartner ? new Collection([$hiddenPartnerFact]) : new Collection());

        $root = $this->createPerson($tree, 'I1', 'M', '1 JAN 890', '1 JAN 950', $family);

        $facade   = new DataFacade();
        $rootNode = $facade->createTreeStructure($module, $configuration, $root);

        self::assertInstanceOf(Node::class, $rootNode);

        $rootData = $rootNode->jsonSerialize();

        if ($hiddenPartner) {
            self::assertArrayHasKey('unassignedChildren', $rootData);

            $childNode = $rootData['unassignedChildren'][0];
        } else {
            self::assertArrayHasKey('partners', $rootData);

            $partnerSerialized = $rootData['partners'][0]->jsonSerialize();
            self::assertArrayHasKey('children', $partnerSerialized);

            $childNode = $partnerSerialized['children'][0];
        }

        self::assertInstanceOf(Node::class, $childNode);

        return $childNode->getData();
    }

    /**
     * Builds the chart for one root person and returns the data of its node.
     *
     * @param array<string, string> $query The request parameters that differ from the default chart
     */
    private function buildRootData(Individual $root, array $query): NodeData
    {
        $this->registerRouting();

        $module = self::createStubForIntersectionOfInterfaces([ModuleCustomInterface::class, ModuleAssetUrlInterface::class]);
        $module->method('name')->willReturn('webtrees-fan-chart');

        $rootNode = (new DataFacade())->createTreeStructure($module, $this->createConfiguration($query), $root);

        self::assertInstanceOf(Node::class, $rootNode);

        return $rootNode->getData();
    }

    /**
     * Creates a tree stub that names the given tags for the chart box.
     */
    private function createTreeWithChartBoxTags(string $chartBoxTags): Tree
    {
        $tree = self::createStub(Tree::class);
        $tree->method('name')->willReturn('main');
        $tree->method('getPreference')->willReturnCallback(
            static fn (string $name): string => ($name === 'CHART_BOX_TAGS') ? $chartBoxTags : '1'
        );

        return $tree;
    }

    /**
     * Creates a root person of a tree with the given chart box tags and facts.
     *
     * @param array<string, Fact>           $factsByTag The fact of each tag
     * @param ArrayObject<int, string>|null $factReads  Receives the tag of every read of the facts of the person
     */
    private function createPersonWithFacts(string $chartBoxTags, array $factsByTag, ?ArrayObject $factReads = null): Individual
    {
        return $this->createPerson(
            $this->createTreeWithChartBoxTags($chartBoxTags),
            'I1',
            'M',
            '1 JAN 1900',
            '',
            factsByTag: $factsByTag,
            factReads: $factReads,
        );
    }

    /**
     * Builds a fact with the given label, place and value, and no date.
     */
    private function createFact(string $label, string $placeFull, string $placeShort, string $value): Fact
    {
        $place = self::createStub(Place::class);
        $place->method('gedcomName')->willReturn($placeFull);
        $place->method('firstParts')->willReturn(new Collection($placeShort === '' ? [] : [$placeShort]));

        $fact = self::createStub(Fact::class);
        $fact->method('label')->willReturn($label);
        $fact->method('date')->willReturn(new Date(''));
        $fact->method('place')->willReturn($place);
        $fact->method('value')->willReturn($value);

        return $fact;
    }

    /**
     * Returns the facts that the browser receives for a node, or null when the
     * payload carries none.
     *
     * @return list<array<string, int|string>|null>|null
     */
    private function serialisedFacts(NodeData $data): ?array
    {
        /** @var array{facts?: list<array<string, int|string>|null>} $serialised */
        $serialised = json_decode(json_encode($data, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);

        return $serialised['facts'] ?? null;
    }

    /**
     * Sets up the route factory and container required by DataFacade.
     */
    private function registerRouting(): void
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

        $container = new readonly class($routeFactory) implements ContainerInterface {
            public function __construct(private RouteFactoryInterface $routeFactory)
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

        Registry::routeFactory($routeFactory);
        Registry::container($container);
    }

    /**
     * Builds a fake name set matching webtrees output structure.
     *
     * @return list<array<string, string|bool|array<string>>>
     */
    private function buildNameSet(string $firstName, string $lastName): array
    {
        return [
            [
                'type'                    => 'NAME',
                'fullNN'                  => $firstName . ' <span class="NAME"><span class="SURN">' . $lastName . '</span></span>',
                'full'                    => $firstName . ' <span class="NAME"><span class="SURN">' . $lastName . '</span></span>',
                'sort'                    => $lastName . ', ' . $firstName,
                'list'                    => $firstName . ' ' . $lastName,
                'surname'                 => $lastName,
                'addname'                 => '',
                'prefix'                  => '',
                'surn'                    => $lastName,
                'givn'                    => $firstName,
                'initials'                => $firstName[0] . ' ' . $lastName[0],
                'spfx'                    => '',
                'nsfx'                    => '',
                'nickname'                => '',
                'display_as'              => 'default',
                'type_label'              => 'Name',
                'surname_prefix'          => '',
                'show'                    => true,
                'script'                  => 'Latn',
                'parts'                   => [],
                'prim'                    => 'Y',
                'type_id'                 => '0',
                'fullNNalternativeRender' => $firstName . ' <span class="SURN">' . $lastName . '</span>',
            ],
        ];
    }

    /**
     * Creates an individual stub with a visible name, the given dates and no
     * parents. The optional family is the individual's only spouse family.
     *
     * @param array<string, Fact>|null      $factsByTag The fact of each tag, or null for a person without a facts stub
     * @param ArrayObject<int, string>|null $factReads  Receives the tag of every read of the facts of the person
     *
     * @return Individual&Stub
     */
    private function createPerson(
        Tree $tree,
        string $xref,
        string $sex,
        string $birth,
        string $death,
        ?Family $spouseFamily = null,
        string $birthPlace = '',
        string $deathPlace = '',
        ?Family $parentFamily = null,
        ?array $factsByTag = null,
        ?ArrayObject $factReads = null,
    ): Individual {
        $person = self::createStub(Individual::class);
        $person->method('xref')->willReturn($xref);
        $person->method('url')->willReturn('/individual/' . $xref);
        $person->method('sex')->willReturn($sex);
        $person->method('fullName')->willReturn('Person ' . $xref);
        $person->method('canShow')->willReturn(true);
        $person->method('canShowName')->willReturn(true);
        $person->method('getAllNames')->willReturn($this->buildNameSet('Person', $xref));
        $person->method('getPrimaryName')->willReturn(0);
        $person->method('getSecondaryName')->willReturn(0);
        $person->method('getBirthDate')->willReturn($this->createDate($birth));
        $person->method('getDeathDate')->willReturn($this->createDate($death));
        $person->method('tree')->willReturn($tree);

        if ($birthPlace !== '') {
            $person->method('getBirthPlace')->willReturn(new Place($birthPlace, $tree));
        }

        if ($deathPlace !== '') {
            $person->method('getDeathPlace')->willReturn(new Place($deathPlace, $tree));
        }

        $person->method('spouseFamilies')->willReturn(
            ($spouseFamily instanceof Family) ? new Collection([$spouseFamily]) : new Collection()
        );
        $person->method('childFamilies')->willReturn(
            ($parentFamily instanceof Family) ? new Collection([$parentFamily]) : new Collection()
        );
        $person->method('findHighlightedMediaFile')->willReturn(null);

        if ($factsByTag !== null) {
            $person->method('facts')->willReturnCallback(
                static function (array $filter = []) use ($factsByTag, $factReads): Collection {
                    $first = $filter[0] ?? '';
                    $tag   = is_string($first) ? $first : '';

                    $factReads?->append($tag);

                    return new Collection(isset($factsByTag[$tag]) ? [$factsByTag[$tag]] : []);
                }
            );
        }

        return $person;
    }

    /**
     * Creates a date instance with predefined values for testing.
     */
    private function createDate(string $display): Date
    {
        return new Date($display);
    }
}
