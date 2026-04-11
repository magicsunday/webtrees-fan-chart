<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Facade;

use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use MagicSunday\Webtrees\FanChart\Model\Symbols;
use MagicSunday\Webtrees\FanChart\Processor\DateProcessor;
use MagicSunday\Webtrees\FanChart\Processor\ImageProcessor;
use MagicSunday\Webtrees\FanChart\Processor\NameProcessor;
use MagicSunday\Webtrees\FanChart\Processor\PlaceProcessor;

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
    /**
     * The module. Initialized by createTreeStructure() on each call.
     * Accessing before createTreeStructure() throws "Uninitialized typed property".
     */
    private ModuleCustomInterface $module;

    /**
     * The configuration instance. Initialized by createTreeStructure() on each call.
     * Accessing before createTreeStructure() throws "Uninitialized typed property".
     */
    private Configuration $configuration;

    /**
     * The incremental node identifier.
     */
    private int $nodeId = 0;

    /**
     * Builds the complete Node tree rooted at the given individual and returns it
     * ready for JSON serialisation. Resets the node counter on each call so IDs
     * are always consecutive starting at 1.
     *
     * @param ModuleCustomInterface $module
     * @param Configuration         $configuration
     * @param Individual            $individual    The root individual (generation 1)
     *
     * @return Node|null
     */
    public function createTreeStructure(
        ModuleCustomInterface $module,
        Configuration $configuration,
        Individual $individual,
    ): ?Node {
        $this->module        = $module;
        $this->configuration = $configuration;
        $this->nodeId        = 0;

        return $this->buildTreeStructure($individual);
    }

    /**
     * Recursively constructs ancestor nodes. Returns null when the individual is
     * absent or the generation ceiling has been reached.
     *
     * @param Individual|null $individual
     * @param int             $generation 1-based depth; stops when it exceeds getGenerations()
     *
     * @return Node|null
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
     * Populates a NodeData DTO from all processors for the given individual.
     *
     * @param int        $generation 1-based generation depth, used to select date format
     * @param Individual $individual
     *
     * @return NodeData
     */
    private function getNodeData(
        int $generation,
        Individual $individual,
    ): NodeData {
        $nameProcessor  = new NameProcessor($individual);
        $imageProcessor = new ImageProcessor($this->module, $individual);
        $dateProcessor  = new DateProcessor(
            $individual,
            $generation,
            $this->configuration->getDetailedDateGenerations(),
        );
        $placeProcessor = new PlaceProcessor(
            $individual,
            $this->configuration->getPlaceParts(),
        );

        $fullNN          = $nameProcessor->getFullName();
        $alternativeName = $nameProcessor->getAlternateName($individual);

        $treeData = new NodeData();
        $treeData
            ->setId(++$this->nodeId)
            ->setGeneration($generation)
            ->setXref($individual->xref())
            ->setUrl($individual->url())
            ->setUpdateUrl($this->getUpdateRoute($individual))
            ->setName($fullNN)
            ->setIsNameRtl($this->isRtl($fullNN))
            ->setFirstNames($nameProcessor->getFirstNames())
            ->setLastNames($nameProcessor->getLastNames())
            ->setPreferredName($nameProcessor->getPreferredName())
            ->setAlternativeName($alternativeName)
            ->setIsAltRtl($this->isRtl($alternativeName))
            ->setThumbnail($imageProcessor->getHighlightImageUrl(100, 100))
            ->setSex($individual->sex())
            ->setBirth($dateProcessor->getBirthDate())
            ->setDeath($dateProcessor->getDeathDate())
            ->setMarriageDate($dateProcessor->getMarriageDate())
            ->setMarriageDateOfParents(
                $this->appendPlaceToLine(
                    $dateProcessor->getMarriageDateOfParents(),
                    $this->getParentsMarriagePlaceShort($individual, $placeProcessor),
                    $generation
                )
            )
            ->setTimespan(
                $this->buildTimespan($dateProcessor, $placeProcessor, $generation)
            )
            ->setBirthDateFull($dateProcessor->getBirthDateFull())
            ->setDeathDateFull($dateProcessor->getDeathDateFull())
            ->setMarriageDateFull($dateProcessor->getMarriageDateFull())
            ->setBirthPlace($placeProcessor->getBirthPlace())
            ->setDeathPlace($placeProcessor->getDeathPlace())
            ->setMarriagePlace($placeProcessor->getMarriagePlace())
            ->setIndividual($individual);

        return $treeData;
    }

    /**
     * Builds the AJAX update route for an individual. The "xref" parameter is intentionally
     * the last query param so the JS can replace it by appending a new xref when navigating.
     *
     * @param Individual $individual
     *
     * @return string
     */
    private function getUpdateRoute(Individual $individual): string
    {
        return route(
            'module',
            [
                'module'                  => $this->module->name(),
                'action'                  => 'update',
                'xref'                    => $individual->xref(),
                'tree'                    => $individual->tree()->name(),
                'generations'             => $this->configuration->getGenerations(),
                'detailedDateGenerations' => $this->configuration->getDetailedDateGenerations(),
                'showPlaces'              => $this->configuration->getShowPlaces() ? '1' : '0',
                'placeParts'              => $this->configuration->getPlaceParts(),
            ]
        );
    }

    /**
     * Builds the timespan string from structured date and place data.
     * For outer generations, returns a compact date-only format.
     * For inner generations, assembles birth and death lines from
     * individual event components.
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
     * Returns the year for a birth or death event as a string, or empty if unavailable or zero.
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
     * Builds a single event line from a symbol, date, and place.
     * Returns an empty string if both date and place are absent.
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
     * Appends a place to a single date line. Only applied for
     * generations within the inner arcs range.
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
     * Returns the abbreviated marriage place of the individual's parents for use in arc text.
     * Applies the configured placeParts truncation. Returns empty string if no parent family exists.
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

    /**
     * Returns true when the dominant script of the given text runs right-to-left.
     *
     * @param string $text
     *
     * @return bool
     */
    private function isRtl(string $text): bool
    {
        return I18N::scriptDirection(I18N::textScript($text)) === 'rtl';
    }
}
