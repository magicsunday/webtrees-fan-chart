<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Model;

use MagicSunday\Webtrees\FanChart\Model\NodeData;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[CoversClass(NodeData::class)]
/**
 * Tests serialization of node data with all configured fields.
 */
final class NodeDataTest extends TestCase
{
    /**
     * Ensures the serialized payload exposes all configured node data attributes.
     */
    #[Test]
    public function jsonSerializeContainsAllConfiguredFields(): void
    {
        $nodeData = (new NodeData())
            ->setId(42)
            ->setXref('I1')
            ->setUrl('/tree/example/I1')
            ->setUpdateUrl('/tree/example/I1/update')
            ->setGeneration(3)
            ->setName('Example Person')
            ->setIsNameRtl(false)
            ->setFirstNames(['Example', 'Person'])
            ->setLastNames(['Family'])
            ->setPreferredName('Example')
            ->setAlternativeName('Alias')
            ->setIsAltRtl(true)
            ->setThumbnail('/path/to/image.png')
            ->setSex('M')
            ->setBirth('1 JAN 1900')
            ->setDeath('31 DEC 1950')
            ->setMarriageDate('1 JAN 1930')
            ->setMarriageDateOfParents('1 JAN 1880')
            ->setTimespan('1900-1950');

        $result = $nodeData->jsonSerialize();

        self::assertSame(42, $result['id']);
        self::assertSame('I1', $result['xref']);
        self::assertSame('/tree/example/I1', $result['url']);
        self::assertSame('/tree/example/I1/update', $result['updateUrl']);
        self::assertSame(3, $result['generation']);
        self::assertSame('Example Person', $result['name']);
        self::assertFalse($result['isNameRtl']);
        self::assertSame(['Example', 'Person'], $result['firstNames']);
        self::assertSame(['Family'], $result['lastNames']);
        self::assertSame('Example', $result['preferredName']);
        self::assertSame('Alias', $result['alternativeName']);
        self::assertTrue($result['isAltRtl']);
        self::assertSame('/path/to/image.png', $result['thumbnail']);
        self::assertSame('M', $result['sex']);
        self::assertSame('1 JAN 1900', $result['birth']);
        self::assertSame('31 DEC 1950', $result['death']);
        self::assertSame('1 JAN 1930', $result['marriageDate']);
        self::assertSame('1 JAN 1880', $result['marriageDateOfParents']);
        self::assertSame('1900-1950', $result['timespan']);
    }
}
