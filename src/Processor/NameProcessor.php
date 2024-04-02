<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
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

    private const XPATH_FIRST_NAMES_ALL
        = './/text()';

    private const XPATH_FIRST_NAMES_EXCEPT_PART
        = '(//q[@class="wt-nickname"]/text() | //span[@class="SURN"]/text() | //span[@class="SURN"]/following::text())';

    /**
     * The XPath identifier to extract the first name parts (including the prefix).
     *
     * As PHP does not support XPath 2.0 "except" => XPATH_FIRST_NAMES_ALL except XPATH_FIRST_NAMES_EXCEPT_PART
     */
    private const XPATH_FIRST_NAMES
        = self::XPATH_FIRST_NAMES_ALL . '[count(.|' . self::XPATH_FIRST_NAMES_EXCEPT_PART . ')!=count(' . self::XPATH_FIRST_NAMES_EXCEPT_PART . ')]';

    /**
     * The XPath identifier to extract the last name parts (surname + surname suffix).
     */
    private const XPATH_LAST_NAMES = '//span[@class="NAME"]//span[@class="SURN"]/text()|//span[@class="SURN"]/following::text()';

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
     * @param Individual|null $spouse
     * @param bool            $useMarriedName TRUE to return the married name instead of the primary one
     */
    public function __construct(
        Individual $individual,
        ?Individual $spouse = null,
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
        ?Individual $spouse = null,
        bool $useMarriedName = false
    ): array {
        $individualNames = $this->individual->getAllNames();

        if ($useMarriedName) {
            foreach ($individualNames as $individualName) {
                if ($spouse instanceof Individual) {
                    foreach ($spouse->getAllNames() as $spouseName) {
                        if ($individualName['type'] !== '_MARNM') {
                            continue;
                        }

                        if ($individualName['surn'] !== $spouseName['surn']) {
                            continue;
                        }

                        return $individualName;
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
        return mb_encode_numericentity($input, [0x80, 0xFFFFFFF, 0, 0xFFFFFFF], 'UTF-8');
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
     * Splits a name into an array, removing all name placeholders.
     *
     * @param string[] $names
     *
     * @return string[]
     */
    private function splitAndCleanName(array $names): array
    {
        $values = [[]];

        foreach ($names as $name) {
            $values[] = explode(' ', $name);
        }

        // Remove empty values and reindex array
        return array_values(
            array_filter(
                array_merge(...$values)
            )
        );
    }

    /**
     * Returns all name parts by given identifier.
     *
     * @param string $expression The XPath expression to execute
     *
     * @return string[]
     */
    private function getNamesByIdentifier(string $expression): array
    {
        $nodeList = $this->xPath->query($expression);
        $names    = [];

        if ($nodeList !== false) {
            /** @var DOMNode $node */
            foreach ($nodeList as $node) {
                $names[] = $node->nodeValue ?? '';
            }
        }

        // Remove all leading/trailing whitespace characters
        $names = array_map('trim', $names);

        return $this->splitAndCleanName($names);
    }

    /**
     * Returns all assigned first names of the individual.
     *
     * @return string[]
     */
    public function getFirstNames(): array
    {
        return $this->getNamesByIdentifier(self::XPATH_FIRST_NAMES);
    }

    /**
     * Returns all assigned last names of the individual.
     *
     * @return string[]
     */
    public function getLastNames(): array
    {
        return $this->getNamesByIdentifier(self::XPATH_LAST_NAMES);
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
            $allNames = $individual->getAllNames();
            $alternativeName = $allNames[$individual->getSecondaryName()][self::FULL_NAME_WITH_PLACEHOLDERS];

            return $this->replacePlaceholders($alternativeName);
        }

        return '';
    }
}
