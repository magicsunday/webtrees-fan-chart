<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Processor;

use DOMDocument;
use DOMXPath;
use Fisharebest\Webtrees\Individual;

/**
 * Class NameProcessor.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-module-base/
 */
class NameProcessor
{
    /**
     * The full name identifier with name placeholders.
     */
    private const FULL_NAME_WITH_PLACEHOLDERS = 'fullNN';

    /**
     * The full name identifier.
     */
    private const FULL_NAME = 'full';

    /**
     * The XPath identifier to extract the starred name part.
     */
    private const XPATH_PREFERRED_NAME = '//span[@class="NAME"]//span[@class="starredname"]/text()';

    /**
     * The individual.
     *
     * @var Individual
     */
    private Individual $individual;

    /**
     * The individual's primary name array.
     *
     * @var string[]
     */
    private array $primaryName;

    /**
     * The DOM xpath processor.
     *
     * @var DOMXPath
     */
    private DOMXPath $xPath;

    /**
     * Constructor.
     *
     * @param Individual      $individual     The individual to process
     * @param null|Individual $spouse
     * @param bool            $useMarriedName TRUE to return the married name instead of the primary one
     */
    public function __construct(
        Individual $individual,
        Individual $spouse = null,
        bool $useMarriedName = false
    ) {
        $this->individual  = $individual;
        $this->primaryName = $this->extractPrimaryName($spouse, $useMarriedName);

        // The formatted name of the individual (containing HTML) is the input to the xpath processor
        $this->xPath = $this->getDomXPathInstance($this->primaryName[self::FULL_NAME]);
    }

    /**
     * Returns the DOMXPath instance.
     *
     * @param string $input The input used as xpath base
     *
     * @return DOMXPath
     */
    private function getDomXPathInstance(string $input): DOMXPath
    {
        $document = new DOMDocument();
        $document->loadHTML($this->convertToHtmlEntities($input));

        return new DOMXPath($document);
    }

    /**
     * Extracts the primary name from the individual.
     *
     * @param null|Individual $spouse
     * @param bool            $useMarriedName TRUE to return the married name instead of the primary one
     *
     * @return array<string, string>
     */
    private function extractPrimaryName(
        Individual $spouse = null,
        bool $useMarriedName = false
    ): array {
        $individualNames = $this->individual->getAllNames();

        if ($useMarriedName !== false) {
            foreach ($individualNames as $individualName) {
                if ($spouse !== null) {
                    foreach ($spouse->getAllNames() as $spouseName) {
                        if (
                            ($individualName['type'] === '_MARNM')
                            && ($individualName['surn'] === $spouseName['surn'])
                        ) {
                            return $individualName;
                        }
                    }
                } elseif ($individualName['type'] === '_MARNM') {
                    return $individualName;
                }
            }
        }

        return $individualNames[$this->individual->getPrimaryName()];
    }

    /**
     * Returns the UTF-8 chars converted to HTML entities.
     *
     * @param string $input The input to encode
     *
     * @return string
     */
    private function convertToHtmlEntities(string $input): string
    {
        return mb_encode_numericentity($input, [0x80, 0xfffffff, 0, 0xfffffff], 'UTF-8');
    }

    /**
     * Replace name placeholders.
     *
     * @param string $value
     *
     * @return string
     */
    private function replacePlaceholders(string $value): string
    {
        return trim(
            str_replace(
                [
                    Individual::NOMEN_NESCIO,
                    Individual::PRAENOMEN_NESCIO,
                ],
                '…',
                $value
            )
        );
    }

    /**
     * Splits a name into an array, removing all name placeholders.
     *
     * @param string $name
     *
     * @return string[]
     */
    private function splitAndCleanName(string $name): array
    {
        return array_values(
            array_filter(
                explode(
                    ' ',
                    $this->replacePlaceholders($name)
                )
            )
        );
    }

    /**
     * Returns the full name of the individual without formatting of the individual parts of the name.
     * All placeholders were removed as we do not need them in this module.
     *
     * @return string
     */
    public function getFullName(): string
    {
        // The name of the person without formatting of the individual parts of the name.
        // Remove placeholders as we do not need them in this module
        return $this->replacePlaceholders($this->primaryName[self::FULL_NAME_WITH_PLACEHOLDERS]);
    }

    /**
     * Returns all assigned first names of the individual.
     *
     * @return string[]
     */
    public function getFirstNames(): array
    {
        return $this->splitAndCleanName($this->primaryName['givn']);
    }

    /**
     * Returns all assigned last names of the individual.
     *
     * @return string[]
     */
    public function getLastNames(): array
    {
        return $this->splitAndCleanName($this->primaryName['surn']);
    }

    /**
     * Returns the preferred name of the individual.
     *
     * @return string
     */
    public function getPreferredName(): string
    {
        $nodeList = $this->xPath->query(self::XPATH_PREFERRED_NAME);

        if (($nodeList !== false) && ($nodeList->length > 0)) {
            $nodeItem = $nodeList->item(0);

            return ($nodeItem !== null) ? ($nodeItem->nodeValue ?? '') : '';
        }

        return '';
    }

    /**
     * Returns the alternative name of the individual.
     *
     * @param Individual $individual
     *
     * @return string
     */
    public function getAlternateName(Individual $individual): string
    {
        if (
            $individual->canShowName()
            && ($individual->getPrimaryName() !== $individual->getSecondaryName())
        ) {
            $allNames        = $individual->getAllNames();
            $alternativeName = $allNames[$individual->getSecondaryName()][self::FULL_NAME_WITH_PLACEHOLDERS];

            return $this->replacePlaceholders($alternativeName);
        }

        return '';
    }
}
