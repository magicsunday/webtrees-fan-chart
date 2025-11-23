<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Processor;

use Fisharebest\Webtrees\Individual;
use MagicSunday\Webtrees\FanChart\Processor\NameProcessor;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(NameProcessor::class)]
final class NameProcessorTest extends TestCase
{
    public function testNameExtractionProvidesFirstLastAndPreferredParts(): void
    {
        $names = [
            [
                'type'                    => 'NAME',
                'fullNN'                  => 'John <span class="NAME"><span class="SURN">Doe</span></span>',
                'full'                    => 'John <span class="NAME"><span class="SURN">Doe</span></span>',
                'sort'                    => 'Doe, John',
                'list'                    => 'John Doe',
                'surname'                 => 'Doe',
                'addname'                 => '',
                'prefix'                  => '',
                'surn'                    => 'Doe',
                'givn'                    => 'John',
                'initials'                => 'J D',
                'spfx'                    => '',
                'nsfx'                    => '',
                'nickname'                => '',
                'display_as'              => 'default',
                'type_label'              => 'Name',
                'surname_prefix'          => '',
                'show'                    => true,
                'script'                  => 'Latn',
                'parts'                   => [],
                'prim'                    => 'Y',
                'type_id'                 => 0,
                'fullNNalternativeRender' => 'John <span class="SURN">Doe</span>',
            ],
        ];

        $individual = $this->createMock(Individual::class);
        $individual->method('getAllNames')->willReturn($names);
        $individual->method('getPrimaryName')->willReturn(0);
        $individual->method('getSecondaryName')->willReturn(0);
        $individual->method('canShowName')->willReturn(true);

        $processor = new NameProcessor($individual);

        self::assertSame('John <span class="NAME"><span class="SURN">Doe</span></span>', $processor->getFullName());
        self::assertSame(['John'], $processor->getFirstNames());
        self::assertSame(['Doe'], $processor->getLastNames());
        self::assertSame('', $processor->getPreferredName());
        self::assertSame('', $processor->getAlternateName($individual));
    }

    public function testAlternateNameReturnsSecondaryNameWhenDifferent(): void
    {
        $names = [
            [
                'type'                    => 'NAME',
                'fullNN'                  => 'John <span class="NAME"><span class="SURN">Doe</span></span>',
                'full'                    => 'John <span class="NAME"><span class="SURN">Doe</span></span>',
                'sort'                    => 'Doe, John',
                'list'                    => 'John Doe',
                'surname'                 => 'Doe',
                'addname'                 => '',
                'prefix'                  => '',
                'surn'                    => 'Doe',
                'givn'                    => 'John',
                'initials'                => 'J D',
                'spfx'                    => '',
                'nsfx'                    => '',
                'nickname'                => '',
                'display_as'              => 'default',
                'type_label'              => 'Name',
                'surname_prefix'          => '',
                'show'                    => true,
                'script'                  => 'Latn',
                'parts'                   => [],
                'prim'                    => 'Y',
                'type_id'                 => 0,
                'fullNNalternativeRender' => 'John <span class="SURN">Doe</span>',
            ],
            [
                'type'                    => 'NAME',
                'fullNN'                  => 'Johnny <span class="NAME"><span class="SURN">Doe</span></span>',
                'full'                    => 'Johnny <span class="NAME"><span class="SURN">Doe</span></span>',
                'sort'                    => 'Doe, Johnny',
                'list'                    => 'Johnny Doe',
                'surname'                 => 'Doe',
                'addname'                 => '',
                'prefix'                  => '',
                'surn'                    => 'Doe',
                'givn'                    => 'Johnny',
                'initials'                => 'J D',
                'spfx'                    => '',
                'nsfx'                    => '',
                'nickname'                => '',
                'display_as'              => 'default',
                'type_label'              => 'Name',
                'surname_prefix'          => '',
                'show'                    => true,
                'script'                  => 'Latn',
                'parts'                   => [],
                'prim'                    => 'N',
                'type_id'                 => 0,
                'fullNNalternativeRender' => 'Johnny <span class="SURN">Doe</span>',
            ],
        ];

        $individual = $this->createMock(Individual::class);
        $individual->method('getAllNames')->willReturn($names);
        $individual->method('getPrimaryName')->willReturn(0);
        $individual->method('getSecondaryName')->willReturn(1);
        $individual->method('canShowName')->willReturn(true);

        $processor = new NameProcessor($individual);

        self::assertSame('Johnny <span class="NAME"><span class="SURN">Doe</span></span>', $processor->getAlternateName($individual));
    }
}
