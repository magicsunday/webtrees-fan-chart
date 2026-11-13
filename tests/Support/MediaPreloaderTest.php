<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Closure;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Factories\CacheFactory;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\GedcomImportService;
use Fisharebest\Webtrees\Services\TreeService;
use Fisharebest\Webtrees\Services\UserService;
use Fisharebest\Webtrees\Session;
use Fisharebest\Webtrees\Site;
use Fisharebest\Webtrees\Tree;
use MagicSunday\Webtrees\FanChart\Support\MediaPreloader;
use MagicSunday\Webtrees\FanChart\Support\PendingRecords;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;

use function array_filter;
use function array_map;
use function array_values;
use function count;
use function file_put_contents;
use function glob;
use function implode;
use function intdiv;
use function is_dir;
use function is_scalar;
use function mkdir;
use function range;
use function rmdir;
use function str_contains;
use function strval;
use function sys_get_temp_dir;
use function uniqid;
use function unlink;

/**
 * Drives the media preload against the real record factories and the real privacy engine of webtrees
 * on a real imported tree. A preload is right when the highlight image of every person is the one that
 * the record factories give without it, and when the lookups that it replaces are gone from the walk.
 * The tests therefore compare the result with the result of the same lookups on a cold cache, and
 * they count the statements of the lookups after the preload.
 *
 * Every xref of the fixtures is numeric, like the xrefs of many imported trees, so a number that
 * turns into an integer array key on its way through the preload fails the typed record factories.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversClass(MediaPreloader::class)]
#[UsesClass(PendingRecords::class)]
final class MediaPreloaderTest extends TestCase
{
    use RealTreeFixtureTrait;

    /**
     * The index directory that holds the media files, or an empty string while the test has none.
     */
    private string $indexDirectory = '';

    /**
     * Boots webtrees on a real schema.
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

        $this->removeIndexDirectory();
        $this->restoreMinimalDatabase();

        parent::tearDown();
    }

    /**
     * The media objects of a generation come in chunked statements, whatever the width of the generation,
     * and the lookups of the walk afterwards send no statement. The administrator has no privacy check, so
     * the media objects are all that the walk looks up.
     */
    #[Test]
    public function theMediaOfAGenerationIsLoadedInChunkedStatements(): void
    {
        $people = (2 * MediaPreloader::CHUNK_SIZE) + 20;
        $lines  = ['0 HEAD'];

        foreach (range(1, $people) as $person) {
            $lines[] = '0 @' . $person . '@ INDI';
            $lines[] = '1 NAME Given' . $person . ' /Family/';
            $lines[] = '1 OBJE @' . (7000 + $person) . '@';
        }

        foreach (range(1, $people) as $person) {
            $lines[] = '0 @' . (7000 + $person) . '@ OBJE';
            $lines[] = '1 FILE image' . $person . '.jpg';
            $lines[] = '2 FORM jpg';
        }

        $lines[] = '0 TRLR';

        $tree = $this->importGedcom(implode("\n", $lines), 'wide');

        $xrefs = array_map(strval(...), range(1, $people));

        Registry::cache(new CacheFactory());

        $individuals = $this->people($tree, $xrefs);
        $loaded      = $this->statementsOf(fn () => (new MediaPreloader())->preload($tree, $individuals));

        $mediaStatements = array_filter($loaded, static fn (array $statement): bool => str_contains($statement['query'], 'from "wt_media"'));

        self::assertCount(intdiv($people + MediaPreloader::CHUNK_SIZE - 1, MediaPreloader::CHUNK_SIZE), $mediaStatements);

        foreach ($mediaStatements as $statement) {
            // The tree is bound next to the xrefs of the chunk.
            self::assertLessThanOrEqual(MediaPreloader::CHUNK_SIZE + 1, count($statement['bindings']));
        }

        $files = [];

        $walk = $this->statementsOf(function () use ($tree, $xrefs, &$files): void {
            $files = $this->highlightFiles($tree, $xrefs);
        });

        self::assertSame([], $walk, 'The walk looks nothing up.');
        self::assertSame(
            array_map(static fn (int $person): string => 'image' . $person . '.jpg', range(1, $people)),
            $files
        );
    }

    /**
     * A visitor sees the media object of a public person when nothing private is linked to it, and no media
     * object that a record he may not see is linked to, as the record factories decide without the preload.
     * The preload must not reveal a media object that these decisions hide, whichever way it is linked, and
     * it replaces the link check of every media object that it can decide.
     */
    #[Test]
    public function aVisitorSeesNoMediaThatIsLinkedToARecordHeMayNotSee(): void
    {
        $tree  = $this->importPrivacyTree();
        $xrefs = array_map(strval(...), range(1, 9));

        Auth::logout();

        $withoutPreload = $this->highlightFiles($tree, $xrefs);

        // The person 1 has a media object of their own, and the person 9 has one that a public family
        // shares. Everything else is hidden from a visitor. The living person 7 and the private person 3
        // have no file visible for a visitor at all.
        self::assertSame(
            ['one.jpg', null, null, null, null, null, null, null, 'nine.jpg'],
            $withoutPreload,
            'The record factories hide every media object that a private record is linked to.'
        );

        Registry::cache(new CacheFactory());

        $people  = $this->people($tree, $xrefs);
        $preload = $this->statementsOf(fn () => (new MediaPreloader())->preload($tree, $people));

        // The people that the links point to are loaded by lists, and the preload asks for none of them
        // on its own.
        $singleLookups = array_filter(
            $preload,
            static fn (array $statement): bool => str_contains($statement['query'], 'from "wt_families" where "f_id" = ?')
                || str_contains($statement['query'], 'from "wt_individuals" where "i_id" = ?'),
        );

        self::assertSame([], $singleLookups);

        $links = [];

        $statements = $this->statementsOf(function () use ($tree, $xrefs, &$links): void {
            $links = $this->highlightFiles($tree, $xrefs);
        });

        self::assertSame($withoutPreload, $links);

        // The links of a media object are looked up by the preload and not by the walk. The media object
        // with a restriction notice of its own is decided by that notice before the core reads its links.
        $linkStatements = array_filter($statements, static fn (array $statement): bool => str_contains($statement['query'], 'from "wt_link"'));

        self::assertSame([], $linkStatements);

        // The records that the links point to are in the cache, so the walk does not look for them one by one.
        $recordStatements = array_filter(
            $statements,
            static fn (array $statement): bool => str_contains($statement['query'], 'from "wt_families"')
                || str_contains($statement['query'], 'from "wt_individuals"')
                || str_contains($statement['query'], '"i_gedcom" from'),
        );

        self::assertSame([], $recordStatements);
    }

    /**
     * A media object that the tree restricts by a rule of its own, and every media object of a tree that
     * restricts its media objects as a type of record, is hidden from a visitor, although nothing private
     * is linked to it. The preload leaves both decisions to the record factories, so the result is theirs.
     *
     * @param string|null $xref    The xref of the restricted record, or null for a type of record
     * @param string|null $tagType The restricted type of record, or null for a single record
     */
    #[Test]
    #[DataProvider('mediaRules')]
    public function aVisitorSeesNoMediaThatTheTreeRestricts(?string $xref, ?string $tagType): void
    {
        $tree  = $this->importPrivacyTreeWithRules([['xref' => $xref, 'tag_type' => $tagType, 'resn' => 'confidential']]);
        $xrefs = ['1', '9'];

        $tree->setPreference('SHOW_HIGHLIGHT_IMAGES', '1');

        Auth::logout();

        (new MediaPreloader())->preload($tree, $this->people($tree, $xrefs));

        // The rule of a single record hides the media object of the person 1 only, the rule of the type
        // hides both.
        self::assertSame(
            [null, ($xref === null) ? null : 'nine.jpg'],
            $this->highlightFiles($tree, $xrefs)
        );
    }

    /**
     * A rule of the tree that shows the media objects to visitors keeps them visible, although it names the
     * level of a visitor exactly.
     */
    #[Test]
    public function aVisitorSeesMediaThatTheTreeShowsToVisitors(): void
    {
        $tree = $this->importPrivacyTreeWithRules([['xref' => null, 'tag_type' => 'OBJE', 'resn' => 'none']]);

        Auth::logout();

        (new MediaPreloader())->preload($tree, $this->people($tree, ['1']));

        self::assertSame(['one.jpg'], $this->highlightFiles($tree, ['1']));
    }

    /**
     * The columns of the link table and of the media table compare case-insensitively on MySQL, so a link
     * whose spelling differs from the xref of the media object still belongs to it, and a media object that
     * a private record is linked to stays hidden from a visitor. The link table of the test compares the
     * target case-insensitively as well.
     */
    #[Test]
    public function aLinkWithAnotherSpellingStillHidesTheMediaObject(): void
    {
        DB::connection()->statement('DROP TABLE "wt_link"');
        DB::connection()->statement(
            'CREATE TABLE "wt_link" ("l_file" integer not null, "l_from" varchar(20) not null, '
            . '"l_type" varchar(15) not null, "l_to" varchar(20) collate nocase not null, '
            . 'primary key ("l_from", "l_file", "l_type", "l_to"))'
        );

        $this->createIndexDirectory(['one']);

        $tree = $this->importGedcom(
            implode("\n", [
                '0 HEAD',
                '0 @1@ INDI',
                '1 NAME Public /Person/',
                '1 DEAT',
                '2 DATE 1900',
                '1 OBJE @M1@',
                '0 @2@ INDI',
                '1 NAME Private /Person/',
                '1 RESN confidential',
                '1 DEAT',
                '2 DATE 1900',
                '1 OBJE @m1@',
                '0 @M1@ OBJE',
                '1 FILE one.jpg',
                '2 FORM jpg',
                '0 TRLR',
            ]),
            'spelling',
        );

        $tree->setPreference('HIDE_LIVE_PEOPLE', '1');
        $tree->setPreference('SHOW_DEAD_PEOPLE', (string) Auth::PRIV_PRIVATE);
        $tree->setPreference('SHOW_HIGHLIGHT_IMAGES', '1');

        $asAdministrator = $this->highlightFiles($tree, ['1']);

        self::assertSame(['one.jpg'], $asAdministrator);

        Auth::logout();
        Registry::cache(new CacheFactory());

        $withoutPreload = $this->highlightFiles($tree, ['1']);

        self::assertSame([null], $withoutPreload);

        Registry::cache(new CacheFactory());

        (new MediaPreloader())->preload($tree, $this->people($tree, ['1']));

        self::assertSame($withoutPreload, $this->highlightFiles($tree, ['1']));
    }

    /**
     * A tree that does not hide living people shows its media objects, whatever restriction the tree has
     * for the type of record, because the core does not look at that restriction then. The preload steps
     * aside as well.
     */
    #[Test]
    public function aTreeWithoutPrivacyShowsMediaWhateverTheTypeRestriction(): void
    {
        $tree = $this->importPrivacyTreeWithRules([['xref' => null, 'tag_type' => 'OBJE', 'resn' => 'confidential']]);

        $tree->setPreference('HIDE_LIVE_PEOPLE', '0');

        Auth::logout();
        Registry::cache(new CacheFactory());

        $withoutPreload = $this->highlightFiles($tree, ['1']);

        self::assertSame(['one.jpg'], $withoutPreload);

        Registry::cache(new CacheFactory());

        (new MediaPreloader())->preload($tree, $this->people($tree, ['1']));

        self::assertSame($withoutPreload, $this->highlightFiles($tree, ['1']));
    }

    /**
     * A person without a date and without a media object has nothing to look up. Whether the viewer may see
     * such a person depends on the families of its parents, so asking before the media objects are looked
     * for would read those families, ahead of the preload of the families and for nothing.
     */
    #[Test]
    public function aPersonWithoutMediaIsNotCheckedForVisibility(): void
    {
        $tree = $this->importGedcom(
            implode("\n", [
                '0 HEAD',
                '0 @1@ INDI',
                '1 NAME First /Person/',
                '1 FAMC @9@',
                '0 @2@ INDI',
                '1 NAME Father /Person/',
                '1 FAMS @9@',
                '0 @3@ INDI',
                '1 NAME Mother /Person/',
                '1 FAMS @9@',
                '0 @9@ FAM',
                '1 HUSB @2@',
                '1 WIFE @3@',
                '1 CHIL @1@',
                '0 TRLR',
            ]),
            'nodates',
        );

        $tree->setPreference('HIDE_LIVE_PEOPLE', '1');
        $tree->setPreference('SHOW_HIGHLIGHT_IMAGES', '1');

        Auth::logout();
        Registry::cache(new CacheFactory());

        $people     = $this->people($tree, ['1']);
        $statements = $this->statementsOf(fn () => (new MediaPreloader())->preload($tree, $people));

        self::assertSame([], $statements);
    }

    /**
     * A member who is no editor is decided at the level of a member, which sees a record that only
     * members may see, while a visitor does not. The media object that such a record is linked to is
     * visible to the member and hidden from the visitor, and one that a manager-only record is linked to
     * is hidden from both.
     */
    #[Test]
    public function aMemberSeesWhatMembersMaySee(): void
    {
        $this->createIndexDirectory(['one', 'two', 'three']);

        $person = static fn (int $number, string $restriction, string $media): array => [
            '0 @' . $number . '@ INDI',
            '1 NAME Given' . $number . ' /Family/',
            ...(($restriction === '') ? [] : ['1 RESN ' . $restriction]),
            '1 DEAT',
            '2 DATE 1900',
            '1 OBJE @' . $media . '@',
        ];

        $tree = $this->importGedcom(
            implode("\n", [
                '0 HEAD',
                ...$person(1, '', '8101'),
                ...$person(4, '', '8102'),
                ...$person(5, 'privacy', '8102'),
                ...$person(6, '', '8103'),
                ...$person(7, 'confidential', '8103'),
                '0 @8101@ OBJE',
                '1 FILE one.jpg',
                '2 FORM jpg',
                '0 @8102@ OBJE',
                '1 FILE two.jpg',
                '2 FORM jpg',
                '0 @8103@ OBJE',
                '1 FILE three.jpg',
                '2 FORM jpg',
                '0 TRLR',
            ]),
            'members',
        );

        $tree->setPreference('HIDE_LIVE_PEOPLE', '1');
        $tree->setPreference('SHOW_DEAD_PEOPLE', (string) Auth::PRIV_PRIVATE);
        $tree->setPreference('SHOW_HIGHLIGHT_IMAGES', '1');

        $xrefs = ['1', '4', '6'];

        $member = (new UserService())->create('member', 'Member', 'member@example.test', 'secret');
        $tree->setUserPreference($member, UserInterface::PREF_TREE_ROLE, UserInterface::ROLE_MEMBER);
        Auth::login($member);
        Registry::cache(new CacheFactory());

        $withoutPreload = $this->highlightFiles($tree, $xrefs);

        self::assertSame(['one.jpg', 'two.jpg', null], $withoutPreload);

        Registry::cache(new CacheFactory());

        (new MediaPreloader())->preload($tree, $this->people($tree, $xrefs));

        self::assertSame($withoutPreload, $this->highlightFiles($tree, $xrefs));

        // The visitor sees less than the member.
        Auth::logout();
        Registry::cache(new CacheFactory());

        (new MediaPreloader())->preload($tree, $this->people($tree, $xrefs));

        self::assertSame(['one.jpg', null, null], $this->highlightFiles($tree, $xrefs));
    }

    /**
     * The rules of the tree that hide a media object from a visitor.
     *
     * @return array<string, array{string|null, string|null}>
     */
    public static function mediaRules(): array
    {
        return [
            'a rule for one media object' => ['8001', null],
            'a rule for the type'         => [null, 'OBJE'],
        ];
    }

    /**
     * The record of a member is visible to the member whatever it is linked to, and the core decides that
     * before it looks at the links. The preload leaves such a media object to the core.
     */
    #[Test]
    public function theMediaObjectOfTheMemberIsLeftToTheCore(): void
    {
        $tree = $this->importPrivacyTree();

        $member = (new UserService())->create('member', 'Member', 'member@example.test', 'secret');
        $tree->setUserPreference($member, UserInterface::PREF_TREE_ROLE, UserInterface::ROLE_MEMBER);
        $tree->setUserPreference($member, UserInterface::PREF_TREE_ACCOUNT_XREF, '8002');
        Auth::login($member);

        // The media object 8002 is linked to a person that a member may not see, and it is the record
        // of the member, so the core shows it.
        $withoutPreload = $this->highlightFiles($tree, ['2']);

        self::assertSame(['two.jpg'], $withoutPreload);

        Registry::cache(new CacheFactory());

        (new MediaPreloader())->preload($tree, $this->people($tree, ['2']));

        self::assertSame($withoutPreload, $this->highlightFiles($tree, ['2']));
    }

    /**
     * An editor sees the pending changes of the records that a media object is linked to, which the preload
     * does not load for them, so the visibility for an editor stays with the core. Here a pending change
     * restricts the family that the media object of the person 9 is linked to.
     */
    #[Test]
    public function theVisibilityForAnEditorStaysWithTheCore(): void
    {
        $tree = $this->importPrivacyTree();

        $gedcom = DB::table('families')->where('f_id', '=', '9002')->where('f_file', '=', $tree->id())->value('f_gedcom');
        self::assertIsString($gedcom);

        DB::table('change')->insert([
            'status'     => 'pending',
            'gedcom_id'  => $tree->id(),
            'xref'       => '9002',
            'old_gedcom' => $gedcom,
            'new_gedcom' => $gedcom . "\n1 RESN confidential",
            'user_id'    => Auth::id(),
        ]);

        $editor = (new UserService())->create('editor', 'Editor', 'editor@example.test', 'secret');
        $tree->setUserPreference($editor, UserInterface::PREF_TREE_ROLE, UserInterface::ROLE_EDITOR);
        Auth::login($editor);

        Registry::cache(new CacheFactory());

        $withoutPreload = $this->highlightFiles($tree, ['9']);

        self::assertSame([null], $withoutPreload);

        Registry::cache(new CacheFactory());

        (new MediaPreloader())->preload($tree, $this->people($tree, ['9']));

        self::assertSame($withoutPreload, $this->highlightFiles($tree, ['9']));
    }

    /**
     * The administrator control of the visitor test. The administrator sees every media object, so the
     * hidden ones of the visitor are a result of the gate and not of the fixture.
     */
    #[Test]
    public function anAdministratorSeesEveryMediaObject(): void
    {
        $tree  = $this->importPrivacyTree();
        $xrefs = array_map(strval(...), range(1, 9));

        (new MediaPreloader())->preload($tree, $this->people($tree, $xrefs));

        self::assertSame(
            ['one.jpg', 'two.jpg', 'two.jpg', 'three.jpg', null, 'six.jpg', 'seven.jpg', 'seven.jpg', 'nine.jpg'],
            $this->highlightFiles($tree, $xrefs)
        );
    }

    /**
     * A person that the viewer may not see has no image, so the media of that person is not looked up.
     */
    #[Test]
    public function theMediaOfAPrivatePersonIsNotLoaded(): void
    {
        $tree = $this->importPrivacyTree();

        Auth::logout();

        // The person 3 is private and the person 1 is public.
        $people     = $this->people($tree, ['3']);
        $statements = $this->statementsOf(fn () => (new MediaPreloader())->preload($tree, $people));

        self::assertSame([], $statements);

        $people     = $this->people($tree, ['1']);
        $statements = $this->statementsOf(fn () => (new MediaPreloader())->preload($tree, $people));

        self::assertNotSame([], $statements);
    }

    /**
     * An editor sees the pending change of a media object, and nobody else does, as without the preload.
     */
    #[Test]
    public function aPendingChangeOfAMediaObjectIsSeenByTheEditorOnly(): void
    {
        $tree = $this->importPrivacyTree();

        DB::table('change')->insert([
            'status'     => 'pending',
            'gedcom_id'  => $tree->id(),
            'xref'       => '8010',
            'old_gedcom' => '',
            'new_gedcom' => "0 @8010@ OBJE\n1 FILE pending.jpg\n2 FORM jpg",
            'user_id'    => Auth::id(),
        ]);

        // The record factories keep the pending changes of the tree in the cache of the request.
        Registry::cache(new CacheFactory());

        (new MediaPreloader())->preload($tree, $this->people($tree, ['5']));

        self::assertSame(['pending.jpg'], $this->highlightFiles($tree, ['5']));

        Registry::cache(new CacheFactory());
        Auth::logout();

        (new MediaPreloader())->preload($tree, $this->people($tree, ['5']));

        self::assertSame([null], $this->highlightFiles($tree, ['5']));
    }

    /**
     * A tree without highlight images has no lookup of media objects.
     */
    #[Test]
    public function aTreeWithoutHighlightImagesLoadsNothing(): void
    {
        $tree = $this->importPrivacyTree();

        $tree->setPreference('SHOW_HIGHLIGHT_IMAGES', '');

        $people     = $this->people($tree, ['1', '2', '9']);
        $statements = $this->statementsOf(fn () => (new MediaPreloader())->preload($tree, $people));

        self::assertSame([], $statements);
    }

    /**
     * A media object that several people share is loaded once, also when the people come in different
     * generations.
     */
    #[Test]
    public function aMediaObjectIsLoadedOnce(): void
    {
        $tree = $this->importPrivacyTree();

        $preloader = new MediaPreloader();
        $people    = $this->people($tree, ['1', '9']);

        $first = $this->statementsOf(fn () => $preloader->preload($tree, $people));

        self::assertNotSame([], $first);

        $again = $this->statementsOf(fn () => $preloader->preload($tree, $people));

        self::assertSame([], $again);
    }

    /**
     * A person without a media object has nothing to look up, for every viewer.
     *
     * @param bool $visitor Whether a visitor looks at the chart
     */
    #[Test]
    #[DataProvider('viewers')]
    public function aPersonWithoutMediaSendsNoStatement(bool $visitor): void
    {
        $tree = $this->importGedcom(
            "0 HEAD\n0 @1@ INDI\n1 NAME Alone /Person/\n1 DEAT\n2 DATE 1900\n0 TRLR",
            'alone',
        );

        $tree->setPreference('HIDE_LIVE_PEOPLE', '1');
        $tree->setPreference('SHOW_DEAD_PEOPLE', (string) Auth::PRIV_PRIVATE);

        if ($visitor) {
            Auth::logout();
        }

        $people     = $this->people($tree, ['1']);
        $statements = $this->statementsOf(fn () => (new MediaPreloader())->preload($tree, $people));

        self::assertSame([], $statements);
    }

    /**
     * Lists the viewers.
     *
     * @return array<string, array{bool}>
     */
    public static function viewers(): array
    {
        return [
            'administrator' => [false],
            'visitor'       => [true],
        ];
    }

    /**
     * Imports a small tree of public people, private people and media objects that are linked to them. All
     * xrefs are numeric. The tree hides living people.
     *
     * The people:
     * 1 has a media object of its own.
     * 2 shares a media object with the person 3, who has a confidential restriction.
     * 4 has a media object with a confidential restriction.
     * 5 has a media object that does not exist and one that has no file.
     * 6 shares a media object with a family that has a confidential restriction.
     * 7 is living and shares a media object with the person 8.
     * 9 shares a media object with a public family.
     */
    private function importPrivacyTree(): Tree
    {
        return $this->importPrivacyTreeWithRules([]);
    }

    /**
     * Imports the tree of importPrivacyTree() with default restriction rules of the tree.
     *
     * @param list<array{xref: string|null, tag_type: string|null, resn: string}> $rules The rules, each for a
     *                                                                                   record or for a type of record
     */
    private function importPrivacyTreeWithRules(array $rules): Tree
    {
        $this->createIndexDirectory(['one', 'two', 'three', 'four', 'six', 'seven', 'nine']);

        $dead = static fn (int $person): array => [
            '1 BIRT',
            '2 DATE 18' . (10 + $person),
            '1 DEAT',
            '2 DATE 19' . (10 + $person),
        ];

        $lines = ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8'];

        $people = [
            1 => ['@8001@'],
            2 => ['@8002@'],
            3 => ['@8002@', '@8004@'],
            4 => ['@8003@'],
            5 => ['@8005@', '@8010@'],
            6 => ['@8006@'],
            8 => ['@8007@'],
            9 => ['@8009@'],
        ];

        foreach ($people as $person => $media) {
            $lines[] = '0 @' . $person . '@ INDI';
            $lines[] = '1 NAME Given' . $person . ' /Family/';
            $lines[] = '1 SEX M';

            if ($person === 3) {
                $lines[] = '1 RESN confidential';
            }

            $lines = [...$lines, ...$dead($person)];

            foreach ($media as $xref) {
                $lines[] = '1 OBJE ' . $xref;
            }
        }

        // The living person has no death, so a visitor may not see the person.
        $lines = [
            ...$lines,
            '0 @7@ INDI',
            '1 NAME Given7 /Family/',
            '1 SEX M',
            '1 BIRT',
            '2 DATE 1990',
            '1 OBJE @8007@',
        ];

        $lines = [
            ...$lines,
            '0 @9001@ FAM',
            '1 HUSB @6@',
            '1 RESN confidential',
            '1 OBJE @8006@',
            '0 @9002@ FAM',
            '1 HUSB @9@',
            '1 WIFE @1@',
            '1 OBJE @8009@',
        ];

        $media = [
            '8001' => ['one', ''],
            '8002' => ['two', ''],
            '8003' => ['three', '1 RESN confidential'],
            '8004' => ['four', ''],
            '8006' => ['six', ''],
            '8007' => ['seven', ''],
            '8009' => ['nine', ''],
        ];

        foreach ($media as $xref => [$name, $restriction]) {
            $lines[] = '0 @' . $xref . '@ OBJE';

            if ($restriction !== '') {
                $lines[] = $restriction;
            }

            $lines[] = '1 FILE ' . $name . '.jpg';
            $lines[] = '2 FORM jpg';
        }

        // The media object without a file gets its file by a pending change in the test of the editor.
        $lines[] = '0 @8010@ OBJE';

        $lines[] = '0 TRLR';

        $tree = $this->importGedcom(implode("\n", $lines), 'privacy');

        foreach ($rules as $rule) {
            DB::table('default_resn')->insert([
                'gedcom_id' => $tree->id(),
                'xref'      => $rule['xref'],
                'tag_type'  => $rule['tag_type'],
                'resn'      => $rule['resn'],
            ]);
        }

        // The tree keeps its default restrictions once it has read them, so the tree that the viewer reads
        // is a new one.
        Registry::cache(new CacheFactory());

        $tree = (new TreeService(new GedcomImportService()))->find($tree->id());

        $tree->setPreference('HIDE_LIVE_PEOPLE', '1');
        $tree->setPreference('SHOW_DEAD_PEOPLE', (string) Auth::PRIV_PRIVATE);
        $tree->setPreference('SHOW_LIVING_NAMES', (string) Auth::PRIV_USER);
        $tree->setPreference('SHOW_HIGHLIGHT_IMAGES', '1');

        return $tree;
    }

    /**
     * Creates the index directory with the media files of the given names, so that the files of the images
     * exist.
     *
     * @param list<string> $names The names of the files without the extension
     */
    private function createIndexDirectory(array $names): void
    {
        $this->indexDirectory = sys_get_temp_dir() . '/fan-chart-media-' . uniqid('', true) . '/';

        if (!mkdir($this->indexDirectory . 'media', 0o777, true) && !is_dir($this->indexDirectory . 'media')) {
            self::fail('The media directory could not be created.');
        }

        foreach ($names as $name) {
            file_put_contents($this->indexDirectory . 'media/' . $name . '.jpg', 'image');
        }

        Site::setPreference('INDEX_DIRECTORY', $this->indexDirectory);
    }

    /**
     * Removes the index directory of the test with the files in it.
     */
    private function removeIndexDirectory(): void
    {
        if ($this->indexDirectory === '') {
            return;
        }

        $files = glob($this->indexDirectory . 'media/*');

        foreach (($files === false) ? [] : $files as $file) {
            unlink($file);
        }

        rmdir($this->indexDirectory . 'media');
        rmdir($this->indexDirectory);

        $this->indexDirectory = '';
    }

    /**
     * Returns the people with the given xrefs.
     *
     * @param Tree         $tree  The tree of the people
     * @param list<string> $xrefs The xrefs of the people
     *
     * @return list<Individual>
     */
    private function people(Tree $tree, array $xrefs): array
    {
        $people = [];

        foreach ($xrefs as $xref) {
            $person = Registry::individualFactory()->make($xref, $tree);
            self::assertInstanceOf(Individual::class, $person);

            $people[] = $person;
        }

        return $people;
    }

    /**
     * Returns the file name of the highlight image of every given person, as the record factories give it,
     * or null for a person without one. A media object that the viewer may not see yields none.
     *
     * @param Tree         $tree  The tree of the people
     * @param list<string> $xrefs The xrefs of the people
     *
     * @return list<string|null>
     */
    private function highlightFiles(Tree $tree, array $xrefs): array
    {
        return array_values(array_map(
            static fn (Individual $person): ?string => $person->findHighlightedMediaFile()?->filename(),
            $this->people($tree, $xrefs),
        ));
    }

    /**
     * Returns the statements that an action sends.
     *
     * @param Closure(): void $action The action to run
     *
     * @return list<array{query: string, bindings: list<string>}>
     */
    private function statementsOf(Closure $action): array
    {
        $connection = DB::connection();
        $connection->enableQueryLog();
        $connection->flushQueryLog();

        $action();

        $log = $connection->getQueryLog();
        $connection->disableQueryLog();

        $statements = [];

        foreach ($log as $entry) {
            // The settings of the tree and of the user are read once per request by the framework, they
            // are no lookup of a record.
            if (str_contains($entry['query'], '_setting"')) {
                continue;
            }

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
}
