<?php
declare(strict_types=1);

/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees;

use Fisharebest\Webtrees\Tree;
use Symfony\Component\HttpFoundation\Request;

/**
 * Configuration class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/ancestral-fan-chart/
 */
class Config
{
    /**
     * Minimum number of displayable generations.
     *
     * @var int
     */
    const MIN_GENERATIONS = 2;

    /**
     * Maximum number of displayable generations.
     *
     * @var int
     */
    const MAX_GENERATIONS = 10;

    /**
     * The defaut fan chart degree.
     */
    const FAN_DEGREE_DEFAULT = 210;

    /**
     * The default font size scaling factor in percent.
     */
    const FONT_SCALE_DEFAULT = 100;

    /**
     * The current request instance.
     *
     * @var Request
     */
    private $request;

    /**
     * The current tree instance.
     *
     * @var Tree
     */
    private $tree;

    /**
     * Config constructor.
     *
     * @param Request $request The current HTTP request
     * @param Tree    $tree    The current tree
     */
    public function __construct(Request $request, Tree $tree)
    {
        $this->request = $request;
        $this->tree    = $tree;
    }

    /**
     * Returns the default number of generations to display.
     *
     * @return int
     */
    private function getDefaultGenerations(): int
    {
        return (int) $this->tree->getPreference('DEFAULT_PEDIGREE_GENERATIONS');
    }

    /**
     * Returns the number of generations to display.
     *
     * @return int
     */
    public function getGenerations(): int
    {
        $generations = (int) $this->request->get('generations', $this->getDefaultGenerations());
        $generations = min($generations, self::MAX_GENERATIONS);

        return max($generations, self::MIN_GENERATIONS);
    }

    /**
     * Returns the font scale to use.
     *
     * @return int
     */
    public function getFontScale(): int
    {
        $fontScale = (int) $this->request->get('fontScale', self::FONT_SCALE_DEFAULT);
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
        $fanDegree = (int) $this->request->get('fanDegree', self::FAN_DEGREE_DEFAULT);
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
        return (bool) $this->request->get('hideEmptySegments');
    }

    /**
     * Returns whether to show color gradients or not.
     *
     * @return bool
     */
    public function getShowColorGradients(): bool
    {
        return (bool) $this->request->get('showColorGradients');
    }
}
