<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Tests\Processor;

use Fisharebest\Localization\PluralRule\PluralRule1;
use Fisharebest\Localization\Translator;
use Fisharebest\Webtrees\Date;
use Fisharebest\Webtrees\Date\AbstractCalendarDate;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use MagicSunday\Webtrees\FanChart\Processor\DateProcessor;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;

#[CoversClass(DateProcessor::class)]
/**
 * Unit tests for the date processor used by the fan chart.
 */
class DateProcessorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $translator         = new Translator([], new PluralRule1());
        $translatorProperty = new ReflectionProperty(I18N::class, 'translator');
        $translatorProperty->setAccessible(true);
        $translatorProperty->setValue(null, $translator);
    }

    #[Test]
    public function itUsesFullDatesWithinConfiguredGenerations(): void
    {
        $processor = new DateProcessor(
            $this->createIndividual(
                $this->createDate('1 Jan 1980', true, 1980),
                $this->createDate('2 Feb 2020', true, 2020)
            ),
            2,
            3
        );

        self::assertSame('1 Jan 1980-2 Feb 2020', $processor->getLifetimeDescription());
    }

    #[Test]
    public function itFallsBackToYearsBeyondDetailedGenerations(): void
    {
        $processor = new DateProcessor(
            $this->createIndividual(
                $this->createDate('1 Jan 1980', true, 1980),
                $this->createDate('2 Feb 2020', true, 2020)
            ),
            5,
            2
        );

        self::assertSame('1980-2020', $processor->getLifetimeDescription());
    }

    #[Test]
    public function itFormatsSingleBirthDate(): void
    {
        $processor = new DateProcessor(
            $this->createIndividual(
                $this->createDate('1 Jan 1980', true, 1980),
                $this->createDate('', false, 0),
                false
            ),
            1,
            4
        );

        self::assertSame('Born: 1 Jan 1980', $processor->getLifetimeDescription());
    }

    #[Test]
    public function itMarksDeceasedWithoutDates(): void
    {
        $processor = new DateProcessor(
            $this->createIndividual(
                $this->createDate('', false, 0),
                $this->createDate('', false, 0),
                true
            ),
            1,
            4
        );

        self::assertSame('Deceased', $processor->getLifetimeDescription());
    }

    /**
     * Creates a mock date instance with the given values.
     *
     * @param string $display The formatted date string
     * @param bool   $isOk    Whether the date is considered valid
     * @param int    $year    The calendar year to return
     *
     * @return Date
     */
    private function createDate(string $display, bool $isOk, int $year): Date
    {
        $calendarDate = $this->createMock(AbstractCalendarDate::class);
        $calendarDate->method('year')->willReturn($year);

        $date = $this->createMock(Date::class);
        $date->method('display')->willReturn($display);
        $date->method('minimumDate')->willReturn($calendarDate);
        $date->method('isOK')->willReturn($isOk);

        return $date;
    }

    /**
     * Creates a mock individual with the provided dates and life status.
     *
     * @param Date $birthDate The mocked birth date
     * @param Date $deathDate The mocked death date
     * @param bool $isDead    Whether the individual is considered deceased
     *
     * @return Individual
     */
    private function createIndividual(Date $birthDate, Date $deathDate, bool $isDead = false): Individual
    {
        $individual = $this->createMock(Individual::class);
        $individual->method('getBirthDate')->willReturn($birthDate);
        $individual->method('getDeathDate')->willReturn($deathDate);
        $individual->method('isDead')->willReturn($isDead);

        return $individual;
    }
}
