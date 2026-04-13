<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Facade;

use Aura\Router\Map;
use Aura\Router\Route;
use Fisharebest\Localization\Locale;
use Fisharebest\Localization\Translator;
use Fisharebest\Webtrees\Contracts\ContainerInterface;
use Fisharebest\Webtrees\Contracts\RouteFactoryInterface;
use Fisharebest\Webtrees\Date;
use Fisharebest\Webtrees\Factories\CalendarDateFactory;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\Validator;
use GuzzleHttp\Psr7\ServerRequest;
use Illuminate\Support\Collection;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Model\Node;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

use function array_map;

/**
 * Validates tree construction and data extraction performed by the facade.
 */
#[CoversClass(DataFacade::class)]
final class DataFacadeTest extends TestCase
{
    /**
     * Prepares router and translation context required by the facade.
     */
    protected function setUp(): void
    {
        parent::setUp();

        Validator::serverParams(new ServerRequest('GET', '/'));
        Registry::calendarDateFactory(new CalendarDateFactory());

        $locale     = Locale::create('en');
        $translator = new Translator([], $locale->pluralRule());

        $localeProperty = new ReflectionProperty(I18N::class, 'locale');
        $localeProperty->setValue(null, $locale);

        $translatorProperty = new ReflectionProperty(I18N::class, 'translator');
        $translatorProperty->setValue(null, $translator);
    }

    /**
     * Ensures the facade builds a node hierarchy respecting generation limits and URLs.
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

        $configuration = self::createStub(Configuration::class);
        $configuration->method('getGenerations')->willReturn(2);

        $module = self::createStub(ModuleCustomInterface::class);
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
        self::assertSame('/route/module?module=webtrees-fan-chart&action=update&xref=I1&tree=main&generations=2&detailedDateGenerations=0&showPlaces=0&placeParts=0&showDescendants=0', $serializedData['updateUrl']);

        $serialized = $rootNode->jsonSerialize();

        self::assertArrayHasKey('parents', $serialized);
        /** @var array<int, Node> $parents */
        $parents = $serialized['parents'];

        self::assertCount(2, $parents);
        $parentIds = array_map(static fn (Node $node): int => $node->getData()->getId(), $parents);
        self::assertSame([2, 3], $parentIds);
    }

    /**
     * Ensures descendants (partners + children) are included when showDescendants is true.
     */
    #[Test]
    public function treeStructureIncludesDescendantsWhenEnabled(): void
    {
        $this->setUpRouting();

        $configuration = self::createStub(Configuration::class);
        $configuration->method('getGenerations')->willReturn(2);
        $configuration->method('getShowDescendants')->willReturn(true);

        $module = self::createStub(ModuleCustomInterface::class);
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
        self::assertInstanceOf(Node::class, $partnerNode);

        $partnerSerialized = $partnerNode->jsonSerialize();
        self::assertArrayHasKey('children', $partnerSerialized);
        self::assertIsArray($partnerSerialized['children']);
        self::assertCount(1, $partnerSerialized['children']);

        // Partner generation must be -1
        $partnerData = $partnerNode->getData()->jsonSerialize();
        self::assertSame(-1, $partnerData['generation']);

        // Child generation must be -2
        $childNode = $partnerSerialized['children'][0];
        self::assertInstanceOf(Node::class, $childNode);
        $childData = $childNode->getData()->jsonSerialize();
        self::assertSame(-2, $childData['generation']);

        // No partners when showDescendants is false
        $configNoDesc = self::createStub(Configuration::class);
        $configNoDesc->method('getGenerations')->willReturn(2);
        $configNoDesc->method('getShowDescendants')->willReturn(false);

        $facade2   = new DataFacade();
        $rootNode2 = $facade2->createTreeStructure($module, $configNoDesc, $root);
        self::assertNotNull($rootNode2);
        $ser2 = $rootNode2->jsonSerialize();

        self::assertArrayNotHasKey('partners', $ser2);
    }

    /**
     * Sets up the route factory and container required by DataFacade.
     */
    private function setUpRouting(): void
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
     * @return array<int, array<string, string|bool|array<string>>>
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
     * Creates a date instance with predefined values for testing.
     */
    private function createDate(string $display): Date
    {
        return new Date($display);
    }
}
