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
     * Formats the given date in a compact way (DD.MM.YYYY).
     *
     * @param Date $date The date to format
     *
     * @return string
     */
    private function formatCompactDate(Date $date): string
    {
        $calendarDate = $date->minimumDate();

        return $calendarDate->format('%d.%m.%Y');
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
            return $this->formatCompactDate($date);
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
        return $this->getLifeEventDate($this->birthDate);
    }

    /**
     * Returns the formatted death date without HTML tags.
     *
     * @return string
     */
    public function getDeathDate(): string
    {
        return $this->getLifeEventDate($this->deathDate);
    }

    /**
     * Returns the full compact birth date (DD.MM.YYYY), regardless of
     * the generation detail setting. Used for tooltip display.
     *
     * @return string
     */
    public function getBirthDateFull(): string
    {
        if ($this->birthDate->isOK()) {
            return $this->formatCompactDate($this->birthDate);
        }

        return '';
    }

    /**
     * Returns the full compact death date (DD.MM.YYYY), regardless of
     * the generation detail setting. Used for tooltip display.
     *
     * @return string
     */
    public function getDeathDateFull(): string
    {
        if ($this->deathDate->isOK()) {
            return $this->formatCompactDate($this->deathDate);
        }

        return '';
    }

    /**
     * Returns the full compact marriage date (DD.MM.YYYY), regardless
     * of the generation detail setting. Used for tooltip display.
     *
     * @return string
     */
    public function getMarriageDateFull(): string
    {
        $family = $this->individual->spouseFamilies()->first();

        if (($family !== null) && $family->getMarriageDate()->isOK()) {
            return $this->formatCompactDate($family->getMarriageDate());
        }

        return '';
    }

    /**
     * Create the timespan label.
     *
     * Uses genealogical symbols (* for birth, † for death) and compact date format
     * for detailed generations. Dates are placed on separate lines when detailed
     * format is active.
     *
     * @return string
     */
    public function getLifetimeDescription(): string
    {
        if ($this->birthDate->isOK() && $this->deathDate->isOK()) {
            $birth = $this->getLifeEventDate($this->birthDate);
            $death = $this->getLifeEventDate($this->deathDate);

            return '* ' . $birth . "\n" . '† ' . $death;
        }

        if ($this->birthDate->isOK()) {
            return '* ' . $this->getLifeEventDate($this->birthDate);
        }

        if ($this->deathDate->isOK()) {
            return '† ' . $this->getLifeEventDate($this->deathDate);
        }

        if ($this->individual->isDead()) {
            return '†';
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

        if ($family !== null && $family->getMarriageDate()->isOK()) {
            return $this->getMarriageEventDate($family->getMarriageDate());
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

        if ($family !== null && $family->getMarriageDate()->isOK()) {
            return $this->getMarriageEventDate($family->getMarriageDate());
        }

        // Marriage fact exists but without a date — return a marker
        // so the JS can show the ⚭ symbol without a date, to
        // distinguish from unmarried partners (no MARR fact at all)
        if (($family !== null) && $family->facts(['MARR'])->isNotEmpty()) {
            return '?';
        }

        return '';
    }

    /**
     * Returns a formatted marriage date. Marriage arcs sit between the
     * child (at this generation) and the parents (generation + 1), so
     * the effective depth is one level deeper than the individual.
     *
     * @param Date $date The marriage date
     *
     * @return string
     */
    private function getMarriageEventDate(Date $date): string
    {
        // Marriage arcs sit one level deeper than the individual.
        $effectiveDepth = $this->generation + 1;

        // No space at all beyond generation 8
        if ($effectiveDepth > 8) {
            return '';
        }

        // Compact date up to generation 6, year only beyond
        if ($effectiveDepth <= min($this->detailedDateGenerations, 6)) {
            return $this->formatCompactDate($date);
        }

        return (string) $this->getYear($date);
    }
}
