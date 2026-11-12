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
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\IndividualFactoryInterface;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Factories\CacheFactory;
use Fisharebest\Webtrees\Factories\CalendarDateFactory;
use Fisharebest\Webtrees\Factories\ResponseFactory;
use Fisharebest\Webtrees\Http\Exceptions\HttpAccessDeniedException;
use Fisharebest\Webtrees\Http\Exceptions\HttpNotFoundException;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleChartInterface;
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
use MagicSunday\Webtrees\FanChart\Support\ContextText;
use MagicSunday\Webtrees\FanChart\Test\Support\IndividualFixtureTrait;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\FanChart\Test\Support\ViewFixture;
use MagicSunday\Webtrees\ModuleBase\Testing\EnglishLocaleFixture;
use MagicSunday\Webtrees\ModuleBase\Testing\RoutingFixture;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

use function array_diff;
use function array_keys;
use function array_values;
use function json_decode;
use function parse_str;
use function parse_url;
use function preg_match;

use const JSON_THROW_ON_ERROR;
use const PHP_URL_QUERY;

/**
 * Drives the request entry points of the module, the page and chart request of handle() and the
 * update action, through the access checks and the page title.
 */
#[CoversClass(Module::class)]
#[UsesClass(Configuration::class)]
#[UsesClass(DataFacade::class)]
#[UsesClass(Node::class)]
#[UsesClass(NodeData::class)]
#[UsesClass(ContextText::class)]
final class ModuleRequestTest extends TestCase
{
    use IndividualFixtureTrait;
    use ModuleSettingsFixtureTrait;

    private const int TREE_ID = 7;

    /**
     * A value for every setting of the form that the chart URLs carry, each different from the
     * built-in default of its setting, so a setting that a URL leaves out shows as the default or as
     * a missing key. The fan degree stays below the ceiling that applies while descendants are shown.
     */
    private const array SETTINGS = [
        'generations'             => '4',
        'fanDegree'               => '250',
        'fontScale'               => '120',
        'hideEmptySegments'       => '0',
        'showFamilyColors'        => '0',
        'showPlaces'              => '1',
        'showParentMarriageDates' => '1',
        'showImages'              => '1',
        'showNames'               => '0',
        'showNicknames'           => '1',
        'innerArcs'               => '4',
        'paternalColor'           => '#112233',
        'maternalColor'           => '#445566',
        'showDescendants'         => '1',
        'showDetailPanel'         => '1',
    ];

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
     * The browser finds the container of the chart by an id that the partial generates for each
     * answer, and it loads the bundle of the module version that the page was built for. A partial
     * without the id leaves the script without its container, and a wrong bundle name is a script
     * that does not exist. The script reads the labels and the text direction of the chart parameters
     * from the same answer.
     */
    #[Test]
    public function theChartPartialNamesItsContainerAndLoadsTheBundleOfTheModuleVersion(): void
    {
        $response = $this->createModule()->handle($this->chartRequest($this->createChartIndividual(), true));
        $body     = (string) $response->getBody();

        self::assertMatchesRegularExpression('/id="webtrees-fan-chart-container-[0-9a-f]+"/', $body);
        self::assertMatchesRegularExpression('/labels: \{"[a-zA-Z]+":"[^"]+"/', $body);
        self::assertStringContainsString('rtl: false,', $body);
        self::assertMatchesRegularExpression(
            '/import\("[^"]*js%2Ffan-chart-' . preg_quote(Module::CUSTOM_VERSION, '/') . '\.min\.js[^"]*"\)/',
            $body
        );
    }

    /**
     * The page tells the script which URL loads the chart partial. That URL asks for the partial
     * with the ajax flag and names the person and every setting of the request, so the partial that
     * the script fetches is the chart of the page and not the page shell again.
     */
    #[Test]
    public function thePageNamesTheChartPartialInItsAjaxUrl(): void
    {
        // The script of the page is pushed onto a stack, which the layout of the test does not print.
        View::stack('javascript');

        $this->createModule()->handle($this->chartRequest($this->createChartIndividual(), false, self::SETTINGS));

        self::assertSame(
            1,
            preg_match('/ajaxUrl:\s+("(?:[^"\\\\]|\\\\.)*")/', View::stack('javascript'), $matches),
            'the page hands an ajax URL to the script'
        );

        $url = json_decode($matches[1], true, 512, JSON_THROW_ON_ERROR);

        self::assertIsString($url);
        self::assertStringStartsWith('/route/webtrees-fan-chart?', $url);

        $query = $this->queryOf($url);

        self::assertSame('1', $query['ajax'] ?? null);
        self::assertSame('I1', $query['xref'] ?? null);
        self::assertSame('main', $query['tree'] ?? null);

        foreach (self::SETTINGS as $key => $value) {
            self::assertSame($value, $query[$key] ?? null, 'the setting ' . $key . ' travels with the URL');
        }

        self::assertSame(
            [],
            array_values(array_diff(array_keys($query), ['ajax', 'xref', 'tree', ...array_keys(self::SETTINGS)])),
            'the URL carries no setting that the test does not know'
        );
    }

    /**
     * A form post is answered with a redirect to the pretty URL of the person that the post names.
     * The URL carries the tree, the person and every setting that the post names, so the address bar
     * shows the chart that was asked for and a reload shows the same chart again.
     */
    #[Test]
    public function aFormPostIsRedirectedToThePrettyUrlOfThePerson(): void
    {
        $this->registerIndividual($this->createChartIndividual());

        $request = (new ServerRequest(RequestMethodInterface::METHOD_POST, '/'))
            ->withAttribute('tree', $this->tree)
            ->withAttribute('user', self::createStub(UserInterface::class))
            ->withAttribute('xref', 'I1')
            ->withParsedBody(['xref' => 'I7', ...self::SETTINGS]);

        $response = $this->createModule()->handle($request);

        self::assertSame(302, $response->getStatusCode());

        $location = $response->getHeaderLine('Location');

        self::assertStringStartsWith('/route/webtrees-fan-chart?', $location);

        $query = $this->queryOf($location);

        self::assertSame('main', $query['tree'] ?? null);
        self::assertSame('I7', $query['xref'] ?? null, 'the person comes from the body of the post');

        foreach (self::SETTINGS as $key => $value) {
            self::assertSame($value, $query[$key] ?? null, 'the setting ' . $key . ' is carried over');
        }

        self::assertSame(
            [],
            array_values(array_diff(array_keys($query), ['tree', 'xref', ...array_keys(self::SETTINGS)])),
            'the URL carries no setting that the test does not know'
        );
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

        /** @var array{title: string, titleText: string, data: array{data: array{xref: string}}} $payload */
        $payload = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame('Fan chart of Person I1', $payload['title']);
        self::assertSame('Fan chart of Person I1', $payload['titleText']);
        self::assertSame('I1', $payload['data']['data']['xref']);
    }

    /**
     * The heading keeps the markup of the name, and the browser tab gets the same title as plain
     * text, with the markup removed and the entities of the escaped name decoded.
     */
    #[Test]
    public function theUpdateActionAnswersWithAPlainTextTitleNextToTheMarkupOne(): void
    {
        $name = '<span class="NAME" dir="auto" translate="no">Jane &amp; <span class="SURN">&lt;b&gt;O&#039;Doe</span> <q class="wt-nickname">Jay</q></span>';

        $response = $this->createModule()->getUpdateAction(
            $this->updateRequest($this->createChartIndividual($name))
        );

        /** @var array{title: string, titleText: string} $payload */
        $payload = json_decode((string) $response->getBody(), true, 512, JSON_THROW_ON_ERROR);

        self::assertSame('Fan chart of ' . $name, $payload['title']);
        self::assertSame("Fan chart of Jane & <b>O'Doe Jay", $payload['titleText']);
    }

    /**
     * Returns the query parameters of a URL.
     *
     * @return array<string, string>
     */
    private function queryOf(string $url): array
    {
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        /** @var array<string, string> $query */
        return $query;
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
    private function createChartIndividual(?string $fullName = null): Individual
    {
        return $this->createPerson($this->tree, 'I1', 'M', '1 JAN 1900', '1 JAN 1980', fullName: $fullName);
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
     *
     * @param array<string, string> $settings Further query parameters, the settings of the form
     */
    private function chartRequest(?Individual $individual, bool $ajax, array $settings = []): ServerRequestInterface
    {
        $this->registerIndividual($individual);

        return $this->request()
            ->withQueryParams($ajax ? ['ajax' => '1'] + $settings : $settings)
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
        RoutingFixture::register([
            ServerRequestInterface::class   => new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
            ResponseFactoryInterface::class => new HttpFactory(),
        ]);
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
