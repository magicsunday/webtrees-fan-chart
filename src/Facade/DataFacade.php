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
 * Facade class to hide complex logic to generate the structure required to display the tree.
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
     * Creates the JSON tree structure.
     *
     * @param ModuleCustomInterface $module
     * @param Configuration         $configuration
     * @param Individual            $individual
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
     * Recursively build the data array of the individual ancestors.
     *
     * @param Individual|null $individual The start person
     * @param int             $generation The current generation
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
     * Get the node data required for display the chart.
     *
     * @param int        $generation The generation the person belongs to
     * @param Individual $individual The current individual
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
     * Get the raw update URL. The "xref" parameter must be the last one as the URL gets appended
     * with the clicked individual id in order to load the required chart data.
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
        $showPlaces = $this->configuration->getShowPlaces();

        // Outer generations: compact format with optional places
        if ($generation > $this->configuration->getDetailedDateGenerations()) {
            if (!$showPlaces) {
                return $dateProcessor->getCompactLifetimeDescription();
            }

            // With places: use two-line format (* year, place / † year, place)
            // so both birth and death places can be shown
            $birthYear = $dateProcessor->hasBirthDate()
                ? (string) $dateProcessor->getBirthYear() : '';
            $deathYear = $dateProcessor->hasDeathDate()
                ? (string) $dateProcessor->getDeathYear() : '';

            $birthLine = $this->buildEventLine(
                Symbols::Birth->value,
                $birthYear,
                $placeProcessor->getBirthPlaceShort(),
            );

            $deathLine = $this->buildEventLine(
                Symbols::Death->value,
                $deathYear,
                $placeProcessor->getDeathPlaceShort(),
            );

            $lines = array_filter(
                [$birthLine, $deathLine],
                static fn (string $line): bool => $line !== '',
            );

            if ($lines !== []) {
                return implode("\n", $lines);
            }

            if ($dateProcessor->isDead()) {
                return Symbols::Death->value;
            }

            return '';
        }

        $birthLine = $this->buildEventLine(
            Symbols::Birth->value,
            $dateProcessor->getFormattedBirthDate(),
            $showPlaces ? $placeProcessor->getBirthPlaceShort() : '',
        );

        $deathLine = $this->buildEventLine(
            Symbols::Death->value,
            $dateProcessor->getFormattedDeathDate(),
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
     * generations within the detailed date range.
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

        if ($generation > $this->configuration->getDetailedDateGenerations()) {
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
     * Returns the short marriage place of the individual's parents
     * (for arc text, respects placeParts setting).
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
     * Returns whether the given text is in RTL style or not.
     *
     * @param string $text The text to check
     *
     * @return bool
     */
    private function isRtl(string $text): bool
    {
        return I18N::scriptDirection(I18N::textScript($text)) === 'rtl';
    }
}
