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

        return $jsonData;
    }
}
