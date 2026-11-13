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
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Factories\CacheFactory;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\ChartService;
use Fisharebest\Webtrees\Session;
use Fisharebest\Webtrees\Site;
use Fisharebest\Webtrees\Tree;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\FanChart\Test\Support\PayloadToken;
use MagicSunday\Webtrees\FanChart\Test\Support\RealTreeFixtureTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;
use RuntimeException;

use function file_get_contents;
use function file_put_contents;
use function is_dir;
use function json_encode;
use function mkdir;
use function rmdir;
use function sys_get_temp_dir;
use function uniqid;
use function unlink;

use const JSON_THROW_ON_ERROR;

/**
 * Drives the real webtrees privacy engine through the data path of the chart. The tree is a real
 * imported GEDCOM in a real schema, and the node tree comes from the facade the chart uses, so
 * nothing about the visibility of a person is stubbed.
 *
 * The tree holds a deceased public line, a deceased person with a confidential restriction, and
 * a living person with a place, a marriage and a highlighted image. The people of the second
 * kind are the private ones. A visitor may not see any of them, while the importing
 * administrator sees all of them. The test reads the administrator result first, so the data of
 * the private people is shown to be in the fixture and in the payload, and it only then drops to
 * a visitor, so that the absence of the data is the gate and not an empty fixture. A positive
 * control keeps the assertions on the visitor result from passing on an empty chart.
 *
 * A private person stays in the chart as a stub, as it does in the core charts. The stub holds
 * the existence of the person, its xref, its sex and its position in the tree, and nothing else.
 * The name of the stub is the "Private" placeholder, and the dates, places, image and facts are
 * empty. A guessed xref of a private person therefore yields the same stub.
 *
 * The webtrees record factory caches the records of a request, and a cached record keeps the
 * names it extracted for the first viewer. A request has one viewer, so the test clears that
 * cache whenever the viewer changes.
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
final class DataFacadePrivacyTest extends TestCase
{
    use RealTreeFixtureTrait;

    /**
     * Values that exist only on private people, the confidential deceased mother (I3), the living
     * grandfather (I4) and the marriage records that list them. Every one is shown to the
     * administrator and must not reach the visitor.
     *
     * @var list<string>
     */
    private const array PRIVATE_TOKENS = [
        'Motherly',
        'Confidentialmother',
        'Hiddenmotherplace',
        '1877',
        '1951',
        'Grandy',
        'Livingfather',
        'Hiddenlivingplace',
        '1931',
        'Hiddenmarriageplace',
        '1896',
        'Hiddenlivingmarriageplace',
        '1953',
        'media-thumbnail',
    ];

    /**
     * Values of the public deceased people, which a visitor sees.
     *
     * @var list<string>
     */
    private const array PUBLIC_TOKENS = [
        'Rootline',
        'Publicroot',
        'Rootbirthplace',
        'Rootdeathplace',
        '1900',
        '1975',
        'Fatherly',
        'Publicfather',
        'Fatherbirthplace',
        '1870',
        '1940',
        'Grandma',
        'Publicgrandmother',
        'Grandmabirthplace',
        '1845',
        '1910',
    ];

    private Module $module;

    private string $indexDirectory;

    /**
     * Boots webtrees, builds a fresh schema in memory and logs in an administrator, the way the
     * import of a tree runs in production.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->bootRealWebtrees();

        // The media file of the living person has to exist, because the image of a person is only
        // referenced when its file is there.
        $this->indexDirectory = sys_get_temp_dir() . '/fan-chart-privacy-' . uniqid('', true) . '/';

        if (!mkdir($this->indexDirectory . 'media', 0o777, true) && !is_dir($this->indexDirectory . 'media')) {
            throw new RuntimeException('The media directory could not be created.');
        }

        file_put_contents($this->indexDirectory . 'media/hiddenlivingphoto.jpg', 'image');
        Site::setPreference('INDEX_DIRECTORY', $this->indexDirectory);

        DB::table('module')->insert(['module_name' => 'webtrees-fan-chart']);
        DB::table('module_setting')->insert([
            'module_name'   => 'webtrees-fan-chart',
            'setting_name'  => 'default_placeFormat',
            'setting_value' => 'full',
        ]);

        $this->module = new Module(self::createStub(ChartService::class), new DataFacade());
        $this->module->setName('webtrees-fan-chart');
    }

    /**
     * Drops the viewer and the media directory of the test.
     */
    protected function tearDown(): void
    {
        Auth::logout();
        Session::clear();
        Site::$preferences = [];
        Registry::cache(new CacheFactory());

        unlink($this->indexDirectory . 'media/hiddenlivingphoto.jpg');

        rmdir($this->indexDirectory . 'media');
        rmdir($this->indexDirectory);

        $this->restoreMinimalDatabase();

        parent::tearDown();
    }

    /**
     * The administrator control. Every private value is in the payload of the importing
     * administrator, and so is the public data, so the visitor test below measures the gate.
     */
    #[Test]
    public function administratorPayloadHoldsTheDataOfThePrivatePeople(): void
    {
        $tree = $this->importTree();

        $payload = $this->payload($tree, 'I1');

        foreach ([...self::PRIVATE_TOKENS, ...self::PUBLIC_TOKENS] as $token) {
            PayloadToken::assertPresent($this, $token, $payload, 'The administrator should see ' . $token);
        }
    }

    /**
     * A visitor gets no name, date, place, image reference or fact of a private person, from the
     * ancestors of a public person, and the public deceased people are still there.
     */
    #[Test]
    public function visitorPayloadHoldsNothingOfThePrivatePeople(): void
    {
        $tree = $this->importTree();

        // The control runs as the administrator and fills the record cache with the administrator view.
        self::assertStringContainsString('Livingfather', $this->payload($tree, 'I1'));

        $payload = $this->asVisitor($tree, 'I1');

        foreach (self::PUBLIC_TOKENS as $token) {
            PayloadToken::assertPresent($this, $token, $payload, 'The visitor should see ' . $token);
        }

        foreach (self::PRIVATE_TOKENS as $token) {
            PayloadToken::assertAbsent($this, $token, $payload, 'The visitor must not see ' . $token);
        }
    }

    /**
     * A chart centred on a guessed private xref shows the stub of the core charts, which is the
     * existence of the person, its xref, its sex and its position, and nothing more.
     */
    #[Test]
    public function guessedPrivateXrefYieldsTheCoreCompatibleStub(): void
    {
        $tree = $this->importTree();

        self::assertStringContainsString('Confidentialmother', $this->payload($tree, 'I3'));

        $visitorTree = $this->asVisitorNode($tree, 'I3');
        $data        = $visitorTree->getData()->jsonSerialize();

        self::assertSame('I3', $data['xref']);
        self::assertSame('F', $data['sex']);
        self::assertSame(1, $data['generation']);
        self::assertSame('Private', $data['name']);
        self::assertSame(['Private'], [...$data['firstNames'], ...$data['lastNames']]);

        foreach (['birth', 'death', 'marriageDate', 'marriageDateOfParents', 'timespan', 'birthDateFull', 'deathDateFull', 'marriageDateFull', 'birthPlace', 'deathPlace', 'marriagePlace', 'thumbnail', 'silhouette'] as $field) {
            self::assertSame('', $data[$field], $field . ' of the stub should be empty');
        }

        self::assertArrayHasKey('facts', $data);
        self::assertSame([null, null], $data['facts']);

        $payload = json_encode($visitorTree, JSON_THROW_ON_ERROR);

        // The public relatives of the stub are in the chart, so the stub is not an empty result.
        self::assertStringContainsString('Publicfather', $payload);

        foreach (self::PRIVATE_TOKENS as $token) {
            PayloadToken::assertAbsent($this, $token, $payload, 'The stub must not carry ' . $token);
        }
    }

    /**
     * The tooltip may show a silhouette once the tree preference for silhouettes is on, and the
     * silhouette URL is the only carrier of that image. A visitor gets none for a person that the
     * privacy engine hides, whereas a person that the visitor may see gets one.
     */
    #[Test]
    public function visitorGetsNoSilhouetteUrlForAPrivatePersonWhenSilhouettesAreOn(): void
    {
        $tree = $this->importTree();

        $tree->setPreference('USE_SILHOUETTE', '1');

        // The control runs as the administrator, who sees the private person with a silhouette.
        $administratorData = $this->nodeTree($tree, 'I3')->getData()->jsonSerialize();

        self::assertNotSame('', $administratorData['silhouette']);

        $privateData = $this->asVisitorNode($tree, 'I3')->getData()->jsonSerialize();
        $publicData  = $this->asVisitorNode($tree, 'I1')->getData()->jsonSerialize();

        self::assertSame('', $privateData['silhouette']);
        self::assertNotSame('', $publicData['silhouette']);
    }

    /**
     * Builds the payload as a visitor, after the record cache of the administrator view is gone.
     *
     * @param Tree   $tree The imported tree
     * @param string $xref The xref of the centre of the chart
     */
    private function asVisitor(Tree $tree, string $xref): string
    {
        return json_encode($this->asVisitorNode($tree, $xref), JSON_THROW_ON_ERROR);
    }

    /**
     * Builds the node tree as a visitor of a tree that hides living people.
     *
     * @param Tree   $tree The imported tree
     * @param string $xref The xref of the centre of the chart
     */
    private function asVisitorNode(Tree $tree, string $xref): Node
    {
        Registry::cache(new CacheFactory());
        Auth::logout();

        return $this->nodeTree($tree, $xref);
    }

    /**
     * Returns the JSON payload of the chart as the current viewer.
     *
     * @param Tree   $tree The imported tree
     * @param string $xref The xref of the centre of the chart
     */
    private function payload(Tree $tree, string $xref): string
    {
        return json_encode($this->nodeTree($tree, $xref), JSON_THROW_ON_ERROR);
    }

    /**
     * Builds the node tree with the detail panel facts, the images, the places and the descendants
     * on, so that every kind of data the chart carries is in the payload.
     *
     * @param Tree   $tree The imported tree
     * @param string $xref The xref of the centre of the chart
     */
    private function nodeTree(Tree $tree, string $xref): Node
    {
        $individual = Registry::individualFactory()->make($xref, $tree);
        self::assertInstanceOf(Individual::class, $individual);

        $request = (new ServerRequest('GET', '/'))->withQueryParams([
            'generations'     => '4',
            'showDetailPanel' => '1',
            'showPlaces'      => '1',
            'showImages'      => '1',
            'showDescendants' => '1',
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
     * Imports the fixture tree as the administrator and turns the privacy engine on. Living people
     * are hidden and the dead are public, so a visitor sees a person only when the person is dead
     * and not restricted.
     */
    private function importTree(): Tree
    {
        $tree = $this->importGedcom((string) file_get_contents(__DIR__ . '/../Support/fixtures/privacy-ancestry.ged'), 'privacy');

        $tree->setPreference('HIDE_LIVE_PEOPLE', '1');
        $tree->setPreference('SHOW_DEAD_PEOPLE', (string) Auth::PRIV_PRIVATE);
        $tree->setPreference('SHOW_HIGHLIGHT_IMAGES', '1');

        return $tree;
    }
}
