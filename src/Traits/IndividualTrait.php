<?php

/**
 * See LICENSE.md file for further details.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Traits;

use DOMDocument;
use DOMNode;
use DOMXPath;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;

/**
 * Trait IndividualTrait.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
trait IndividualTrait
{
    /**
     * The XPath identifier to extract the first name parts.
     *
     * @var string
     */
    private string $xpathFirstNames = '//text()[following::span[@class="SURN"]][normalize-space()]';

    /**
     * The XPath identifier to extract the last name parts.
     *
     * @var string
     */
    private string $xpathLastNames
        = '//text()[parent::*[not(@class="wt-nickname")]][not(following::span[@class="SURN"])][normalize-space()]';

    /**
     * The XPath identifier to extract the nick name part.
     *
     * @var string
     */
    private string $xpathNickname = '//q[@class="wt-nickname"]';

    /**
     * The XPath identifier to extract the starred name part.
     *
     * @var string
     */
    private string $xpathPreferredName = '//span[@class="starredname"]';

    /**
     * The XPath identifier to extract the alternative name parts.
     *
     * @var string
     */
    private string $xpathAlternativeName = '//span[contains(attribute::class, "NAME")]';

    /**
     * Get the individual data required for display the chart.
     *
     * @param Individual $individual The current individual
     * @param int        $generation The generation the person belongs to
     *
     * @return mixed[]
     */
    private function getIndividualData(Individual $individual, int $generation): array
    {
        $primaryName = $individual->getAllNames()[$individual->getPrimaryName()];

        // The formatted name of the individual (containing HTML)
        $full = $primaryName['full'];

        // Get xpath
        $xpath = $this->getXPath($full);

        // The name of the person without formatting of the individual parts of the name.
        // Remove placeholders as we do not need them in this module
        $fullNN = str_replace(
            [
                Individual::NOMEN_NESCIO,
                Individual::PRAENOMEN_NESCIO,
            ],
            '',
            $primaryName['fullNN']
        );

        // Extract name parts (Do not change processing order!)
        $preferredName    = $this->getPreferredName($xpath);
        $lastNames        = $this->getLastNames($xpath);
        $firstNames       = $this->getFirstNames($xpath);
        $alternativeNames = $this->getAlternateNames($individual);

        return [
            'id'               => 0,
            'xref'             => $individual->xref(),
            'url'              => $individual->url(),
            'updateUrl'        => $this->getUpdateRoute($individual),
            'generation'       => $generation,
            'name'             => $fullNN,
            'firstNames'       => $firstNames,
            'lastNames'        => $lastNames,
            'preferredName'    => $preferredName,
            'alternativeNames' => $alternativeNames,
            'isAltRtl'         => $this->isRtl($alternativeNames),
            'thumbnail'        => $this->getIndividualImage($individual),
            'sex'              => $individual->sex(),
            'birth'            => $this->decodeValue($individual->getBirthDate()->display()),
            'death'            => $this->decodeValue($individual->getDeathDate()->display()),
            'marriage'         => $this->getMarriageDate($individual),
            'timespan'         => $this->getLifetimeDescription($individual),
            'parentMarriage'   => $this->getParentMarriageDate($individual),
            'color'            => $this->getColor($individual),
            'colors'           => [[], []],
        ];
    }

    /**
     * Returns the DOMXPath instance.
     *
     * @param string $fullName The individuals full name (containing HTML)
     *
     * @return DOMXPath
     */
    private function getXPath(string $fullName): DOMXPath
    {
        $document = new DOMDocument();
        $document->loadHTML(mb_convert_encoding($fullName, 'HTML-ENTITIES', 'UTF-8'));

        return new DOMXPath($document);
    }

    /**
     * Create the timespan label.
     *
     * @param Individual $individual The current individual
     *
     * @return string
     */
    private function getLifetimeDescription(Individual $individual): string
    {
        if ($individual->getBirthDate()->isOK() && $individual->getDeathDate()->isOK()) {
            return $this->getBirthYear($individual) . '-' . $this->getDeathYear($individual);
        }

        if ($individual->getBirthDate()->isOK()) {
            return I18N::translate('Born: %s', $this->getBirthYear($individual));
        }

        if ($individual->getDeathDate()->isOK()) {
            return I18N::translate('Died: %s', $this->getDeathYear($individual));
        }

        if ($individual->isDead()) {
            return I18N::translate('Deceased');
        }

        return '';
    }

    /**
     * Get the year of birth.
     *
     * @param Individual $individual The current individual
     *
     * @return string
     */
    private function getBirthYear(Individual $individual): string
    {
        return $this->decodeValue(
            $individual->getBirthDate()->minimumDate()->format('%Y')
        );
    }

    /**
     * Get the year of death.
     *
     * @param Individual $individual The current individual
     *
     * @return string
     */
    private function getDeathYear(Individual $individual): string
    {
        return $this->decodeValue(
            $individual->getDeathDate()->minimumDate()->format('%Y')
        );
    }

    /**
     * Removes HTML tags and converts/decodes HTML entities to their corresponding characters.
     *
     * @param string $value
     *
     * @return string
     */
    private function decodeValue(string $value): string
    {
        return html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Returns the marriage date of the individual.
     *
     * @param Individual $individual
     *
     * @return string
     */
    private function getMarriageDate(Individual $individual): string
    {
        /** @var null|Family $family */
        $family = $individual->spouseFamilies()->first();

        if ($family) {
            return $this->decodeValue($family->getMarriageDate()->display());
        }

        return '';
    }

    /**
     * Returns the marriage date of the parents.
     *
     * @param Individual $individual
     *
     * @return string
     */
    private function getParentMarriageDate(Individual $individual): string
    {
        /** @var null|Family $family */
        $family = $individual->childFamilies()->first();

        if ($family) {
            return $this->decodeValue($family->getMarriageDate()->display());
        }

        return '';
    }

    /**
     * Returns all first names from the given full name.
     *
     * @param DOMXPath $xpath The DOMXPath instance used to parse for the preferred name.
     *
     * @return string[]
     */
    public function getFirstNames(DOMXPath $xpath): array
    {
        $nodeList   = $xpath->query($this->xpathFirstNames);
        $firstNames = [];

        if ($nodeList !== false) {
            /** @var DOMNode $node */
            foreach ($nodeList as $node) {
                $firstNames[] = trim($node->nodeValue);
            }
        }

        $firstNames = explode(' ', implode(' ', $firstNames));

        return array_values(array_filter($firstNames));
    }

    /**
     * Returns all last names from the given full name.
     *
     * @param DOMXPath $xpath The DOMXPath instance used to parse for the preferred name.
     *
     * @return string[]
     */
    public function getLastNames(DOMXPath $xpath): array
    {
        $nodeList  = $xpath->query($this->xpathLastNames);
        $lastNames = [];

        if ($nodeList !== false) {
            /** @var DOMNode $node */
            foreach ($nodeList as $node) {
                $lastNames[] = trim($node->nodeValue);
            }
        }

        // Concat to full last name (as SURN may contain a prefix and a separate suffix)
        $lastNames = explode(' ', implode(' ', $lastNames));

        return array_values(array_filter($lastNames));
    }

    /**
     * Returns the preferred name from the given full name.
     *
     * @param DOMXPath $xpath The DOMXPath instance used to parse for the preferred name.
     *
     * @return string
     */
    public function getPreferredName(DOMXPath $xpath): string
    {
        $nodeList = $xpath->query($this->xpathPreferredName);

        if (($nodeList !== false) && $nodeList->length) {
            $nodeItem = $nodeList->item(0);
            return $nodeItem !== null ? $nodeItem->nodeValue : '';
        }

        return '';
    }

    /**
     * Returns the preferred name from the given full name.
     *
     * @param Individual $individual
     *
     * @return string[]
     */
    public function getAlternateNames(Individual $individual): array
    {
        $name = $individual->alternateName();

        if ($name === null) {
            return [];
        }

        $xpath    = $this->getXPath($name);
        $nodeList = $xpath->query($this->xpathAlternativeName);

        if (($nodeList !== false) && $nodeList->length) {
            $nodeItem = $nodeList->item(0);
            $name     = $nodeItem !== null ? $nodeItem->nodeValue : '';
        }

        return array_filter(explode(' ', $name));
    }

    /**
     * Returns the URL of the highlight image of an individual.
     *
     * @param Individual $individual The current individual
     *
     * @return string
     */
    private function getIndividualImage(Individual $individual): string
    {
        if (
            $individual->canShow()
            && $individual->tree()->getPreference('SHOW_HIGHLIGHT_IMAGES')
        ) {
            $mediaFile = $individual->findHighlightedMediaFile();

            if ($mediaFile !== null) {
                return $mediaFile->imageUrl(100, 100, 'contain');
            }
        }

        return '';
    }
}
