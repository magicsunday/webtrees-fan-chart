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
 * Tests node serialization logic and parent handling.
 */
#[CoversClass(Node::class)]
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

    /**
     * Partners and children keys must be absent from JSON when empty.
     */
    #[Test]
    public function jsonSerializeOmitsPartnersAndChildrenWhenEmpty(): void
    {
        $node = new Node(new NodeData());

        $result = $node->jsonSerialize();

        self::assertArrayNotHasKey('partners', $result);
        self::assertArrayNotHasKey('children', $result);
        self::assertArrayNotHasKey('unassignedChildren', $result);
    }

    /**
     * Partners key must appear in JSON when at least one partner is added.
     */
    #[Test]
    public function jsonSerializeIncludesPartnersWhenPresent(): void
    {
        $root    = new Node((new NodeData())->setId(1));
        $partner = new Node((new NodeData())->setId(2)->setSex('F'));

        $root->addPartner($partner);

        $result = $root->jsonSerialize();

        self::assertArrayHasKey('partners', $result);
        self::assertSame([$partner], $result['partners']);
    }

    /**
     * Children key must appear in JSON when set on a partner node.
     */
    #[Test]
    public function jsonSerializeIncludesChildrenWhenSet(): void
    {
        $partner = new Node((new NodeData())->setId(1));
        $child1  = new Node((new NodeData())->setId(2));
        $child2  = new Node((new NodeData())->setId(3));

        $partner->setChildren([$child1, $child2]);

        $result = $partner->jsonSerialize();

        self::assertArrayHasKey('children', $result);
        self::assertSame([$child1, $child2], $result['children']);
    }

    /**
     * Nested partner + children structure serialises correctly.
     */
    #[Test]
    public function jsonSerializeNestedPartnerWithChildren(): void
    {
        $root    = new Node((new NodeData())->setId(1));
        $partner = new Node((new NodeData())->setId(2)->setSex('F'));
        $child   = new Node((new NodeData())->setId(3));

        $partner->setChildren([$child]);
        $root->addPartner($partner);

        $result = $root->jsonSerialize();

        self::assertArrayHasKey('partners', $result);
        self::assertIsArray($result['partners']);
        self::assertCount(1, $result['partners']);

        $partnerNode = $result['partners'][0];
        self::assertInstanceOf(Node::class, $partnerNode);
        $partnerResult = $partnerNode->jsonSerialize();
        self::assertArrayHasKey('children', $partnerResult);
        self::assertSame([$child], $partnerResult['children']);
    }

    /**
     * UnassignedChildren key must appear when privacy-hidden spouse has visible children.
     */
    #[Test]
    public function jsonSerializeIncludesUnassignedChildrenWhenPresent(): void
    {
        $root  = new Node((new NodeData())->setId(1));
        $child = new Node((new NodeData())->setId(2));

        $root->addUnassignedChild($child);

        $result = $root->jsonSerialize();

        self::assertArrayHasKey('unassignedChildren', $result);
        self::assertSame([$child], $result['unassignedChildren']);
    }

    /**
     * Getters return the correct arrays.
     */
    #[Test]
    public function gettersReturnCorrectArrays(): void
    {
        $root       = new Node((new NodeData())->setId(1));
        $partner    = new Node((new NodeData())->setId(2));
        $child      = new Node((new NodeData())->setId(3));
        $unassigned = new Node((new NodeData())->setId(4));

        $root->addPartner($partner);
        $root->setChildren([$child]);
        $root->addUnassignedChild($unassigned);

        self::assertSame([$partner], $root->getPartners());
        self::assertSame([$child], $root->getChildren());
        self::assertSame([$unassigned], $root->getUnassignedChildren());
    }
}
