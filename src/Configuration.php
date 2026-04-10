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
     */
    private const int DEFAULT_GENERATIONS = 6;

    /**
     * Minimum number of displayable generations.
     */
    private const int MIN_GENERATIONS = 2;

    /**
     * Maximum number of displayable generations.
     */
    private const int MAX_GENERATIONS = 10;

    /**
     * The default number of inner levels.
     */
    private const int DEFAULT_INNER_ARCS = 3;

    /**
     * Minimum number of displayable inner levels.
     */
    private const int MIN_INNER_ARCS = 0;

    /**
     * Maximum number of displayable inner levels.
     */
    private const int MAX_INNER_ARCS = 5;

    /**
     * The default fan chart degree.
     */
    private const int FAN_DEGREE_DEFAULT = 210;

    /**
     * The default font size scaling factor in percent.
     */
    private const int FONT_SCALE_DEFAULT = 100;

    /**
     * The default color for the paternal lineage (blue).
     */
    public const string PATERNAL_COLOR_DEFAULT = '#70a9cf';

    /**
     * The default color for the maternal lineage (pink).
     */
    public const string MATERNAL_COLOR_DEFAULT = '#d06f94';

    /**
     * The default number of place hierarchy parts to display.
     * 1 = lowest level (parish/city), 0 = full place name.
     */
    private const int DEFAULT_PLACE_PARTS = 1;

    /**
     * The default number of generations for which detailed life event dates are displayed.
     */
    private const int DEFAULT_DETAILED_DATE_GENERATIONS = 3;

    /**
     * Minimum number of generations showing detailed life event dates.
     */
    private const int MIN_DETAILED_DATE_GENERATIONS = 0;

    /**
     * Configuration constructor.
     *
     * @param ServerRequestInterface $request
     * @param AbstractModule         $module
     */
    public function __construct(
        private readonly ServerRequestInterface $request,
        private readonly AbstractModule $module,
    ) {
    }

    /**
     * Returns the request validator for the current request method.
     *
     * @return Validator
     */
    private function validator(): Validator
    {
        return $this->request->getMethod() === RequestMethodInterface::METHOD_POST
            ? Validator::parsedBody($this->request)
            : Validator::queryParams($this->request);
    }

    /**
     * Returns the number of generations to display.
     *
     * @return int
     */
    public function getGenerations(): int
    {
        return $this->validator()
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
     * Returns the number of generations to display detailed birth and death dates for.
     *
     * @return int
     */
    public function getDetailedDateGenerations(): int
    {
        return $this->validator()
            ->isBetween(self::MIN_DETAILED_DATE_GENERATIONS, self::MAX_GENERATIONS)
            ->integer(
                'detailedDateGenerations',
                (int) $this->module->getPreference(
                    'default_detailedDateGenerations',
                    (string) self::DEFAULT_DETAILED_DATE_GENERATIONS
                )
            );
    }

    /**
     * Returns a list of possible generation counts for detailed birth and death dates.
     *
     * @return string[]
     */
    public function getDetailedDateGenerationsList(): array
    {
        $result = [
            self::MIN_DETAILED_DATE_GENERATIONS => I18N::translate('Years only'),
        ];

        foreach (range(self::MIN_DETAILED_DATE_GENERATIONS + 1, self::MAX_GENERATIONS) as $value) {
            $result[$value] = I18N::translate(
                'Show full dates up to generation %s',
                I18N::number($value)
            );
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
        return $this->validator()
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
        return $this->validator()
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
        return $this->validator()
            ->boolean(
                'hideEmptySegments',
                (bool) $this->module->getPreference(
                    'default_hideEmptySegments',
                    '1'
                )
            );
    }

    /**
     * Returns whether to show family colors or not.
     *
     * @return bool
     */
    public function getShowFamilyColors(): bool
    {
        return $this->validator()
            ->boolean(
                'showFamilyColors',
                (bool) $this->module->getPreference(
                    'default_showFamilyColors',
                    '1'
                )
            );
    }

    /**
     * Returns whether to show place names or not.
     *
     * @return bool
     */
    public function getShowPlaces(): bool
    {
        return $this->validator()
            ->boolean(
                'showPlaces',
                (bool) $this->module->getPreference(
                    'default_showPlaces',
                    '0'
                )
            );
    }

    /**
     * Returns the number of place hierarchy parts to display.
     *
     * @return int
     */
    public function getPlaceParts(): int
    {
        return $this->validator()
            ->isBetween(0, 3)
            ->integer(
                'placeParts',
                (int) $this->module->getPreference(
                    'default_placeParts',
                    (string) self::DEFAULT_PLACE_PARTS
                )
            );
    }

    /**
     * Returns a list of possible place part options.
     *
     * @return string[]
     */
    public function getPlacePartsList(): array
    {
        return [
            0 => I18N::translate('Full place name'),
            1 => I18N::translate('Lowest level (e.g. parish)'),
            2 => I18N::translate('Lowest two levels'),
            3 => I18N::translate('Lowest three levels'),
        ];
    }

    /**
     * Returns whether to show parent marriage dates or not.
     *
     * @return bool
     */
    public function getShowParentMarriageDates(): bool
    {
        return $this->validator()
            ->boolean(
                'showParentMarriageDates',
                (bool) $this->module->getPreference(
                    'default_showParentMarriageDates',
                    '0'
                )
            );
    }

    /**
     * Returns whether to show images or not.
     *
     * @return bool
     */
    public function getShowImages(): bool
    {
        return $this->validator()
            ->boolean(
                'showImages',
                (bool) $this->module->getPreference(
                    'default_showImages',
                    '0'
                )
            );
    }

    /**
     * Returns whether to show names in arcs or not.
     *
     * @return bool
     */
    public function getShowNames(): bool
    {
        return $this->validator()
            ->boolean(
                'showNames',
                (bool) $this->module->getPreference(
                    'default_showNames',
                    '1'
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
        return $this->validator()
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
        return $this->validator()
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
        return $this->validator()
            ->boolean(
                'hidePngExport',
                (bool) $this->module->getPreference(
                    'default_hidePngExport',
                    '0'
                )
            );
    }

    /**
     * Returns the color for the paternal lineage.
     *
     * @return string
     */
    public function getPaternalColor(): string
    {
        return $this->validator()
            ->string(
                'paternalColor',
                $this->module->getPreference(
                    'default_paternalColor',
                    self::PATERNAL_COLOR_DEFAULT
                )
            );
    }

    /**
     * Returns the color for the maternal lineage.
     *
     * @return string
     */
    public function getMaternalColor(): string
    {
        return $this->validator()
            ->string(
                'maternalColor',
                $this->module->getPreference(
                    'default_maternalColor',
                    self::MATERNAL_COLOR_DEFAULT
                )
            );
    }
}
