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
use Fisharebest\Webtrees\Fact;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use MagicSunday\Webtrees\ModuleBase\Contract\ModuleAssetUrlInterface;
use MagicSunday\Webtrees\ModuleBase\Facade\ModuleAwareDataFacadeTrait;
use MagicSunday\Webtrees\ModuleBase\Model\Symbols;
use MagicSunday\Webtrees\ModuleBase\Processor\DateProcessor;
use MagicSunday\Webtrees\ModuleBase\Processor\ImageProcessor;
use MagicSunday\Webtrees\ModuleBase\Processor\NameProcessor;
use MagicSunday\Webtrees\ModuleBase\Processor\PlaceProcessor;
use MagicSunday\Webtrees\ModuleBase\Support\CompactDateFormat;
use MagicSunday\Webtrees\ModuleBase\Support\Locale\IsoCountryMap;
use MagicSunday\Webtrees\ModuleBase\Support\TextDirection;

use function html_entity_decode;
use function strip_tags;

use const ENT_QUOTES;

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
class DataFacade
{
    use ModuleAwareDataFacadeTrait;

    /**
     * The configuration instance. Initialized by createTreeStructure() on each
     * call. Accessing before createTreeStructure() throws "Uninitialized typed
     * property".
     */
    private Configuration $configuration;

    /**
     * The incremental node identifier.
     */
    private int $nodeId = 0;

    /**
     * The locale-aware compact date format for the current request. Resolved once in
     * createTreeStructure() and reused for every node — the active locale does not
     * change within a request, and CompactDateFormat::forLocale() parses an ICU
     * pattern that is wasteful to recompute per node (up to ~1023 for 10 generations).
     */
    private string $compactDateFormat = CompactDateFormat::FALLBACK;

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
        $this->nodeId            = 0;
        $this->compactDateFormat = CompactDateFormat::forLocale(I18N::languageTag());

        $rootNode = $this->buildTreeStructure($individual);

        if (($rootNode instanceof Node) && $this->configuration->getShowDescendants()) {
            $this->buildDescendantStructure($rootNode, $individual);
        }

        return $rootNode;
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
     * Only sets id, generation, and sex.
     *
     * @param int $generation The generation depth (typically -1)
     *
     * @return NodeData
     */
    private function createEmptyPartnerNode(int $generation): NodeData
    {
        return (new NodeData())
            ->setId(++$this->nodeId)
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
            ->setId(++$this->nodeId)
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

        return $treeData;
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
