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
use DOMNode;
use DOMXPath;
use Fisharebest\Webtrees\Individual;

/**
 * Parses an individual's primary (or married) name from its HTML representation
 * using DOMXPath, and exposes structured name parts — full name, first names,
 * last names, preferred (starred) name, and alternative name — for use in
 * chart arc labels and tooltips.
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
    private const string FULL_NAME_WITH_PLACEHOLDERS = 'fullNN';

    /**
     * The full name identifier.
     */
    private const string FULL_NAME = 'full';

    /**
     * The XPath identifier to extract the first name parts (including the prefix).
     */
    private const string XPATH_FIRST_NAMES
        = '//text()[not(ancestor::q[@class="wt-nickname"]) and not(preceding::span[@class="SURN"] or ancestor::span[@class="SURN"])]';

    /**
     * The XPath identifier to extract the last name parts (surname + surname suffix).
     */
    private const string XPATH_LAST_NAMES = '//span[@class="NAME"]//span[@class="SURN"]/text()|//span[@class="SURN"]/following::text()';

    /**
     * The XPath identifier to extract the starred name part.
     */
    private const string XPATH_PREFERRED_NAME = '//span[@class="NAME"]//span[@class="starredname"]/text()';

    /**
     * The individual's primary name array.
     *
     * @var string[]
     */
    private array $primaryName;

    /**
     * The DOM xpath processor.
     */
    private readonly DOMXPath $xPath;

    /**
     * @param Individual      $individual
     * @param Individual|null $spouse         When provided, the married name matching this spouse's surname is preferred
     * @param bool            $useMarriedName When true, selects a _MARNM record instead of the primary name
     */
    public function __construct(
        private readonly Individual $individual,
        ?Individual $spouse = null,
        bool $useMarriedName = false,
    ) {
        $this->primaryName = $this->extractPrimaryName($spouse, $useMarriedName);

        // The formatted name of the individual (containing HTML) is the input to the xpath processor
        $this->xPath = $this->getDomXPathInstance($this->primaryName[self::FULL_NAME]);
    }

    /**
     * Parses the HTML name string into a DOMDocument and returns a DOMXPath
     * instance for subsequent name-part extraction queries.
     *
     * @param string $input HTML-formatted name string from webtrees
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
     * Selects the appropriate name record from getAllNames(). When $useMarriedName is true,
     * iterates to find a _MARNM record whose surname matches the spouse's; falls back to the
     * primary name when no matching married name is found.
     *
     * @param Individual|null $spouse
     * @param bool            $useMarriedName
     *
     * @return array<string, string>
     */
    private function extractPrimaryName(
        ?Individual $spouse = null,
        bool $useMarriedName = false,
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
     * Converts non-ASCII UTF-8 characters to numeric HTML entities so that
     * DOMDocument::loadHTML() can parse them without a charset declaration.
     *
     * @param string $input
     *
     * @return string
     */
    private function convertToHtmlEntities(string $input): string
    {
        return mb_encode_numericentity($input, [0x80, 0xFFFFFFF, 0, 0xFFFFFFF], 'UTF-8');
    }

    /**
     * Replaces NOMEN_NESCIO and PRAENOMEN_NESCIO placeholders with "…" and trims whitespace.
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
     * Returns the full plain-text name with all webtrees placeholders replaced by "…".
     * HTML formatting of name parts is intentionally stripped.
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
     * Splits each name string on spaces, flattens the results, and removes empty tokens.
     * Returns a re-indexed array of individual name tokens.
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
                array_merge(...$values),
                static fn (string $value): bool => $value !== ''
            )
        );
    }

    /**
     * Executes an XPath query against the name DOM and returns the trimmed text
     * nodes as a flat, cleaned token array.
     *
     * @param string $expression XPath expression targeting text nodes within the name HTML
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
        $names = array_map(trim(...), $names);

        return $this->splitAndCleanName($names);
    }

    /**
     * Returns all given name tokens (excluding surname and nickname parts), split into
     * individual words and ready for line-break layout in the chart arc.
     *
     * @return string[]
     */
    public function getFirstNames(): array
    {
        return $this->getNamesByIdentifier(self::XPATH_FIRST_NAMES);
    }

    /**
     * Returns all surname tokens (SURN element and any following text), split into
     * individual words for arc layout.
     *
     * @return string[]
     */
    public function getLastNames(): array
    {
        return $this->getNamesByIdentifier(self::XPATH_LAST_NAMES);
    }

    /**
     * Returns the starred (preferred) name part used to visually emphasise one given name
     * in the arc. Empty string when no name part is marked as preferred.
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
     * Returns the secondary (alternative) name when it differs from the primary name and
     * the individual's name is visible under current privacy settings. Typically used to
     * show a romanisation or transliteration alongside the primary script name.
     * Returns empty string when the primary and secondary names are the same.
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
