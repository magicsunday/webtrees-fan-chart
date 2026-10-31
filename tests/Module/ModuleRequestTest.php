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
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\ContainerInterface;
use Fisharebest\Webtrees\Contracts\IndividualFactoryInterface;
use Fisharebest\Webtrees\Contracts\RouteFactoryInterface;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Factories\CacheFactory;
use Fisharebest\Webtrees\Factories\CalendarDateFactory;
use Fisharebest\Webtrees\Factories\ResponseFactory;
use Fisharebest\Webtrees\Http\Exceptions\HttpAccessDeniedException;
use Fisharebest\Webtrees\Http\Exceptions\HttpNotFoundException;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleChartInterface;
use Fisharebest\Webtrees\Module\ModuleThemeInterface;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\Validator;
use Fisharebest\Webtrees\View;
use GuzzleHttp\Psr7\HttpFactory;
use GuzzleHttp\Psr7\ServerRequest;
use Illuminate\Database\Schema\Blueprint;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\FanChart\Test\Support\EnglishLocaleFixture;
use MagicSunday\Webtrees\FanChart\Test\Support\IndividualFixtureTrait;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\FanChart\Test\Support\ViewFixture;
use OutOfBoundsException;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

use function http_build_query;
use function json_decode;
use function preg_match;

use const JSON_THROW_ON_ERROR;

/**
 * Drives the request entry points of the module, the page and chart request of handle() and the
 * update action, through the access checks and the page title.
 */
#[CoversClass(Module::class)]
#[UsesClass(Configuration::class)]
#[UsesClass(DataFacade::class)]
#[UsesClass(Node::class)]
#[UsesClass(NodeData::class)]
final class ModuleRequestTest extends TestCase
{
    use IndividualFixtureTrait;
    use ModuleSettingsFixtureTrait;

    private const int TREE_ID = 7;

    /**
     * The tree of the request, which the people of the test belong to.
     */
    private Tree $tree;

    /**
     * Prepares the container, the registry, the views and the database that a request needs.
     */
    protected function setUp(): void
    {
        parent::setUp();

        EnglishLocaleFixture::install();
        Validator::serverParams(new ServerRequest(RequestMethodInterface::METHOD_GET, '/'));
        Registry::calendarDateFactory(new CalendarDateFactory());
        ViewFixture::register();
        View::registerCustomView('::layouts/default', 'fan-test::layout');

        Registry::cache(new CacheFactory());
        Registry::responseFactory(new ResponseFactory(new HttpFactory(), new HttpFactory()));
        $this->registerContainer();
        $this->resetModulePrivacy();
    }

    /**
     * The two shapes of a chart request that handle() answers beside the redirect of a form post.
     *
     * @return array<string, array{bool}>
     */
    public static function chartRequestProvider(): array
    {
        return [
            'page shell'    => [false],
            'chart partial' => [true],
        ];
    }

    /**
     * A visitor is turned away when the administration shows the chart to members only, for the
     * page and for the chart partial alike.
     */
    #[Test]
    #[DataProvider('chartRequestProvider')]
    public function aVisitorIsTurnedAwayWhenTheChartIsForMembersOnly(bool $ajax): void
    {
        $this->restrictModuleTo(Auth::PRIV_USER);

        $this->expectException(HttpAccessDeniedException::class);

        $this->createModule()->handle($this->chartRequest($this->createVisibleIndividual(), $ajax));
    }

    /**
     * The component check lets a visitor in while the administration shows the chart to visitors.
     */
    #[Test]
    #[DataProvider('chartRequestProvider')]
    public function aVisitorSeesTheChartWhileTheAdministrationShowsItToVisitors(bool $ajax): void
    {
        $response = $this->createModule()->handle($this->chartRequest($this->createChartIndividual(), $ajax));

        self::assertSame(200, $response->getStatusCode());
        self::assertNotSame('', (string) $response->getBody());
    }

    /**
     * An unknown person is not found, whichever shape the request has.
     */
    #[Test]
    #[DataProvider('chartRequestProvider')]
    public function anUnknownPersonIsNotFound(bool $ajax): void
    {
        $this->expectException(HttpNotFoundException::class);

        $this->createModule()->handle($this->chartRequest(null, $ajax));
    }

    /**
     * A person that the visitor may not see is refused, whichever shape the request has.
     */
    #[Test]
    #[DataProvider('chartRequestProvider')]
    public function aPersonTheVisitorMayNotSeeIsRefused(bool $ajax): void
    {
        $this->expectException(HttpAccessDeniedException::class);

        $this->createModule()->handle($this->chartRequest($this->createHiddenIndividual(), $ajax));
    }

    /**
     * The page shows the name of a person that is visible in its title.
     */
    #[Test]
    public function thePageTitleCarriesTheNameOfAVisiblePerson(): void
    {
        $response = $this->createModule()->handle($this->chartRequest($this->createVisibleIndividual(), false));

        self::assertSame('Fan chart of Jane Doe', $this->pageTitleOf($response));
    }

    /**
     * A tree can show the relationships of private people, so the chart of a person whose name is
     * hidden is built. The title then names no one.
     */
    #[Test]
    public function thePageTitleNamesNoOneWhenTheNameIsHidden(): void
    {
        $this->tree = $this->createTree(['SHOW_PRIVATE_RELATIONSHIPS' => '1']);

        $response = $this->createModule()->handle(
            $this->chartRequest($this->createHiddenIndividual(), false)
        );

        self::assertSame('Fan chart', $this->pageTitleOf($response));
        self::assertStringNotContainsString('Jane Doe', (string) $response->getBody());
    }

    /**
     * The chart partial carries the chart of the requested person.
     */
    #[Test]
    public function theChartPartialCarriesTheDataOfTheRequestedPerson(): void
    {
        $response = $this->createModule()->handle($this->chartRequest($this->createChartIndividual(), true));
        $body     = (string) $response->getBody();

        self::assertStringContainsString('webtrees-fan-chart-container-', $body);
        self::assertStringContainsString('"xref":"I1"', $body);
        self::assertStringNotContainsString('webtrees-fan-chart-form', $body, 'the partial has no page shell around it');
    }

    /**
     * The update action refuses a visitor while the chart is for members only.
     */
    #[Test]
    public function theUpdateActionTurnsAVisitorAwayWhenTheChartIsForMembersOnly(): void
    {
        $this->restrictModuleTo(Auth::PRIV_USER);

        $this->expectException(HttpAccessDeniedException::class);

        $this->createModule()->getUpdateAction($this->updateRequest($this->createVisibleIndividual()));
    }

    /**
     * The update action does not find an unknown person.
     */
    #[Test]
    public function theUpdateActionDoesNotFindAnUnknownPerson(): void
    {
        $this->expectException(HttpNotFoundException::class);

        $this->createModule()->getUpdateAction($this->updateRequest(null));
    }

    /**
     * The update action refuses a person the visitor may not see.
     */
    #[Test]
    public function theUpdateActionRefusesAPersonTheVisitorMayNotSee(): void
    {
        $this->expectException(HttpAccessDeniedException::class);

        $this->createModule()->getUpdateAction($this->updateRequest($this->createHiddenIndividual()));
    }

    /**
     * The update action answers with the title and the chart of the person.
     */
    #[Test]
    public function theUpdateActionAnswersWithTheTitleAndTheChartOfThePerson(): void
    {
        $response = $this->createModule()->getUpdateAction($this->updateRequest($this->createChartIndividual()));

        /** @var array{title: string, data: array{data: array{xref: string}}} $payload */
        $payload = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame('Fan chart of Person I1', $payload['title']);
        self::assertSame('I1', $payload['data']['data']['xref']);
    }

    /**
     * Returns the text of the title heading of the rendered page.
     */
    private function pageTitleOf(ResponseInterface $response): string
    {
        self::assertSame(1, preg_match('#<h2 class="wt-page-title">(.*?)</h2>#s', (string) $response->getBody(), $matches));

        return trim($matches[1]);
    }

    /**
     * Creates a module with the name that its views and its access level are registered under.
     */
    private function createModule(): Module
    {
        return $this->createModuleWithPreferences([]);
    }

    /**
     * Creates a person that the visitor sees with the name Jane Doe, as far as the page needs it.
     */
    private function createVisibleIndividual(): Individual
    {
        $individual = self::createStub(Individual::class);
        $individual->method('xref')->willReturn('I1');
        $individual->method('fullName')->willReturn('Jane Doe');
        $individual->method('canShow')->willReturn(true);
        $individual->method('canShowName')->willReturn(true);
        $individual->method('tree')->willReturn($this->tree);

        return $individual;
    }

    /**
     * Creates a private person: neither the person nor the name is visible.
     */
    private function createHiddenIndividual(): Individual
    {
        $individual = self::createStub(Individual::class);
        $individual->method('xref')->willReturn('I1');
        $individual->method('fullName')->willReturn('Jane Doe');
        $individual->method('canShow')->willReturn(false);
        $individual->method('canShowName')->willReturn(false);
        $individual->method('tree')->willReturn($this->tree);

        return $individual;
    }

    /**
     * Creates a person with everything that the facade reads for the chart.
     */
    private function createChartIndividual(): Individual
    {
        return $this->createPerson($this->tree, 'I1', 'M', '1 JAN 1900', '1 JAN 1980');
    }

    /**
     * Creates the tree of the request.
     *
     * @param array<string, string> $preferences The tree preferences that differ from the defaults, which are
     *                                           "1" for every preference except the display of private relationships
     */
    private function createTree(array $preferences = []): Tree
    {
        $tree = self::createStub(Tree::class);
        $tree->method('id')->willReturn(self::TREE_ID);
        $tree->method('name')->willReturn('main');
        $tree->method('getPreference')->willReturnCallback(
            static fn (string $name): string => $preferences[$name] ?? (($name === 'SHOW_PRIVATE_RELATIONSHIPS') ? '0' : '1')
        );

        return $tree;
    }

    /**
     * Builds the GET request of the chart page or of the chart partial for the person that the
     * factory finds, or for no person.
     */
    private function chartRequest(?Individual $individual, bool $ajax): ServerRequestInterface
    {
        $this->registerIndividual($individual);

        return $this->request()
            ->withQueryParams($ajax ? ['ajax' => '1'] : [])
            ->withAttribute('xref', 'I1');
    }

    /**
     * Builds the request of the update action for the person that the factory finds, or for no person.
     */
    private function updateRequest(?Individual $individual): ServerRequestInterface
    {
        $this->registerIndividual($individual);

        return $this->request()->withQueryParams(['xref' => 'I1']);
    }

    /**
     * Builds a request of a visitor in the tree of the test.
     */
    private function request(): ServerRequestInterface
    {
        return (new ServerRequest(RequestMethodInterface::METHOD_GET, '/'))
            ->withAttribute('tree', $this->tree)
            ->withAttribute('user', self::createStub(UserInterface::class));
    }

    /**
     * Lets the individual factory find the given person, or none.
     */
    private function registerIndividual(?Individual $individual): void
    {
        $factory = self::createStub(IndividualFactoryInterface::class);
        $factory->method('make')->willReturn($individual);

        Registry::individualFactory($factory);
    }

    /**
     * Registers the route factory and the container with the services that the module asks for while
     * it answers a request.
     */
    private function registerContainer(): void
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

        $theme = self::createStub(ModuleThemeInterface::class);
        $theme->method('stylesheets')->willReturn(['/theme.css']);

        $services = [
            RouteFactoryInterface::class  => $routeFactory,
            ModuleThemeInterface::class   => $theme,
            ServerRequestInterface::class => new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
        ];

        $container = new readonly class($services) implements ContainerInterface {
            /**
             * @param array<string, object> $services The services by id
             */
            public function __construct(private array $services)
            {
            }

            public function get(string $id): object
            {
                return $this->services[$id] ?? throw new OutOfBoundsException('The container has no service ' . $id);
            }

            public function has(string $id): bool
            {
                return isset($this->services[$id]);
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
     * Empties the access levels of the modules and gives the tests the table that holds them.
     */
    private function resetModulePrivacy(): void
    {
        $this->tree = $this->createTree();

        // The table lives in the in-memory database that the preference fixture boots.
        $this->createModuleWithPreferences([]);

        $schema = DB::connection()->getSchemaBuilder();

        if (!$schema->hasTable('module_privacy')) {
            $schema->create('module_privacy', static function (Blueprint $table): void {
                $table->integer('gedcom_id');
                $table->string('module_name');
                $table->string('interface');
                $table->integer('access_level');
            });
        }

        DB::table('module_privacy')->delete();
    }

    /**
     * Stores the access level that the administration sets for the chart interface of the module.
     */
    private function restrictModuleTo(int $accessLevel): void
    {
        DB::table('module_privacy')->insert([
            'gedcom_id'    => self::TREE_ID,
            'module_name'  => 'webtrees-fan-chart',
            'interface'    => ModuleChartInterface::class,
            'access_level' => $accessLevel,
        ]);
    }
}
