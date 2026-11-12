<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Facade;

use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Factories\CacheFactory;
use Fisharebest\Webtrees\GuestUser;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\ChartService;
use Fisharebest\Webtrees\Services\UserService;
use Fisharebest\Webtrees\Session;
use Fisharebest\Webtrees\Site;
use Fisharebest\Webtrees\Tree;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\FanChart\Test\Support\RealTreeFixtureTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;

use function array_map;
use function array_merge;
use function count;
use function implode;
use function intdiv;
use function json_decode;
use function json_encode;
use function max;
use function range;
use function str_contains;
use function strval;

use const JSON_THROW_ON_ERROR;

/**
 * Counts the database statements that one request of the chart sends, over a real imported
 * tree. The tree is a complete pedigree, so every person of every generation has two parents
 * and the number of people doubles with each generation. The statements of a request have to
 * grow with the number of generations and not with the number of people, so the tests compare
 * depths and derive the bounds from the shape of the tree instead of pinning a count.
 *
 * The people carry numeric xrefs and the families do not, so a number that turns into an
 * integer array key on its way through the preload would fail the typed record factories.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversClass(DataFacade::class)]
#[UsesClass(Configuration::class)]
#[UsesClass(Module::class)]
#[UsesClass(Node::class)]
#[UsesClass(NodeData::class)]
final class DataFacadeQueryCountTest extends TestCase
{
    use RealTreeFixtureTrait;

    /**
     * The number of ancestor generations of the pedigree, which is the most that the chart shows.
     */
    private const int DEPTH = 10;

    /**
     * The most values that one statement of a request may bind. A generation of the pedigree is
     * wider than this, so a lookup that sends a whole generation in one statement is over it.
     */
    private const int PLACEHOLDER_BUDGET = 300;

    /**
     * The module of the chart, which the facade reads its settings and its routes from.
     */
    private Module $module;

    /**
     * Boots webtrees on a real schema and registers the module of the chart.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->bootRealWebtrees();

        DB::table('module')->insert(['module_name' => 'webtrees-fan-chart']);

        $this->module = new Module(self::createStub(ChartService::class), new DataFacade());
        $this->module->setName('webtrees-fan-chart');
    }

    /**
     * Drops the viewer and restores the minimal database of the other tests.
     */
    protected function tearDown(): void
    {
        Auth::logout();
        Session::clear();
        Site::$preferences = [];
        Registry::cache(new CacheFactory());

        $this->restoreMinimalDatabase();

        parent::tearDown();
    }

    /**
     * A request at the full depth sends fewer statements than the pedigree has families, and the
     * statements that the extra generations add stay far below the people that they add.
     */
    #[Test]
    public function statementsGrowWithTheGenerationsAndNotWithThePeople(): void
    {
        $tree = $this->importPedigree();

        $shallow = count($this->statements($tree, 5));
        $deep    = count($this->statements($tree, self::DEPTH));

        $families    = (2 ** (self::DEPTH - 1)) - 1;
        $addedPeople = (2 ** self::DEPTH) - (2 ** 5);

        self::assertLessThan($families, $deep);
        self::assertLessThan(intdiv($addedPeople, 10), $deep - $shallow);
    }

    /**
     * No statement binds as many values as a whole generation holds, so a tree of any width stays
     * below the placeholder ceiling of the database.
     */
    #[Test]
    public function noStatementBindsAWholeGeneration(): void
    {
        $tree = $this->importPedigree();

        $widest = 0;

        foreach ($this->statements($tree, self::DEPTH) as $statement) {
            $widest = max($widest, count($statement['bindings']));
        }

        self::assertGreaterThan(0, $widest);
        self::assertLessThan(self::PLACEHOLDER_BUDGET, $widest);
    }

    /**
     * The families of the people of the last generation are read, because the chart shows the
     * marriage of their parents. The families of the parents of that generation are not, because
     * those people are not in the chart.
     */
    #[Test]
    public function noFamilyBeyondTheLastGenerationIsLoaded(): void
    {
        $tree = $this->importPedigree();

        $bound = [];

        foreach ($this->statements($tree, 3) as $statement) {
            if (str_contains((string) $statement['query'], 'families')) {
                $bound = array_merge($bound, $statement['bindings']);
            }
        }

        // The people 4 to 7 are the third generation, the last one of a chart of three generations.
        foreach (range(1, 7) as $person) {
            self::assertContains($this->familyXref($person), $bound);
        }

        foreach (range(8, 15) as $person) {
            self::assertNotContains($this->familyXref($person), $bound, 'The family of the person ' . $person . ' lies beyond the chart.');
        }
    }

    /**
     * The chart holds every person of the pedigree at the position that the pedigree gives it, for
     * the administrator and for a visitor alike.
     */
    #[Test]
    public function theChartMatchesThePedigreeForAdministratorAndVisitor(): void
    {
        $tree = $this->importPedigree();

        $administrator = $this->payload($tree, self::DEPTH);

        self::assertSame(array_map(strval(...), $this->heapOrder(self::DEPTH)), $this->xrefsInOrder($administrator));

        Registry::cache(new CacheFactory());
        Auth::logout();

        $visitor = $this->payload($tree, self::DEPTH);

        self::assertSame($administrator, $visitor);
    }

    /**
     * A pending change of a family is seen by an editor and by nobody else, as without the preload.
     */
    #[Test]
    public function aPendingFamilyChangeIsSeenByTheEditorOnly(): void
    {
        $tree = $this->importPedigree();

        // The pending record of the family of the person 2 adds a marriage place, which the chart
        // shows with the person 2, the child of that family.
        $family = $this->familyXref(2);

        DB::table('change')->insert([
            'status'     => 'pending',
            'gedcom_id'  => $tree->id(),
            'xref'       => $family,
            'old_gedcom' => '',
            'new_gedcom' => '0 @' . $family . "@ FAM\n1 HUSB @4@\n1 WIFE @5@\n1 CHIL @2@\n1 MARR\n2 PLAC Pendingplace",
            'user_id'    => Auth::id(),
        ]);

        self::assertStringContainsString('Pendingplace', $this->payload($tree, 3));

        Registry::cache(new CacheFactory());
        Auth::logout();

        self::assertStringNotContainsString('Pendingplace', $this->payload($tree, 3));

        // A visitor has no pending changes to see, so the preload does not look for them.
        foreach ($this->statements($tree, 3) as $statement) {
            self::assertStringNotContainsString('"wt_change"', (string) $statement['query']);
        }
    }

    /**
     * A person without a parent family has nothing to preload, so the request sends no lookup of
     * families, of people by a list of xrefs or of pending families, for an administrator, an editor
     * and a visitor alike.
     */
    #[Test]
    public function aPersonWithoutParentsSendsNoPreloadStatement(): void
    {
        $tree = $this->importGedcom(
            "0 HEAD\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n0 @1@ INDI\n1 NAME Alone /Person/\n1 SEX M\n0 TRLR",
            'alone',
        );

        $tree->setPreference('HIDE_LIVE_PEOPLE', '0');

        $editor = (new UserService())->create('editor', 'Editor', 'editor@example.test', 'secret');
        $tree->setUserPreference($editor, UserInterface::PREF_TREE_ROLE, UserInterface::ROLE_EDITOR);

        $viewers = [
            'administrator' => Auth::user(),
            'editor'        => $editor,
            'visitor'       => new GuestUser(),
        ];

        foreach ($viewers as $name => $viewer) {
            Auth::login($viewer);

            $statements = $this->statements($tree, 4);

            self::assertNotSame([], $statements, 'The request of the ' . $name . ' sends statements.');

            foreach ($statements as $statement) {
                $query = $statement['query'];

                self::assertStringNotContainsString('"wt_families"', $query, 'The ' . $name . ' loads no family.');
                self::assertStringNotContainsString('"xref" in', $query, 'The ' . $name . ' looks for no pending family.');
                self::assertStringNotContainsString('"i_id" in', $query, 'The ' . $name . ' loads no people by a list.');
            }
        }
    }

    /**
     * Returns the xref of the family of a person, which is numeric like the xrefs of the people.
     *
     * @param int $person The person whose parents the family holds
     */
    private function familyXref(int $person): string
    {
        return (string) (5000 + $person);
    }

    /**
     * Imports the complete pedigree. The person n has the parents 2n and 2n+1 in the family that
     * familyXref() names.
     */
    private function importPedigree(): Tree
    {
        $people   = (2 ** self::DEPTH) - 1;
        $families = (2 ** (self::DEPTH - 1)) - 1;

        $lines = ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINKED', '1 CHAR UTF-8'];

        for ($person = 1; $person <= $people; ++$person) {
            $lines[] = '0 @' . $person . '@ INDI';
            $lines[] = '1 NAME Given' . $person . ' /Family' . ($person % 7) . '/';
            $lines[] = '1 SEX ' . (($person % 2 === 0) ? 'M' : 'F');
            $lines[] = '1 BIRT';
            $lines[] = '2 DATE ' . (1500 + ($person % 400));
            $lines[] = '2 PLAC Place' . ($person % 11);

            $lines[] = '1 FAMC @' . $this->familyXref($person) . '@';

            if ($person >= 2) {
                $lines[] = '1 FAMS @' . $this->familyXref(intdiv($person, 2)) . '@';
            }
        }

        // Every person has a parent family, as people in real trees do. The family of a person of
        // the last generation has no parents, so the pedigree ends there.
        for ($family = 1; $family <= $people; ++$family) {
            $lines[] = '0 @' . $this->familyXref($family) . '@ FAM';

            if ($family <= $families) {
                $lines[] = '1 HUSB @' . (2 * $family) . '@';
                $lines[] = '1 WIFE @' . ((2 * $family) + 1) . '@';
            }

            $lines[] = '1 CHIL @' . $family . '@';
        }

        $lines[] = '0 TRLR';

        $tree = $this->importGedcom(implode("\n", $lines), 'pedigree');

        $tree->setPreference('HIDE_LIVE_PEOPLE', '0');
        $tree->setPreference('SHOW_LIVING_NAMES', (string) Auth::PRIV_PRIVATE);

        return $tree;
    }

    /**
     * Returns the statements of one request on a cold record cache.
     *
     * @param Tree $tree        The imported tree
     * @param int  $generations The number of generations of the chart
     *
     * @return list<array{query: string, bindings: list<string>}>
     */
    private function statements(Tree $tree, int $generations): array
    {
        Registry::cache(new CacheFactory());

        $connection = DB::connection();
        $connection->enableQueryLog();
        $connection->flushQueryLog();

        $this->nodeTree($tree, $generations);

        $log = $connection->getQueryLog();
        $connection->disableQueryLog();

        $statements = [];

        foreach ($log as $entry) {
            $bindings = [];

            foreach ($entry['bindings'] as $binding) {
                $bindings[] = is_scalar($binding) ? (string) $binding : '';
            }

            $statements[] = [
                'query'    => $entry['query'],
                'bindings' => $bindings,
            ];
        }

        return $statements;
    }

    /**
     * Returns the JSON payload of the chart as the current viewer, on a cold record cache.
     *
     * @param Tree $tree        The imported tree
     * @param int  $generations The number of generations of the chart
     */
    private function payload(Tree $tree, int $generations): string
    {
        Registry::cache(new CacheFactory());

        return json_encode($this->nodeTree($tree, $generations), JSON_THROW_ON_ERROR);
    }

    /**
     * Builds the node tree of the person 1 with the detail panel facts on.
     *
     * @param Tree $tree        The imported tree
     * @param int  $generations The number of generations of the chart
     */
    private function nodeTree(Tree $tree, int $generations): Node
    {
        $individual = Registry::individualFactory()->make('1', $tree);
        self::assertInstanceOf(Individual::class, $individual);

        $request = (new ServerRequest('GET', '/'))->withQueryParams([
            'generations'     => (string) $generations,
            'showDetailPanel' => '1',
            'showPlaces'      => '1',
        ]);

        $node = (new DataFacade())->createTreeStructure(
            $this->module,
            new Configuration($request, $this->module),
            $individual,
        );

        self::assertInstanceOf(Node::class, $node);

        return $node;
    }

    /**
     * Lists the xrefs of the people of the pedigree as the chart orders them, which is depth first,
     * the father before the mother.
     *
     * @param int $generations The number of generations
     *
     * @return list<int>
     */
    private function heapOrder(int $generations, int $person = 1, int $generation = 1): array
    {
        if ($generation > $generations) {
            return [];
        }

        return [
            $person,
            ...$this->heapOrder($generations, 2 * $person, $generation + 1),
            ...$this->heapOrder($generations, (2 * $person) + 1, $generation + 1),
        ];
    }

    /**
     * Lists the xrefs of a payload depth first.
     *
     * @param string $payload The JSON payload
     *
     * @return list<string>
     */
    private function xrefsInOrder(string $payload): array
    {
        $tree = json_decode($payload, true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($tree);

        return $this->collectXrefs($tree);
    }

    /**
     * @param array<array-key, mixed> $node A node of the decoded payload
     *
     * @return list<string>
     */
    private function collectXrefs(array $node): array
    {
        $data = $node['data'] ?? null;
        self::assertIsArray($data);
        self::assertArrayHasKey('xref', $data);
        self::assertIsString($data['xref']);

        $xrefs = [$data['xref']];

        $parents = $node['parents'] ?? [];
        self::assertIsArray($parents);

        foreach ($parents as $parent) {
            self::assertIsArray($parent);
            $xrefs = [...$xrefs, ...$this->collectXrefs($parent)];
        }

        return $xrefs;
    }
}
