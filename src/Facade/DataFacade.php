<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Facade;

use Fisharebest\Webtrees\Date;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Fact;
use Fisharebest\Webtrees\Factories\FamilyFactory;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\Gedcom;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Tree;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use MagicSunday\Webtrees\ModuleBase\Contract\ModuleAssetUrlInterface;
use MagicSunday\Webtrees\ModuleBase\Facade\ModuleAwareDataFacadeTrait;
use MagicSunday\Webtrees\ModuleBase\Model\PlaceFormatSpec;
use MagicSunday\Webtrees\ModuleBase\Model\PlaceStyle;
use MagicSunday\Webtrees\ModuleBase\Model\Symbols;
use MagicSunday\Webtrees\ModuleBase\Processor\DateProcessor;
use MagicSunday\Webtrees\ModuleBase\Processor\FactResolver;
use MagicSunday\Webtrees\ModuleBase\Processor\ImageProcessor;
use MagicSunday\Webtrees\ModuleBase\Processor\NameProcessor;
use MagicSunday\Webtrees\ModuleBase\Processor\PlaceProcessor;
use MagicSunday\Webtrees\ModuleBase\Support\CompactDateFormat;
use MagicSunday\Webtrees\ModuleBase\Support\Locale\IsoCountryMap;
use MagicSunday\Webtrees\ModuleBase\Support\MediaPreloader;
use MagicSunday\Webtrees\ModuleBase\Support\PendingRecords;
use MagicSunday\Webtrees\ModuleBase\Support\TextDirection;

use function array_chunk;
use function array_flip;
use function array_unique;
use function array_values;
use function html_entity_decode;
use function in_array;
use function is_string;
use function preg_match_all;
use function strip_tags;

use const ENT_QUOTES;
use const PREG_SET_ORDER;

/**
 * Assembles the nested Node tree passed to the JavaScript chart renderer.
 * Coordinates the date, image, name, and place processors to build fully
 * populated NodeData objects, then recursively links them into a parent/child
 * hierarchy up to the configured generation depth.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class DataFacade
{
    use ModuleAwareDataFacadeTrait;

    /**
     * The most values that one preload statement binds. A generation of the ancestor tree
     * doubles with each step, so a lookup of a whole generation in one statement would
     * reach the placeholder ceiling of the database on a deep and complete pedigree.
     */
    private const int PRELOAD_CHUNK_SIZE = MediaPreloader::CHUNK_SIZE;

    /**
     * The configuration instance. Initialized by createTreeStructure() on each
     * call. Accessing before createTreeStructure() throws "Uninitialized typed
     * property".
     */
    private Configuration $configuration;

    /**
     * The locale-aware compact date format for the current request. Resolved once in
     * createTreeStructure() and reused for every node — the active locale does not
     * change within a request, and CompactDateFormat::forLocale() parses an ICU
     * pattern that is wasteful to recompute per node (up to ~1023 for 10 generations).
     */
    private string $compactDateFormat = CompactDateFormat::FALLBACK;

    /**
     * The resolver of the facts of the detail panel, built on first use and shared
     * by every node of the request. It belongs to the tree of one request, so
     * createTreeStructure() drops it.
     */
    private ?FactResolver $factResolver = null;

    /**
     * Builds the complete Node tree rooted at the given individual and returns
     * it ready for JSON serialisation. Resets the node counter on each call so
     * IDs are always consecutive starting at 1.
     *
     * @param ModuleCustomInterface&ModuleAssetUrlInterface $module
     * @param Configuration                                 $configuration
     * @param Individual                                    $individual    The root individual (generation 1)
     */
    public function createTreeStructure(
        ModuleCustomInterface&ModuleAssetUrlInterface $module,
        Configuration $configuration,
        Individual $individual,
    ): ?Node {
        $this->setModule($module);
        $this->configuration     = $configuration;
        $this->compactDateFormat = CompactDateFormat::forLocale(I18N::languageTag());
        $this->factResolver      = null;

        $this->preloadAncestors($individual, new MediaPreloader());

        $rootNode = $this->buildTreeStructure($individual);

        if (($rootNode instanceof Node) && $this->configuration->getShowDescendants()) {
            $this->buildDescendantStructure($rootNode, $individual);
        }

        return $rootNode;
    }

    /**
     * Loads the records of the ancestor tree one generation at a time, before the walk reads
     * them, so that the walk finds every family and every parent in the record cache of
     * webtrees and sends no statement of its own. Without it the walk reads one family and
     * its members per person, and the statements grow with the number of people instead of
     * the number of generations.
     *
     * The chart reads the parent family of every person up to the last generation, for the
     * marriage of the parents, so the families of that generation are loaded too. Nothing
     * beyond it is read.
     *
     * @param Individual     $individual     The root individual (generation 1)
     * @param MediaPreloader $mediaPreloader The preload of the media objects of this request
     */
    private function preloadAncestors(Individual $individual, MediaPreloader $mediaPreloader): void
    {
        $generationPeople = [$individual];

        for ($generation = 1; $generation <= $this->configuration->getGenerations(); ++$generation) {
            // The walk reads the highlight image of every person of the generation, so their media
            // objects are loaded before it gets there.
            $mediaPreloader->preload($individual->tree(), $generationPeople);

            $generationPeople = $this->preloadParentFamilies($individual->tree(), $generationPeople);
        }
    }

    /**
     * Loads the parent families of the given people and the people in them with a few chunked
     * statements, and returns those parents, which are the next generation.
     *
     * The records go into the record cache of webtrees under the key that its own record
     * factory reads. A family with a pending change is left out, because the factory decides
     * on its own what an editor sees of it, so it is loaded on demand as it always was.
     *
     * @param Tree             $tree   The tree of the people
     * @param list<Individual> $people The people of one generation
     *
     * @return list<Individual> The parents of the people
     */
    private function preloadParentFamilies(Tree $tree, array $people): array
    {
        // The record text is read directly. The facts of a person would resolve the family of every
        // FAMC fact on their own, one statement each, before the families are in the cache.
        $familyXrefs = [];

        foreach ($people as $person) {
            preg_match_all('/\n1 FAMC @(' . Gedcom::REGEX_XREF . ')@/', $person->gedcom(), $match);

            foreach ($match[1] as $familyXref) {
                $familyXrefs[] = $familyXref;
            }
        }

        $familyXrefs = array_values(array_unique($familyXrefs));

        // The rows are kept as a list of pairs. A numeric xref as an array key would turn into an
        // integer and no longer fit the string parameter of the record factory.
        $families = [];

        foreach (array_chunk($familyXrefs, self::PRELOAD_CHUNK_SIZE) as $chunk) {
            $rows = DB::table('families')
                ->where('f_file', '=', $tree->id())
                ->whereIn('f_id', $chunk)
                ->get();

            foreach ($rows as $row) {
                // These checks narrow the untyped query row to text for the static analysis and cost
                // nothing. They are no case to look for. A row that does not hold text is left to the
                // record factory.
                if (
                    !is_string($row->f_id)
                    || !is_string($row->f_gedcom)
                ) {
                    continue;
                }

                $families[] = [
                    'xref'   => $row->f_id,
                    'gedcom' => $row->f_gedcom,
                ];
            }
        }

        // The visibility check of a family reads every member of it, the children as well, so all of
        // them are loaded. Only the parents are the next generation of the chart.
        $memberXrefs = [];
        $parentXrefs = [];

        foreach ($families as $family) {
            preg_match_all(
                '/\n1 (HUSB|WIFE|CHIL) @(' . Gedcom::REGEX_XREF . ')@/',
                $family['gedcom'],
                $matches,
                PREG_SET_ORDER
            );

            foreach ($matches as $match) {
                $memberXrefs[] = $match[2];

                if ($match[1] !== 'CHIL') {
                    $parentXrefs[] = $match[2];
                }
            }
        }

        $parentLookup = array_flip($parentXrefs);

        // The members go into the cache before their families, because the construction of a family
        // reads them from there.
        $parents = [];

        foreach (array_chunk(array_values(array_unique($memberXrefs)), self::PRELOAD_CHUNK_SIZE) as $chunk) {
            $rows = DB::table('individuals')
                ->where('i_file', '=', $tree->id())
                ->whereIn('i_id', $chunk)
                ->get()
                ->map(Registry::individualFactory()->mapper($tree));

            foreach ($rows as $member) {
                if (isset($parentLookup[$member->xref()])) {
                    $parents[] = $member;
                }
            }
        }

        $pendingXrefs = PendingRecords::xrefs($tree, $familyXrefs, self::PRELOAD_CHUNK_SIZE);

        foreach ($families as $family) {
            if (in_array($family['xref'], $pendingXrefs, true)) {
                continue;
            }

            Registry::cache()->array()->remember(
                FamilyFactory::class . $family['xref'] . '@' . $tree->id(),
                static fn (): Family => Registry::familyFactory()->new($family['xref'], $family['gedcom'], null, $tree),
            );
        }

        return $parents;
    }

    /**
     * Recursively constructs ancestor nodes. Returns null when the individual
     * is absent or the generation ceiling has been reached.
     *
     * @param Individual|null $individual
     * @param int             $generation 1-based depth; stops when it exceeds getGenerations()
     */
    private function buildTreeStructure(
        ?Individual $individual,
        int $generation = 1,
    ): ?Node {
        // Maximum generation reached
        if ((!$individual instanceof Individual) || ($generation > $this->configuration->getGenerations())) {
            return null;
        }

        $node = new Node(
            $this->getNodeData($generation, $individual)
        );

        /** @var Family|null $family */
        $family = $individual->childFamilies()->first();

        if ($family === null) {
            return $node;
        }

        // Recursively call the method for the parents of the individual
        $fatherNode = $this->buildTreeStructure($family->husband(), $generation + 1);
        $motherNode = $this->buildTreeStructure($family->wife(), $generation + 1);

        // Add an array of child nodes
        if ($fatherNode instanceof Node) {
            $node->addParent($fatherNode);
        }

        if ($motherNode instanceof Node) {
            $node->addParent($motherNode);
        }

        return $node;
    }

    /**
     * Builds the descendant section (partners + children) for the root
     * individual. Each spouse family produces one partner node with its
     * children attached. Privacy-hidden spouses are detected via HUSB/WIFE fact
     * analysis.
     *
     * @param Node       $rootNode   The root node to attach descendants to
     * @param Individual $individual The root individual
     */
    private function buildDescendantStructure(Node $rootNode, Individual $individual): void
    {
        foreach ($individual->spouseFamilies() as $family) {
            $spouse          = $family->spouse($individual);
            $visibleChildren = $family->children();

            if ($spouse !== null) {
                // Normal case: visible partner
                $partnerNodeData = $this->getNodeData(1, $spouse);
                $partnerNodeData->setGeneration(-1);

                // Suppress irrelevant marriage fields for descendants;
                // thumbnail/silhouette stay so the chart-arc renders an image
                // when the arc is wide enough, and the tooltip stays
                // consistent with what the arc would show.
                $partnerNodeData
                    ->setMarriageDateOfParents('');

                // Set marriage date from the specific family record
                // (not from DateProcessor which only looks at the first spouse family).
                // Use generation 0 because the partner marriage arc sits adjacent to the
                // center person, not one level deeper like ancestor marriage arcs.
                $marriageDate = $family->getMarriageDate();

                $partnerNodeData->setMarriageDate(
                    $marriageDate->isOK()
                        ? DateProcessor::formatMarriageDate(
                            $marriageDate,
                            0,
                            $this->configuration->getDetailedDateGenerations(),
                            $this->compactDateFormat
                        )
                        : ''
                );

                $partnerNode = new Node($partnerNodeData);
            } else {
                // spouse() returned null -- distinguish: no pointer vs. privacy-hidden
                $hasSpousePointer = $family->facts(['HUSB', 'WIFE'])
                    ->filter(
                        static fn (Fact $fact): bool => $fact->value() !== '@' . $individual->xref() . '@'
                    )
                    ->isNotEmpty();

                if ($hasSpousePointer) {
                    // Spouse is privacy-hidden -- no partner arc (would leak existence)
                    // Visible children go to unassignedChildren on root
                    foreach ($visibleChildren as $child) {
                        $rootNode->addUnassignedChild($this->buildDescendantChildNode($child));
                    }

                    continue;
                }

                if ($visibleChildren->isEmpty()) {
                    // No spouse pointer and no children -- skip family entirely
                    continue;
                }

                // Genuine unknown partner with visible children
                $partnerNode = new Node($this->createEmptyPartnerNode(-1));
            }

            // Attach children to the partner node
            $childNodes = [];

            foreach ($visibleChildren as $child) {
                $childNodes[] = $this->buildDescendantChildNode($child);
            }

            $partnerNode->setChildren($childNodes);
            $rootNode->addPartner($partnerNode);
        }
    }

    /**
     * Builds the node of a descendant child. A child sits at generation -2 and
     * never shows a marriage date. It also carries the compact year range that
     * the client shows instead of the timespan when the arcs are too narrow
     * for places.
     *
     * @param Individual $child The child to build the node for
     *
     * @return Node
     */
    private function buildDescendantChildNode(Individual $child): Node
    {
        $childNodeData = $this->getNodeData(2, $child);
        $childNodeData
            ->setCompactTimespan($this->buildCompactYearTimespan($child))
            ->setGeneration(-2)
            ->setMarriageDate('')
            ->setMarriageDateOfParents('');

        return new Node($childNodeData);
    }

    /**
     * Creates a minimal NodeData for an unknown partner (no Individual record).
     * Only sets generation and sex.
     *
     * @param int $generation The generation depth (typically -1)
     *
     * @return NodeData
     */
    private function createEmptyPartnerNode(int $generation): NodeData
    {
        return (new NodeData())
            ->setGeneration($generation)
            ->setSex('U');
    }

    /**
     * Populates a NodeData DTO from all processors for the given individual.
     *
     * @param int        $generation 1-based generation depth, used to select date format
     * @param Individual $individual
     *
     * @return NodeData
     */
    private function getNodeData(int $generation, Individual $individual): NodeData
    {
        $nameProcessor  = new NameProcessor($individual);
        $imageProcessor = new ImageProcessor($this->module, $individual);
        $dateProcessor  = new DateProcessor(
            $individual,
            $generation,
            $this->configuration->getDetailedDateGenerations(),
            $this->compactDateFormat,
        );
        $placeProcessor = new PlaceProcessor(
            $individual,
            $this->configuration->getPlaceFormat(),
            new IsoCountryMap()
        );

        $showNicknames = $this->configuration->getShowNicknames();
        $fullNN        = $showNicknames
            ? $nameProcessor->getFullNameWithNickname()
            : $nameProcessor->getFullName();
        $alternativeName = $nameProcessor->getAlternateName($individual);

        $treeData = new NodeData();
        $treeData
            ->setGeneration($generation)
            ->setXref($individual->xref())
            ->setUrl($individual->url())
            ->setUpdateUrl($this->getUpdateRoute($individual))
            ->setName($fullNN)
            ->setIsNameRtl(TextDirection::isRtl($fullNN))
            ->setFirstNames($nameProcessor->getFirstNames())
            ->setLastNames($nameProcessor->getLastNames())
            ->setPreferredName($nameProcessor->getPreferredName())
            ->setNickname($showNicknames ? $nameProcessor->getNickname() : '')
            ->setAlternativeName($alternativeName)
            ->setIsAltRtl(TextDirection::isRtl($alternativeName))
            ->setThumbnail($imageProcessor->getHighlightImageUrl(100, 100))
            ->setSilhouette($imageProcessor->getSilhouetteUrl())
            ->setSex($individual->sex())
            ->setBirth($dateProcessor->getFormattedBirthDate())
            ->setDeath($dateProcessor->getFormattedDeathDate())
            ->setMarriageDate($dateProcessor->getFormattedMarriageDate())
            ->setMarriageDateOfParents(
                $this->appendPlaceToLine(
                    $dateProcessor->getFormattedMarriageDateOfParents(),
                    $this->getParentsMarriagePlaceShort($individual, $placeProcessor),
                    $generation
                )
            )
            ->setTimespan($this->buildTimespan($dateProcessor, $placeProcessor, $generation))
            ->setBirthDateFull($dateProcessor->getBirthDateFull())
            ->setDeathDateFull($dateProcessor->getDeathDateFull())
            ->setMarriageDateFull($dateProcessor->getMarriageDateFull())
            ->setBirthPlace($placeProcessor->getBirthPlace())
            ->setDeathPlace($placeProcessor->getDeathPlace())
            ->setMarriagePlace($placeProcessor->getMarriagePlace());

        // The facts are only read for the detail panel, so a chart without the panel
        // pays neither their payload nor their database work.
        if ($this->configuration->getShowDetailPanel()) {
            $treeData->setFacts($this->getFactResolver($individual->tree())->factsFor($individual, true));
        }

        return $treeData;
    }

    /**
     * Returns the resolver of the facts of the detail panel. The panel shows the
     * full place name, whatever place format the chart arcs use.
     *
     * @param Tree $tree
     *
     * @return FactResolver
     */
    private function getFactResolver(Tree $tree): FactResolver
    {
        return $this->factResolver ??= new FactResolver(
            $tree,
            new PlaceFormatSpec(PlaceStyle::Full),
            new IsoCountryMap(),
            $this->compactDateFormat
        );
    }

    /**
     * Builds the AJAX update route for an individual. The "xref" parameter is
     * intentionally the last query param so the JS can replace it by appending
     * a new xref when navigating.
     *
     * @param Individual $individual
     *
     * @return string
     */
    private function getUpdateRoute(Individual $individual): string
    {
        // Forward every form-toggle so re-centering on a different person
        // (the click-to-recenter URL) preserves the current selection
        // instead of falling back to module preference defaults — otherwise
        // toggles like showNicknames silently flip off as soon as the user
        // navigates to another box.
        return route(
            'module',
            [
                'module' => $this->module->name(),
                'action' => 'update',
                'xref'   => $individual->xref(),
                'tree'   => $individual->tree()->name(),
                ...$this->configuration->getRouteToggleParams(),
            ]
        );
    }

    /**
     * Builds the timespan string from structured date and place data. For outer
     * generations, returns a compact date-only format. For inner generations,
     * assembles birth and death lines from individual event components.
     *
     * @param DateProcessor  $dateProcessor
     * @param PlaceProcessor $placeProcessor
     * @param int            $generation
     *
     * @return string
     */
    private function buildTimespan(
        DateProcessor $dateProcessor,
        PlaceProcessor $placeProcessor,
        int $generation,
    ): string {
        $isDetailed = $generation <= $this->configuration->getDetailedDateGenerations();
        $showPlaces = $this->configuration->getShowPlaces()
            && ($generation <= ($this->configuration->getInnerArcs() + 1));

        // Outer generations without places: compact single-line format
        if (!$isDetailed && !$showPlaces) {
            return $dateProcessor->getCompactLifetimeDescription();
        }

        $birthLine = $this->buildEventLine(
            Symbols::Birth->value,
            $isDetailed ? $dateProcessor->getFormattedBirthDate() : $this->getYearString($dateProcessor, true),
            $showPlaces ? $placeProcessor->getBirthPlaceShort() : '',
        );

        $deathLine = $this->buildEventLine(
            Symbols::Death->value,
            $isDetailed ? $dateProcessor->getFormattedDeathDate() : $this->getYearString($dateProcessor, false),
            $showPlaces ? $placeProcessor->getDeathPlaceShort() : '',
        );

        $lines = array_filter([$birthLine, $deathLine], static fn (string $line): bool => $line !== '');

        if ($lines !== []) {
            return implode("\n", $lines);
        }

        // Deceased without any dates or places
        if ($dateProcessor->isDead()) {
            return Symbols::Death->value;
        }

        return '';
    }

    /**
     * Returns the year for a birth or death event as a string, or empty if
     * unavailable or zero.
     *
     * @param DateProcessor $dateProcessor
     * @param bool          $isBirth       True = birth year, false = death year
     *
     * @return string
     */
    private function getYearString(
        DateProcessor $dateProcessor,
        bool $isBirth,
    ): string {
        $hasDate = $isBirth ? $dateProcessor->hasBirthDate() : $dateProcessor->hasDeathDate();

        if (!$hasDate) {
            return '';
        }

        $year = $isBirth ? $dateProcessor->getBirthYear() : $dateProcessor->getDeathYear();

        return ($year > 0) ? (string) $year : '';
    }

    /**
     * Builds the compact year-only timespan (for example "1853–1933") without
     * places. Used when descendant arcs are too narrow for the full multi-line
     * timespan. The years come from the structured dates and not from their
     * display strings, so years below one thousand and years before the common
     * era are kept.
     *
     * @param Individual $individual The individual to build the timespan for
     *
     * @return string
     */
    private function buildCompactYearTimespan(Individual $individual): string
    {
        $birthYear = $this->formatYear($individual->getBirthDate());
        $deathYear = $this->formatYear($individual->getDeathDate());

        // Compact single-line format: "1853–1933"
        if (($birthYear !== '') && ($deathYear !== '')) {
            return $birthYear . Symbols::DateRangeSeparator->value . $deathYear;
        }

        if ($birthYear !== '') {
            return Symbols::Birth->value . ' ' . $birthYear;
        }

        if ($deathYear !== '') {
            return Symbols::Death->value . ' ' . $deathYear;
        }

        return '';
    }

    /**
     * Formats the year of the earliest date of a date range, or returns an empty
     * string when the date is not usable. A year of the common era is the bare
     * number, like the compact lifetime of the outer generations. A year before
     * the common era carries the era suffix of the visitor locale, reduced from
     * the display markup of webtrees to plain text, because the value ends up in
     * an SVG text node and is escaped there.
     *
     * @param Date $date The date to take the year from
     *
     * @return string
     */
    private function formatYear(Date $date): string
    {
        if (!$date->isOK()) {
            return '';
        }

        $earliestDate = $date->minimumDate();

        if ($earliestDate->year() > 0) {
            return (string) $earliestDate->year();
        }

        return html_entity_decode(strip_tags($earliestDate->format('%Y')), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Builds a single event line from a symbol, date, and place. Returns an
     * empty string if both date and place are absent.
     *
     * @param string $symbol The genealogical symbol (e.g. * or †)
     * @param string $date   The formatted date string
     * @param string $place  The place name
     *
     * @return string
     */
    private function buildEventLine(
        string $symbol,
        string $date,
        string $place,
    ): string {
        if (($date === '') && ($place === '')) {
            return '';
        }

        $line = $symbol;

        if ($date !== '') {
            $line .= ' ' . $date;
        }

        if ($place !== '') {
            $line .= ($date !== '') ? ', ' . $place : ' ' . $place;
        }

        return $line;
    }

    /**
     * Appends a place to a single date line. Only applied for generations
     * within the inner arcs range.
     *
     * @param string $dateLine   The date string
     * @param string $place      The place name
     * @param int    $generation The generation depth
     *
     * @return string
     */
    private function appendPlaceToLine(
        string $dateLine,
        string $place,
        int $generation,
    ): string {
        if (!$this->configuration->getShowPlaces()) {
            return $dateLine;
        }

        if ($generation > ($this->configuration->getInnerArcs() + 1)) {
            return $dateLine;
        }

        if ($place === '') {
            return $dateLine;
        }

        if ($dateLine === '') {
            return $place;
        }

        return $dateLine . ', ' . $place;
    }

    /**
     * Returns the abbreviated marriage place of the individual's parents for
     * use in arc text. Applies the configured place format. Returns empty
     * string if no parent family exists.
     *
     * @param Individual     $individual
     * @param PlaceProcessor $placeProcessor
     *
     * @return string
     */
    private function getParentsMarriagePlaceShort(
        Individual $individual,
        PlaceProcessor $placeProcessor,
    ): string {
        $family = $individual->childFamilies()->first();

        if ($family === null) {
            return '';
        }

        return $placeProcessor->shortPlaceName($family->getMarriagePlace());
    }
}
