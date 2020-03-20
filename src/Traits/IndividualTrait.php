<?php

/**
 * See LICENSE.md file for further details.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Traits;

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
     * Get the individual data required for display the chart.
     *
     * @param Individual $individual The current individual
     * @param int        $generation The generation the person belongs to
     *
     * @return string[][]
     */
    private function getIndividualData(Individual $individual, int $generation): array
    {
        $allNames = $individual->getAllNames()[$individual->getPrimaryName()];

        // The formatted name of the individual (containing HTML)
        $full = $allNames['full'];

        // The name of the person without formatting of the individual parts of the name.
        // Remove placeholders as we do not need them in this module
        $fullNN = str_replace(['@N.N.', '@P.N.'], '', $allNames['fullNN']);

        // Extract name parts
        $preferredName   = $this->getPreferredName($full);
        $nickName        = $this->getNickname($full);
        $lastNames       = $this->getLastNames($full);
        $firstNames      = $this->getFirstNames($full, $lastNames, $nickName);
        $alternativeName = $this->unescapedHtml($individual->alternateName());

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
            'alternativeNames' => array_filter(explode(' ', $alternativeName)),
            'isAltRtl'         => $this->isRtl($alternativeName),
            'sex'              => $individual->sex(),
            'timespan'         => $this->getLifetimeDescription($individual),
            'color'            => $this->getColor($individual),
            'colors'           => [[], []],
        ];
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
            return $individual->getBirthYear() . '-' . $individual->getDeathYear();
        }

        if ($individual->getBirthDate()->isOK()) {
            return I18N::translate('Born: %s', $individual->getBirthYear());
        }

        if ($individual->getDeathDate()->isOK()) {
            return I18N::translate('Died: %s', $individual->getDeathYear());
        }

        return I18N::translate('Deceased');
    }

    /**
     * Returns all first names from the given full name.
     *
     * @param string   $fullName  The formatted name of the individual (containing HTML)
     * @param string[] $lastNames The list of last names of the individual
     * @param string   $nickname  The nickname of the individual if any
     *
     * @return string[]
     */
    public function getFirstNames(string $fullName, array $lastNames, string $nickname): array
    {
        // Remove all HTML from the formatted full name
        $fullName = $this->unescapedHtml($fullName);

        // Extract the leftover first names of the individual (removing last names and nickname)
        $firstNames = array_filter(explode(' ', $fullName));

        return array_values(array_diff($firstNames, $lastNames, [ $nickname ]));
    }

    /**
     * Returns all last names from the given full name.
     *
     * @param string $fullName The formatted name of the individual (containing HTML)
     *
     * @return string[]
     */
    public function getLastNames(string $fullName): array
    {
        // Extract all last names
        $matches = [];
        preg_match_all('/<span class="SURN">(.*?)<\/span>/i', $fullName, $matches);

        return array_values(array_filter($matches[1])) ?? [];
    }

    /**
     * Returns the preferred name from the given full name.
     *
     * @param string $fullName The formatted name of the individual (containing HTML)
     *
     * @return string
     */
    public function getPreferredName(string $fullName): string
    {
        $matches = [];
        preg_match('/<span class="starredname">(.*?)<\/span>/i', $fullName, $matches);

        return $matches[1] ?? '';
    }

    /**
     * Returns the nickname from the given full name.
     *
     * @param string $fullName The formatted name of the individual (containing HTML)
     *
     * @return string
     */
    public function getNickname(string $fullName): string
    {
        $matches = [];
        preg_match('/<q class="wt-nickname">(.*?)<\/q>/i', $fullName, $matches);

        return $matches[1] ?? '';
    }
}
