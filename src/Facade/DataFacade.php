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
use MagicSunday\Webtrees\ModuleBase\Processor\DateProcessor;
use MagicSunday\Webtrees\ModuleBase\Processor\ImageProcessor;
use MagicSunday\Webtrees\ModuleBase\Processor\NameProcessor;

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
     *
     * @var ModuleCustomInterface
     */
    private ModuleCustomInterface $module;

    /**
     * The configuration instance.
     *
     * @var Configuration
     */
    private Configuration $configuration;

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
    private function buildTreeStructure(?Individual $individual, int $generation = 1): ?Node
    {
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
        Individual $individual
    ): NodeData {
        // Create a unique ID for each individual
        static $id = 0;

        $nameProcessor  = new NameProcessor($individual);
        $dateProcessor  = new DateProcessor($individual);
        $imageProcessor = new ImageProcessor($this->module, $individual);

        $fullNN          = $nameProcessor->getFullName();
        $alternativeName = $nameProcessor->getAlternateName($individual);

        $treeData = new NodeData();
        $treeData
            ->setId(++$id)
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
            ->setThumbnail($imageProcessor->getHighlightImageUrl(100, 100, false))
            ->setSex($individual->sex())
            ->setBirth($dateProcessor->getBirthDate())
            ->setDeath($dateProcessor->getDeathDate())
            ->setMarriageDate($dateProcessor->getMarriageDate())
            ->setMarriageDateOfParents($dateProcessor->getMarriageDateOfParents())
            ->setTimespan($dateProcessor->getLifetimeDescription())
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
        return route('module', [
            'module'      => $this->module->name(),
            'action'      => 'update',
            'xref'        => $individual->xref(),
            'tree'        => $individual->tree()->name(),
            'generations' => $this->configuration->getGenerations(),
        ]);
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
