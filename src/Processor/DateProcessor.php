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
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\Individual;
use MagicSunday\Webtrees\FanChart\Model\Symbols;

/**
 * Extracts and formats birth, death, and marriage dates from an Individual for use in
 * chart arc labels and tooltips. Date granularity (full DD.MM.YYYY vs year-only) is
 * determined by the individual's generation relative to the configured detail threshold.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-module-base/
 */
class DateProcessor
{
    /**
     * * The birthdate of the individual.
     */
    private readonly Date $birthDate;

    /**
     * * The death date of the individual.
     */
    private readonly Date $deathDate;

    /**
     * @param Individual $individual
     * @param int        $generation              1-based generation depth of this individual in the tree
     * @param int        $detailedDateGenerations Generations at or below this depth show DD.MM.YYYY; others show year only
     */
    public function __construct(
        private readonly Individual $individual,
        private readonly int $generation,
        private readonly int $detailedDateGenerations,
    ) {
        $this->birthDate = $this->individual->getBirthDate();
        $this->deathDate = $this->individual->getDeathDate();
    }

    /**
     * Formats a Date as DD.MM.YYYY using its minimum date (earliest calendar date when
     * the fact spans a range).
     *
     * @param Date $date
     *
     * @return string
     */
    private function formatCompactDate(Date $date): string
    {
        $calendarDate = $date->minimumDate();

        return $calendarDate->format('%d.%m.%Y');
    }

    /**
     * Returns the date in full DD.MM.YYYY format for inner generations, or as a
     * bare year for outer generations beyond the detail threshold.
     *
     * @param Date $date
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
     * Extracts the calendar year from the minimum date of a Date range.
     * Returns 0 when the date has no year component.
     *
     * @param Date $date
     *
     * @return int
     */
    private function getYear(Date $date): int
    {
        $minimumDate = $date->minimumDate();

        return $minimumDate->year();
    }

    /**
     * Returns true when the individual has a parseable birth date.
     *
     * @return bool
     */
    public function hasBirthDate(): bool
    {
        return $this->birthDate->isOK();
    }

    /**
     * Returns true when the individual has a parseable death date.
     *
     * @return bool
     */
    public function hasDeathDate(): bool
    {
        return $this->deathDate->isOK();
    }

    /**
     * Returns true when webtrees considers the individual to be deceased,
     * even if no explicit death date is recorded.
     *
     * @return bool
     */
    public function isDead(): bool
    {
        return $this->individual->isDead();
    }

    /**
     * Returns the generation-appropriate birth date string (no symbol prefix).
     * Empty string when no valid birth date exists.
     *
     * @return string
     */
    public function getFormattedBirthDate(): string
    {
        return $this->birthDate->isOK() ? $this->getLifeEventDate($this->birthDate) : '';
    }

    /**
     * Returns the generation-appropriate death date string (no symbol prefix).
     * Empty string when no valid death date exists.
     *
     * @return string
     */
    public function getFormattedDeathDate(): string
    {
        return $this->deathDate->isOK() ? $this->getLifeEventDate($this->deathDate) : '';
    }

    /**
     * Returns the four-digit birth year, or 0 if no birth date is recorded.
     *
     * @return int
     */
    public function getBirthYear(): int
    {
        return $this->getYear($this->birthDate);
    }

    /**
     * Returns the four-digit death year, or 0 if no death date is recorded.
     *
     * @return int
     */
    public function getDeathYear(): int
    {
        return $this->getYear($this->deathDate);
    }

    /**
     * Returns the generation-appropriate birth date for arc display, or empty string if unavailable.
     *
     * @return string
     */
    public function getBirthDate(): string
    {
        return $this->getFormattedBirthDate();
    }

    /**
     * Returns the generation-appropriate death date for arc display, or empty string if unavailable.
     *
     * @return string
     */
    public function getDeathDate(): string
    {
        return $this->getFormattedDeathDate();
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
     * Returns the arc lifetime label combining birth and death with genealogical symbols.
     * Inner generations receive a two-line detailed format ("* DD.MM.YYYY\n† DD.MM.YYYY");
     * outer generations receive a compact single-line format ("1875–1932").
     *
     * @return string
     */
    public function getLifetimeDescription(): string
    {
        // Detailed generations: symbols on separate lines (* 12.09.1977 \n † 24.02.2006)
        if ($this->generation <= $this->detailedDateGenerations) {
            return $this->getDetailedLifetimeDescription();
        }

        // Outer generations: compact single-line format (1977–2006)
        return $this->getCompactLifetimeDescription();
    }

    /**
     * Returns a two-line birth/death description with symbols ("* date\n† date").
     * Shows a lone symbol when only one event is known. Returns empty string
     * when neither date is available and the individual is not deceased.
     *
     * @return string
     */
    private function getDetailedLifetimeDescription(): string
    {
        if ($this->birthDate->isOK() && $this->deathDate->isOK()) {
            $birth = $this->getLifeEventDate($this->birthDate);
            $death = $this->getLifeEventDate($this->deathDate);

            return Symbols::Birth->value . ' ' . $birth . "\n" . Symbols::Death->value . ' ' . $death;
        }

        if ($this->birthDate->isOK()) {
            return Symbols::Birth->value . ' ' . $this->getLifeEventDate($this->birthDate);
        }

        if ($this->deathDate->isOK()) {
            return Symbols::Death->value . ' ' . $this->getLifeEventDate($this->deathDate);
        }

        if ($this->individual->isDead()) {
            return Symbols::Death->value;
        }

        return '';
    }

    /**
     * Returns a compact single-line lifetime description (e.g. "1875–1932").
     *
     * @return string
     */
    public function getCompactLifetimeDescription(): string
    {
        $birthYear = $this->birthDate->isOK() ? $this->getYear($this->birthDate) : 0;
        $deathYear = $this->deathDate->isOK() ? $this->getYear($this->deathDate) : 0;

        if (($birthYear > 0) && ($deathYear > 0)) {
            return $birthYear . "\u{2013}" . $deathYear;
        }

        if ($birthYear > 0) {
            return Symbols::Birth->value . ' ' . $birthYear;
        }

        if ($deathYear > 0) {
            return Symbols::Death->value . ' ' . $deathYear;
        }

        if ($this->individual->isDead()) {
            return Symbols::Death->value;
        }

        return '';
    }

    /**
     * Returns the marriage date of the individual's own spouse family, formatted for arc display.
     * Empty string when there is no spouse family or the marriage date is unknown.
     *
     * @return string
     */
    public function getMarriageDate(): string
    {
        /**
         * @var Family|null $family
         */
        $family = $this->individual->spouseFamilies()->first();

        if ($family !== null && $family->getMarriageDate()->isOK()) {
            return $this->getMarriageEventDate($family->getMarriageDate());
        }

        return '';
    }

    /**
     * Returns the marriage date of the individual's parents for display in the arc between
     * this individual's ring and the parent ring. Returns Symbols::MARRIAGE_DATE_UNKNOWN ("?")
     * when a MARR fact exists but carries no date, so the JS can render the marriage symbol
     * without a date string. Empty string when there is no parent family at all.
     *
     * @return string
     */
    public function getMarriageDateOfParents(): string
    {
        /**
         * @var Family|null $family
         */
        $family = $this->individual->childFamilies()->first();

        if ($family !== null && $family->getMarriageDate()->isOK()) {
            return $this->getMarriageEventDate($family->getMarriageDate());
        }

        // Marriage fact exists but without a date — return a marker
        // so the JS can show the ⚭ symbol without a date, to
        // distinguish from unmarried partners (no MARR fact at all)
        if (($family !== null) && $family->facts(['MARR'])->isNotEmpty()) {
            return Symbols::MARRIAGE_DATE_UNKNOWN;
        }

        return '';
    }

    /**
     * Formats a marriage date for the arc text, accounting for the fact that the
     * marriage arc sits one generation deeper than the individual (effective depth = generation + 1).
     * Returns empty when the effective depth exceeds 8 (no space available). Uses full
     * DD.MM.YYYY up to generation 6, year-only beyond.
     *
     * @param Date $date
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
