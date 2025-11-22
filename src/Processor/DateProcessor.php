<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Processor;

use Fisharebest\Webtrees\Date;
use Fisharebest\Webtrees\Date\AbstractCalendarDate;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;

/**
 * Class DateProcessor.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-module-base/
 */
class DateProcessor
{
    /**
     * The individual.
     *
     * @var Individual
     */
    private Individual $individual;

    /**
     * The birthdate of the individual.
     *
     * @var Date
     */
    private Date $birthDate;

    /**
     * The death date of the individual.
     *
     * @var Date
     */
    private Date $deathDate;

    /**
     * The generation the individual belongs to.
     */
    private int $generation;

    /**
     * The number of generations using detailed birth and death dates.
     */
    private int $detailedDateGenerations;

    /**
     * Constructor.
     *
     * @param Individual $individual The individual to process
     */
    public function __construct(Individual $individual, int $generation, int $detailedDateGenerations)
    {
        $this->individual              = $individual;
        $this->birthDate               = $this->individual->getBirthDate();
        $this->deathDate               = $this->individual->getDeathDate();
        $this->generation              = $generation;
        $this->detailedDateGenerations = $detailedDateGenerations;
    }

    /**
     * Removes HTML tags and converts/decodes HTML entities to their corresponding characters.
     *
     * @param string $value The value to decode
     *
     * @return string
     */
    private function decodeValue(string $value): string
    {
        return html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Formats the given date.
     *
     * @param Date $date The date to format
     *
     * @return string
     */
    private function formatDate(Date $date): string
    {
        return $this->decodeValue($date->display());
    }

    /**
     * Returns a formatted life event date, using detailed output for configured generations.
     *
     * @param Date $date The life event date
     *
     * @return string
     */
    private function getLifeEventDate(Date $date): string
    {
        if ($this->generation <= $this->detailedDateGenerations) {
            return $this->formatDate($date);
        }

        return (string) $this->getYear($date);
    }

    /**
     * Returns the calendar year of the given date.
     *
     * @param Date $date The date to extract the year from
     *
     * @return int
     */
    private function getYear(Date $date): int
    {
        /** @var AbstractCalendarDate $minimumDate */
        $minimumDate = $date->minimumDate();

        return $minimumDate->year();
    }

    /**
     * Get the year of birth.
     *
     * @return int
     */
    public function getBirthYear(): int
    {
        return $this->getYear($this->birthDate);
    }

    /**
     * Get the year of death.
     *
     * @return int
     */
    public function getDeathYear(): int
    {
        return $this->getYear($this->deathDate);
    }

    /**
     * Returns the formatted birthdate without HTML tags.
     *
     * @return string
     */
    public function getBirthDate(): string
    {
        return $this->formatDate($this->birthDate);
    }

    /**
     * Returns the formatted death date without HTML tags.
     *
     * @return string
     */
    public function getDeathDate(): string
    {
        return $this->formatDate($this->deathDate);
    }

    /**
     * Create the timespan label.
     *
     * @return string
     */
    public function getLifetimeDescription(): string
    {
        if ($this->birthDate->isOK() && $this->deathDate->isOK()) {
            return $this->getLifeEventDate($this->birthDate) . '-' . $this->getLifeEventDate($this->deathDate);
        }

        if ($this->birthDate->isOK()) {
            return I18N::translate('Born: %s', $this->getLifeEventDate($this->birthDate));
        }

        if ($this->deathDate->isOK()) {
            return I18N::translate('Died: %s', $this->getLifeEventDate($this->deathDate));
        }

        if ($this->individual->isDead()) {
            return I18N::translate('Deceased');
        }

        return '';
    }

    /**
     * Returns the marriage date of the individual.
     *
     * @return string
     */
    public function getMarriageDate(): string
    {
        /** @var Family|null $family */
        $family = $this->individual->spouseFamilies()->first();

        if ($family !== null) {
            return $this->decodeValue(
                $family->getMarriageDate()->display()
            );
        }

        return '';
    }

    /**
     * Returns the marriage date of the parents.
     *
     * @return string
     */
    public function getMarriageDateOfParents(): string
    {
        /** @var Family|null $family */
        $family = $this->individual->childFamilies()->first();

        if ($family !== null) {
            return $this->decodeValue(
                $family->getMarriageDate()->display()
            );
        }

        return '';
    }
}
