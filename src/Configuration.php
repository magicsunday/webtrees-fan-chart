<?php

/**
 * See LICENSE.md file for further details.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart;

use Fisharebest\Webtrees\I18N;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Configuration class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class Configuration
{
    /**
     * The default number of generations to display.
     *
     * @var int
     */
    private const DEFAULT_GENERATIONS = 6;

    /**
     * Minimum number of displayable generations.
     *
     * @var int
     */
    private const MIN_GENERATIONS = 2;

    /**
     * Maximum number of displayable generations.
     *
     * @var int
     */
    private const MAX_GENERATIONS = 10;

    /**
     * The default number of inner levels.
     *
     * @var int
     */
    private const DEFAULT_INNER_ARCS = 3;

    /**
     * Minimum number of displayable inner levels.
     *
     * @var int
     */
    private const MIN_INNER_ARCS = 0;

    /**
     * Maximum number of displayable inner levels.
     *
     * @var int
     */
    private const MAX_INNER_ARCS = 5;

    /**
     * The default fan chart degree.
     *
     * @var int
     */
    private const FAN_DEGREE_DEFAULT = 210;

    /**
     * The default font size scaling factor in percent.
     *
     * @var int
     */
    private const FONT_SCALE_DEFAULT = 100;

    /**
     * The current request instance.
     *
     * @var ServerRequestInterface
     */
    private ServerRequestInterface $request;

    /**
     * Configuration constructor.
     *
     * @param ServerRequestInterface $request
     */
    public function __construct(ServerRequestInterface $request)
    {
        $this->request = $request;
    }

    /**
     * Returns the number of generations to display.
     *
     * @return int
     */
    public function getGenerations(): int
    {
        $generations = (int) ($this->request->getQueryParams()['generations'] ?? self::DEFAULT_GENERATIONS);
        $generations = min($generations, self::MAX_GENERATIONS);

        return max($generations, self::MIN_GENERATIONS);
    }

    /**
     * Returns a list of possible selectable generations.
     *
     * @return string[]
     */
    public function getGenerationsList(): array
    {
        $result = [];

        foreach (range(self::MIN_GENERATIONS, self::MAX_GENERATIONS) as $value) {
            $result[$value] = I18N::number($value);
        }

        return $result;
    }

    /**
     * Returns the font scale to use.
     *
     * @return int
     */
    public function getFontScale(): int
    {
        $fontScale = (int) ($this->request->getQueryParams()['fontScale'] ?? self::FONT_SCALE_DEFAULT);
        $fontScale = min($fontScale, 200);

        return max($fontScale, 10);
    }

    /**
     * Returns the fan degree to use.
     *
     * @return int
     */
    public function getFanDegree(): int
    {
        $fanDegree = (int) ($this->request->getQueryParams()['fanDegree'] ?? self::FAN_DEGREE_DEFAULT);
        $fanDegree = min($fanDegree, 360);

        return max($fanDegree, 180);
    }

    /**
     * Returns whether to hide empty segments or not.
     *
     * @return bool
     */
    public function getHideEmptySegments(): bool
    {
        return (bool) ($this->request->getQueryParams()['hideEmptySegments'] ?? false);
    }

    /**
     * Returns whether to show color gradients or not.
     *
     * @return bool
     */
    public function getShowColorGradients(): bool
    {
        return (bool) ($this->request->getQueryParams()['showColorGradients'] ?? false);
    }

    /**
     * Returns whether to show parent marriage dates or not.
     *
     * @return bool
     */
    public function getShowParentMarriageDates(): bool
    {
        return (bool) ($this->request->getQueryParams()['showParentMarriageDates'] ?? false);
    }

    /**
     * Returns the number of inner arcs to display.
     *
     * @return int
     */
    public function getInnerArcs(): int
    {
        $innerArcs = (int) ($this->request->getQueryParams()['innerArcs'] ?? self::DEFAULT_INNER_ARCS);
        $innerArcs = min($innerArcs, self::MAX_INNER_ARCS);

        return max($innerArcs, self::MIN_INNER_ARCS);
    }

    /**
     * Returns a list of possible selectable values for inner arcs.
     *
     * @return string[]
     */
    public function getInnerArcsList(): array
    {
        $result = [];

        foreach (range(self::MIN_INNER_ARCS, self::MAX_INNER_ARCS) as $value) {
            $result[$value] = I18N::number($value);
        }

        return $result;
    }
}
