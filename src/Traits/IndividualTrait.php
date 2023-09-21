<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Traits;

use DOMDocument;
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
     * The XPath identifier to extract the starred name part.
     *
     * @var string
     */
    private string $xpathPreferredName = '//span[@class="NAME"]//span[@class="starredname"]/text()';

    /**
     * Returns the primary name used in the chart.
     *
     * @param Individual      $individual     The current individual
     * @param null|Individual $spouse
     * @param bool            $useMarriedName TRUE to return the married name instead of the primary one
     *
     * @return array<string, string>
     */
    private function getPrimaryName(
        Individual $individual,
        Individual $spouse = null,
        bool $useMarriedName = false
    ): array {
        $individualNames = $individual->getAllNames();

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

        return $individualNames[$individual->getPrimaryName()];
    }

    /**
     * Get the individual data required for display the chart.
     *
     * @param Individual      $individual The current individual
     * @param int             $generation The generation the person belongs to
     * @param null|Individual $spouse     The current spouse of the individual
     *
     * @return array<string, array<string>|bool|int|string|Individual>
     */
    private function getIndividualData(Individual $individual, int $generation, Individual $spouse = null): array
    {
        $primaryName = $individual->getAllNames()[$individual->getPrimaryName()];

        // The formatted name of the individual (containing HTML)
        $full = $primaryName['full'];

        // Get xpath
        $xpath = $this->getXPath($full);

        // The name of the person without formatting of the individual parts of the name.
        // Remove placeholders as we do not need them in this module
        $fullNN = $this->replacePlaceholders($primaryName['fullNN']);

        // Extract name parts (Do not change processing order!)
        $preferredName   = $this->getPreferredName($xpath);
        $lastNames       = $this->splitAndCleanName($primaryName['surn']);
        $firstNames      = $this->splitAndCleanName($primaryName['givn']);
        $alternativeName = $this->getAlternateName($individual);

        // Create a unique ID for each individual
        static $id = 0;

        return [
            'id'              => ++$id,
            'xref'            => $individual->xref(),
            'url'             => $individual->url(),
            'updateUrl'       => $this->getUpdateRoute($individual),
            'generation'      => $generation,
            'name'            => $fullNN,
            'isNameRtl'       => $this->isRtl($fullNN),
            'firstNames'      => $firstNames,
            'lastNames'       => $lastNames,
            'preferredName'   => $preferredName,
            'alternativeName' => $alternativeName,
            'isAltRtl'        => $this->isRtl($alternativeName),
            'thumbnail'       => $this->getIndividualImage($individual),
            'sex'             => $individual->sex(),
            'birth'           => $this->decodeValue($individual->getBirthDate()->display()),
            'death'           => $this->decodeValue($individual->getDeathDate()->display()),
            'timespan'        => $this->getLifetimeDescription($individual),
            'marriage'        => $this->getMarriageDate($individual),
            'parentMarriage'  => $this->getParentMarriageDate($individual),
            'individual'      => $individual,
        ];
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
     * Returns the DOMXPath instance.
     *
     * @param string $fullName The individuals full name (containing HTML)
     *
     * @return DOMXPath
     */
    private function getXPath(string $fullName): DOMXPath
    {
        $document = new DOMDocument();
        $document->loadHTML($this->convertToHtmlEntities($fullName));

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
    public function splitAndCleanName(string $name): array
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
     * Returns the preferred name from the given full name.
     *
     * @param DOMXPath $xpath The DOMXPath instance used to parse for the preferred name.
     *
     * @return string
     */
    public function getPreferredName(DOMXPath $xpath): string
    {
        $nodeList = $xpath->query($this->xpathPreferredName);

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
        if ($individual->canShowName()
            && ($individual->getPrimaryName() !== $individual->getSecondaryName())
        ) {
            $allNames        = $individual->getAllNames();
            $alternativeName = $allNames[$individual->getSecondaryName()]['fullNN'];

            return $this->replacePlaceholders($alternativeName);
        }

        return '';
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
            && ($individual->tree()->getPreference('SHOW_HIGHLIGHT_IMAGES') !== '')
        ) {
            $mediaFile = $individual->findHighlightedMediaFile();

            if ($mediaFile !== null) {
                return $mediaFile->imageUrl(100, 100, 'contain');
            }
        }

        return '';
    }
}
