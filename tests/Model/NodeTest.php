<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Model;

use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[CoversClass(Node::class)]
/**
 * Tests node serialization logic and parent handling.
 */
final class NodeTest extends TestCase
{
    /**
     * Ensures parent references are included during serialization when they exist.
     */
    #[Test]
    public function jsonSerializeAddsParentsWhenPresent(): void
    {
        $childData  = (new NodeData())->setId(1);
        $fatherData = (new NodeData())->setId(2);

        $child  = new Node($childData);
        $father = new Node($fatherData);

        $child->addParent($father);

        $result = $child->jsonSerialize();

        self::assertSame($childData, $result['data']);
        self::assertArrayHasKey('parents', $result);
        self::assertSame([$father], $result['parents']);
    }

    /**
     * Ensures serialization omits parent data when no parents are attached.
     */
    #[Test]
    public function jsonSerializeOmitsParentsWhenEmpty(): void
    {
        $child = new Node(new NodeData());

        $result = $child->jsonSerialize();

        self::assertSame(['data' => $child->getData()], $result);
    }
}
