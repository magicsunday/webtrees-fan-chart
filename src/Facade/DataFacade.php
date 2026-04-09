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
     * The module.
     */
    private ModuleCustomInterface $module;

    /**
     * The configuration instance.
     */
    private Configuration $configuration;

    /**
     * The incremental node identifier.
     */
    private int $nodeId = 0;

    /**
     * @param ModuleCustomInterface $module
     *
     * @return DataFacade
     */
    public function setModule(ModuleCustomInterface $module): DataFacade
    {
        $this->module = $module;

        return $this;
    }

    /**
     * @param Configuration $configuration
     *
     * @return DataFacade
     */
    public function setConfiguration(Configuration $configuration): DataFacade
    {
        $this->configuration = $configuration;

        return $this;
    }

    /**
     * Creates the JSON tree structure.
     *
     * @param Individual $individual
     *
     * @return Node|null
     */
    public function createTreeStructure(Individual $individual): ?Node
    {
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
                    $this->getMarriagePlaceShort($individual),
                    $generation
                )
            )
            ->setTimespan(
                $this->appendPlaces(
                    $dateProcessor->getLifetimeDescription(),
                    $placeProcessor->getBirthPlaceShort(),
                    $placeProcessor->getDeathPlaceShort(),
                    $generation
                )
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
            ]
        );
    }

    /**
     * Appends birth and death places to the timespan lines. Only
     * applied for generations within the detailed date range where
     * the arcs are wide enough to display the extra text.
     *
     * @param string $timespan   The formatted timespan (may contain \n)
     * @param string $birthPlace The birth place
     * @param string $deathPlace The death place
     * @param int    $generation The generation depth
     *
     * @return string
     */
    private function appendPlaces(
        string $timespan,
        string $birthPlace,
        string $deathPlace,
        int $generation,
    ): string {
        if (!$this->configuration->getShowPlaces()) {
            return $timespan;
        }

        // Only append places in detailed-date generations where arcs
        // have enough width for the additional text
        if ($generation > $this->configuration->getDetailedDateGenerations()) {
            return $timespan;
        }

        if ($timespan === '') {
            return $timespan;
        }

        $lines = explode("\n", $timespan);

        if ($birthPlace !== '') {
            $lines[0] .= ', ' . $birthPlace;
        }

        if (isset($lines[1]) && ($deathPlace !== '')) {
            $lines[1] .= ', ' . $deathPlace;
        }

        return implode("\n", $lines);
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

        if (($dateLine === '') || ($place === '')) {
            return $dateLine;
        }

        return $dateLine . ', ' . $place;
    }

    /**
     * Returns the short marriage place for the individual's parents
     * (for arc text, respects placeParts setting).
     *
     * @param Individual $individual
     *
     * @return string
     */
    private function getMarriagePlaceShort(Individual $individual): string
    {
        $family = $individual->childFamilies()->first();

        if ($family === null) {
            return '';
        }

        $marriagePlace = $family->getMarriagePlace();

        if ($marriagePlace->gedcomName() === '') {
            return '';
        }

        $placeParts = $this->configuration->getPlaceParts();

        if ($placeParts === 0) {
            return $marriagePlace->gedcomName();
        }

        return $marriagePlace->firstParts($placeParts)->implode(', ');
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
