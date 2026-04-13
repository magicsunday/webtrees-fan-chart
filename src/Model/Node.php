<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Model;

use JsonSerializable;

/**
 * Represents a single node in the ancestor tree. Wraps a NodeData payload and
 * holds references to up to two parent Nodes (father, mother). The recursive
 * structure is serialised to JSON for consumption by the D3 chart renderer.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class Node implements JsonSerializable
{
    /**
     * The list of parents.
     *
     * @var Node[]
     */
    protected array $parents = [];

    /**
     * The list of partner nodes (depth -1 in the descendant section).
     *
     * @var Node[]
     */
    protected array $partners = [];

    /**
     * The list of child nodes (depth -2 in the descendant section).
     *
     * @var Node[]
     */
    protected array $children = [];

    /**
     * Children without a visible partner (privacy-hidden spouse).
     *
     * @var Node[]
     */
    protected array $unassignedChildren = [];

    /**
     * @param NodeData $data
     */
    public function __construct(protected NodeData $data)
    {
    }

    /**
     * Returns the data payload for this node.
     *
     * @return NodeData
     */
    public function getData(): NodeData
    {
        return $this->data;
    }

    /**
     * Appends a parent node (father or mother). Called at most twice per node.
     *
     * @param Node $parent
     *
     * @return Node
     */
    public function addParent(Node $parent): Node
    {
        $this->parents[] = $parent;

        return $this;
    }

    /**
     * Appends a partner node. Partners are displayed as arcs in the descendant section.
     *
     * @param Node $partner
     *
     * @return Node
     */
    public function addPartner(Node $partner): Node
    {
        $this->partners[] = $partner;

        return $this;
    }

    /**
     * Returns the list of partner nodes.
     *
     * @return Node[]
     */
    public function getPartners(): array
    {
        return $this->partners;
    }

    /**
     * Sets the child nodes for this node.
     *
     * @param Node[] $children
     *
     * @return Node
     */
    public function setChildren(array $children): Node
    {
        $this->children = $children;

        return $this;
    }

    /**
     * Returns the list of child nodes.
     *
     * @return Node[]
     */
    public function getChildren(): array
    {
        return $this->children;
    }

    /**
     * Appends an unassigned child (visible child of a privacy-hidden spouse).
     *
     * @param Node $child
     *
     * @return Node
     */
    public function addUnassignedChild(Node $child): Node
    {
        $this->unassignedChildren[] = $child;

        return $this;
    }

    /**
     * Returns the list of unassigned children.
     *
     * @return Node[]
     */
    public function getUnassignedChildren(): array
    {
        return $this->unassignedChildren;
    }

    /**
     * Serialises the node to an array for JSON output. The "parents" key is omitted
     * when the node has no ancestors, keeping the payload compact.
     *
     * @return array<string, int|int[]|NodeData|Node[]>
     */
    public function jsonSerialize(): array
    {
        $jsonData = [
            'data' => $this->data,
        ];

        if ($this->parents !== []) {
            $jsonData['parents'] = $this->parents;
        }

        if ($this->partners !== []) {
            $jsonData['partners'] = $this->partners;
        }

        if ($this->children !== []) {
            $jsonData['children'] = $this->children;
        }

        if ($this->unassignedChildren !== []) {
            $jsonData['unassignedChildren'] = $this->unassignedChildren;
        }

        return $jsonData;
    }
}
