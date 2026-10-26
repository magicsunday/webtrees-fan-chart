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
use MagicSunday\Webtrees\ModuleBase\Model\FactView;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\Attributes\UsesClass;
use PHPUnit\Framework\TestCase;

use function array_key_last;

/**
 * Validates the serialised payload of a person for the detail panel.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversClass(NodeData::class)]
#[UsesClass(FactView::class)]
final class NodeDataTest extends TestCase
{
    /**
     * A chart without the detail panel keeps the payload it always had, so the key is not there.
     */
    #[Test]
    public function leavesTheFactsKeyOutWithoutFacts(): void
    {
        self::assertArrayNotHasKey('facts', (new NodeData())->jsonSerialize());
        self::assertArrayNotHasKey('facts', (new NodeData())->setFacts([])->jsonSerialize());
    }

    /**
     * The facts are appended behind every other member, so a consumer that reads the payload
     * in order finds the members it knew before in the place it knew.
     */
    #[Test]
    public function appendsTheFactsAsTheLastKey(): void
    {
        $facts = [new FactView('BIRT', 'Birth', '1900', 'Berlin', 'Berlin, Germany', ''), null];

        $payload = (new NodeData())->setFacts($facts)->jsonSerialize();

        self::assertSame('facts', array_key_last($payload));
        self::assertArrayHasKey('facts', $payload);
        self::assertSame($facts, $payload['facts']);
    }

    /**
     * A list of empty slots is still a list, so the panel can tell a person without facts
     * from a chart that sends none.
     */
    #[Test]
    public function keepsAListOfEmptySlots(): void
    {
        $payload = (new NodeData())->setFacts([null, null])->jsonSerialize();

        self::assertArrayHasKey('facts', $payload);
        self::assertSame([null, null], $payload['facts']);
    }
}
