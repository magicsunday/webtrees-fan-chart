<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Processor;

use Fisharebest\Webtrees\Date;
use Fisharebest\Webtrees\Date\AbstractCalendarDate;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\Individual;
use Illuminate\Support\Collection;
use MagicSunday\Webtrees\FanChart\Processor\DateProcessor;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(DateProcessor::class)]
final class DateProcessorTest extends TestCase
{
    public function testLifetimeDescriptionPrefersBothBirthAndDeathYears(): void
    {
        $individual = $this->createConfiguredIndividual();
        $processor  = new DateProcessor($individual);

        self::assertSame('1900-1950', $processor->getLifetimeDescription());
    }

    public function testMarriageDatesDecodeHtml(): void
    {
        $individual = $this->createConfiguredIndividual();
        $processor  = new DateProcessor($individual);

        self::assertSame('1 JAN 1930', $processor->getMarriageDate());
        self::assertSame('1 JAN 1880', $processor->getMarriageDateOfParents());
    }

    private function createConfiguredIndividual(
        bool $isDead = true,
        bool $withBirth = true,
        bool $withDeath = true,
    ): Individual {
        $birthDate = $this->createDate(1900, '<span>1 JAN 1900</span>', $withBirth);
        $deathDate = $this->createDate(1950, '<span>31 DEC 1950</span>', $withDeath);

        $marriageDate   = $this->createDate(1930, '<span>1 JAN 1930</span>', true);
        $parentMarriage = $this->createDate(1880, '<span>1 JAN 1880</span>', true);
        $spouseFamily   = $this->createConfiguredFamily($marriageDate);
        $parentFamily   = $this->createConfiguredFamily($parentMarriage);

        $individual = $this->createMock(Individual::class);
        $individual->method('getBirthDate')->willReturn($birthDate);
        $individual->method('getDeathDate')->willReturn($deathDate);
        $individual->method('isDead')->willReturn($isDead);
        $individual->method('spouseFamilies')->willReturn($this->createCollection($spouseFamily));
        $individual->method('childFamilies')->willReturn($this->createCollection($parentFamily));

        return $individual;
    }

    private function createDate(int $year, string $display, bool $ok): Date
    {
        $minimumDate = $this->createMock(AbstractCalendarDate::class);
        $minimumDate->method('year')->willReturn($year);

        $date = $this->createMock(Date::class);
        $date->method('minimumDate')->willReturn($minimumDate);
        $date->method('display')->willReturn($display);
        $date->method('isOK')->willReturn($ok);

        return $date;
    }

    /**
     * @return Collection<int, Family>
     */
    private function createCollection(?Family $family): Collection
    {
        return new Collection($family instanceof Family ? [$family] : []);
    }

    private function createConfiguredFamily(Date $marriageDate): Family
    {
        $family = $this->createMock(Family::class);
        $family->method('getMarriageDate')->willReturn($marriageDate);

        return $family;
    }
}
