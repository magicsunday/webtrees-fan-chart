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
 * This class holds information about a node.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class Node implements JsonSerializable
{
    /**
     * @var NodeData
     */
    protected NodeData $data;

    /**
     * The list of parents.
     *
     * @var Node[]
     */
    protected array $parents = [];

    /**
     * Constructor.
     *
     * @param NodeData $data
     */
    public function __construct(NodeData $data)
    {
        $this->data = $data;
    }

    /**
     * @return NodeData
     */
    public function getData(): NodeData
    {
        return $this->data;
    }

    /**
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
     * Returns the relevant data as an array.
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
