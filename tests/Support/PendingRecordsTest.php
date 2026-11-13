<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Factories\CacheFactory;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\UserService;
use Fisharebest\Webtrees\Session;
use Fisharebest\Webtrees\Site;
use Fisharebest\Webtrees\Tree;
use MagicSunday\Webtrees\FanChart\Support\PendingRecords;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function array_filter;
use function sort;
use function str_contains;

/**
 * Looks up the pending changes of records on a real schema. An editor sees pending changes, so only an
 * editor needs the lookup, and the lookup has to reach every xref of a list that is bound in chunks.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversClass(PendingRecords::class)]
final class PendingRecordsTest extends TestCase
{
    use RealTreeFixtureTrait;

    /**
     * Boots webtrees on a real schema and imports a tree with numeric xrefs.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->bootRealWebtrees();
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
     * An editor gets the xrefs of the records with a pending change from every chunk of the list, as
     * strings, and not the records whose change is no longer pending.
     */
    #[Test]
    public function anEditorGetsThePendingXrefsOfEveryChunk(): void
    {
        $tree = $this->importGedcom("0 HEAD\n0 TRLR", 'pending');

        $this->insertChange($tree, '101', 'pending');
        $this->insertChange($tree, '103', 'pending');
        $this->insertChange($tree, '105', 'pending');
        $this->insertChange($tree, '104', 'accepted');

        $xrefs = PendingRecords::xrefs($tree, ['101', '102', '103', '104', '105'], 2);

        sort($xrefs);

        self::assertSame(['101', '103', '105'], $xrefs);
    }

    /**
     * Only the changes of the given tree and of the given xrefs count.
     */
    #[Test]
    public function onlyTheGivenXrefsOfTheGivenTreeCount(): void
    {
        $tree  = $this->importGedcom("0 HEAD\n0 TRLR", 'pending');
        $other = $this->importGedcom("0 HEAD\n0 TRLR", 'other');

        $this->insertChange($tree, '101', 'pending');
        $this->insertChange($tree, '999', 'pending');
        $this->insertChange($other, '102', 'pending');

        self::assertSame(['101'], PendingRecords::xrefs($tree, ['101', '102'], 10));
    }

    /**
     * A visitor sees no pending change, so the lookup sends no statement for a visitor.
     */
    #[Test]
    public function aVisitorGetsNothingWithoutAStatement(): void
    {
        $tree = $this->importGedcom("0 HEAD\n0 TRLR", 'pending');

        $this->insertChange($tree, '101', 'pending');

        Auth::logout();

        $connection = DB::connection();
        $connection->enableQueryLog();
        $connection->flushQueryLog();

        $xrefs = PendingRecords::xrefs($tree, ['101'], 10);

        $changeStatements = array_filter(
            $connection->getQueryLog(),
            static fn (array $entry): bool => str_contains($entry['query'], '"wt_change"'),
        );
        $connection->disableQueryLog();

        self::assertSame([], $xrefs);
        self::assertSame([], $changeStatements);
    }

    /**
     * A member who is no editor sees no pending change either.
     */
    #[Test]
    public function aMemberWhoIsNoEditorGetsNothing(): void
    {
        $tree = $this->importGedcom("0 HEAD\n0 TRLR", 'pending');

        $this->insertChange($tree, '101', 'pending');

        $member = (new UserService())->create('member', 'Member', 'member@example.test', 'secret');
        $tree->setUserPreference($member, UserInterface::PREF_TREE_ROLE, UserInterface::ROLE_MEMBER);
        Auth::login($member);

        self::assertSame([], PendingRecords::xrefs($tree, ['101'], 10));
    }

    /**
     * Records a change of a record of the tree.
     *
     * @param Tree   $tree   The tree of the record
     * @param string $xref   The xref of the record
     * @param string $status The status of the change
     */
    private function insertChange(Tree $tree, string $xref, string $status): void
    {
        DB::table('change')->insert([
            'status'     => $status,
            'gedcom_id'  => $tree->id(),
            'xref'       => $xref,
            'old_gedcom' => '',
            'new_gedcom' => '0 @' . $xref . '@ OBJE',
            'user_id'    => 1,
        ]);
    }
}
