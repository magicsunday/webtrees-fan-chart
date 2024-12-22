<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart;

use Fig\Http\Message\RequestMethodInterface;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Validator;
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
     * The calling module.
     */
    private AbstractModule $module;

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
     * @param AbstractModule         $module
     */
    public function __construct(ServerRequestInterface $request, AbstractModule $module)
    {
        $this->request = $request;
        $this->module  = $module;
    }

    /**
     * Returns the number of generations to display.
     *
     * @return int
     */
    public function getGenerations(): int
    {
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->isBetween(self::MIN_GENERATIONS, self::MAX_GENERATIONS)
            ->integer(
                'generations',
                (int) $this->module->getPreference(
                    'default_generations',
                    (string) self::DEFAULT_GENERATIONS
                )
            );
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
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->isBetween(10, 200)
            ->integer(
                'fontScale',
                (int) $this->module->getPreference(
                    'default_fontScale',
                    (string) self::FONT_SCALE_DEFAULT
                )
            );
    }

    /**
     * Returns the fan degree to use.
     *
     * @return int
     */
    public function getFanDegree(): int
    {
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->isBetween(180, 360)
            ->integer(
                'fanDegree',
                (int) $this->module->getPreference(
                    'default_fanDegree',
                    (string) self::FAN_DEGREE_DEFAULT
                )
            );
    }

    /**
     * Returns whether to hide empty segments or not.
     *
     * @return bool
     */
    public function getHideEmptySegments(): bool
    {
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->boolean(
                'hideEmptySegments',
                (bool) $this->module->getPreference(
                    'default_hideEmptySegments',
                    '0'
                )
            );
    }

    /**
     * Returns whether to show color gradients or not.
     *
     * @return bool
     */
    public function getShowColorGradients(): bool
    {
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->boolean(
                'showColorGradients',
                (bool) $this->module->getPreference(
                    'default_showColorGradients',
                    '0'
                )
            );
    }

    /**
     * Returns whether to show parent marriage dates or not.
     *
     * @return bool
     */
    public function getShowParentMarriageDates(): bool
    {
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->boolean(
                'showParentMarriageDates',
                (bool) $this->module->getPreference(
                    'default_showParentMarriageDates',
                    '0'
                )
            );
    }

    /**
     * Returns the number of inner arcs to display.
     *
     * @return int
     */
    public function getInnerArcs(): int
    {
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->isBetween(self::MIN_INNER_ARCS, self::MAX_INNER_ARCS)
            ->integer(
                'innerArcs',
                (int) $this->module->getPreference(
                    'default_innerArcs',
                    (string) self::DEFAULT_INNER_ARCS
                )
            );
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

    /**
     * Returns whether to hide the SVG export button or not.
     *
     * @return bool
     */
    public function getHideSvgExport(): bool
    {
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->boolean(
                'hideSvgExport',
                (bool) $this->module->getPreference(
                    'default_hideSvgExport',
                    '0'
                )
            );
    }

    /**
     * Returns whether to hide the PNG export button or not.
     *
     * @return bool
     */
    public function getHidePngExport(): bool
    {
        if ($this->request->getMethod() === RequestMethodInterface::METHOD_POST) {
            $validator = Validator::parsedBody($this->request);
        } else {
            $validator = Validator::queryParams($this->request);
        }

        return $validator
            ->boolean(
                'hidePngExport',
                (bool) $this->module->getPreference(
                    'default_hidePngExport',
                    '0'
                )
            );
    }
}
