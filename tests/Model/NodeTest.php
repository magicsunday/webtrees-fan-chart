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

/**
 * Validates the serialised payload of a node of the chart.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversClass(Node::class)]
#[CoversClass(NodeData::class)]
final class NodeTest extends TestCase
{
    /**
     * A node without relatives and without facts carries its data and nothing else. Every
     * key that only appears for a non-empty list is absent, so a chart without the detail
     * panel keeps the payload it always had.
     */
    #[Test]
    public function anEmptyNodeSerialisesToItsDataOnly(): void
    {
        $node = new Node(new NodeData());

        self::assertSame(['data' => $node->getData()], $node->jsonSerialize());
        self::assertArrayNotHasKey('facts', $node->getData()->jsonSerialize());
        self::assertArrayNotHasKey('facts', (new NodeData())->setFacts([])->jsonSerialize());
    }

    /**
     * Every relative list of a node appears under its own key with the nodes that were
     * added to it. Each list holds a different node, so a key that carries the nodes of
     * another list is found.
     */
    #[Test]
    public function aNodeWithRelativesCarriesEachListUnderItsOwnKey(): void
    {
        $node     = new Node((new NodeData())->setId(1));
        $parent   = new Node((new NodeData())->setId(2));
        $partner  = new Node((new NodeData())->setId(3)->setSex('F'));
        $child    = new Node((new NodeData())->setId(4));
        $unplaced = new Node((new NodeData())->setId(5));

        $node
            ->addParent($parent)
            ->addPartner($partner)
            ->setChildren([$child])
            ->addUnassignedChild($unplaced);

        self::assertSame(
            [
                'data'               => $node->getData(),
                'parents'            => [$parent],
                'partners'           => [$partner],
                'children'           => [$child],
                'unassignedChildren' => [$unplaced],
            ],
            $node->jsonSerialize()
        );
    }
}
