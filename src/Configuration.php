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
use MagicSunday\Webtrees\ModuleBase\Model\NameAbbreviation;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Holds all user-configurable chart settings, reading values from the HTTP request
 * (POST body or query params) and falling back to module-level preferences when absent.
 * Provides clamped, type-safe accessors used by both the chart renderer and the admin
 * configuration page.
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
    private const int DEFAULT_DETAILED_DATE_GENERATIONS = 0;

    /**
     * Minimum number of generations showing detailed life event dates.
     */
    private const int MIN_DETAILED_DATE_GENERATIONS = 0;

    /**
     * @param ServerRequestInterface $request
     * @param AbstractModule         $module
     */
    public function __construct(
        private readonly ServerRequestInterface $request,
        private readonly AbstractModule $module,
    ) {
    }

    /**
     * Returns the request validator appropriate for the current HTTP method —
     * parsed body for POST, query params for everything else.
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
     * Returns the number of ancestor generations to render, clamped to [MIN, MAX].
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
     * Returns a localised label map keyed by generation count, suitable for select elements.
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
     * Returns how many innermost generations show full DD.MM.YYYY dates.
     * Generations beyond this threshold display year-only.
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
     * Returns a localised label map for the detailed-date threshold selector.
     * Key 0 maps to "Years only"; higher keys indicate the cutoff generation.
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
     * Returns the font size scaling factor as a percentage (75–125).
     *
     * @return int
     */
    public function getFontScale(): int
    {
        return $this->validator()
            ->isBetween(75, 125)
            ->integer(
                'fontScale',
                (int) $this->module->getPreference(
                    'default_fontScale',
                    (string) self::FONT_SCALE_DEFAULT
                )
            );
    }

    /**
     * Returns true when descendant support (partners + children) is active.
     *
     * @return bool
     */
    public function getShowDescendants(): bool
    {
        return $this->validator()
            ->boolean(
                'showDescendants',
                (bool) $this->module->getPreference(
                    'default_showDescendants',
                    '0'
                )
            );
    }

    /**
     * Returns the opening angle of the fan in degrees (180–360).
     * When showDescendants is active, the value is clamped to 180–270
     * to reserve angular space for the descendant section.
     *
     * @return int
     */
    public function getFanDegree(): int
    {
        $value = $this->getFanDegreeUnclamped();

        if ($this->getShowDescendants()) {
            return min(270, max(180, $value));
        }

        return $value;
    }

    /**
     * Returns the opening angle of the fan in degrees WITHOUT descendant clamping.
     * Used by page.phtml to initialise the fanDegreeRaw storage key.
     *
     * @return int
     */
    public function getFanDegreeUnclamped(): int
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
     * Returns true when ancestor arcs with no data should be omitted from the chart.
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
     * Returns true when paternal/maternal lineage colouring is enabled.
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
     * Returns true when birth/death place names should be rendered in chart arcs.
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
     * Returns the number of lowest place hierarchy levels to display (0 = full name, 1–3 = N lowest levels).
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
     * Returns a localised label map for the place-parts selector (key 0 = full name).
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
     * Returns true when the marriage date of an individual's parents should appear in arc text.
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
     * Returns true when highlight images (or silhouettes) should be rendered inside arcs.
     *
     * @return bool
     */
    public function getShowImages(): bool
    {
        $displayMode = $this->resolveDisplayMode();

        if ($displayMode !== null) {
            return in_array($displayMode, ['both', 'images'], true);
        }

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
     * Returns true when the legacy GEDCOM `2 NICK` value should be displayed in
     * quotes between the given names and the surname (e.g. `Martin "Chalky" White`).
     * Default off so existing trees keep the post-2.0 webtrees rendering.
     *
     * @return bool
     */
    public function getShowNicknames(): bool
    {
        return $this->validator()
            ->boolean(
                'showNicknames',
                (bool) $this->module->getPreference(
                    'default_showNicknames',
                    '0'
                )
            );
    }

    /**
     * Returns true when individual names should be rendered inside arc segments.
     *
     * @return bool
     */
    public function getShowNames(): bool
    {
        $displayMode = $this->resolveDisplayMode();

        if ($displayMode !== null) {
            return in_array($displayMode, ['both', 'names'], true);
        }

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
     * Resolves the displayMode parameter from the request. Returns null if not present,
     * allowing fallback to the individual showNames/showImages parameters.
     *
     * @return string|null 'both', 'names', 'images', or null
     */
    private function resolveDisplayMode(): ?string
    {
        $params = (array) $this->request->getParsedBody() + $this->request->getQueryParams();
        $mode   = $params['displayMode'] ?? null;

        if (is_string($mode) && in_array($mode, ['both', 'names', 'images'], true)) {
            return $mode;
        }

        return null;
    }

    /**
     * Returns the count of innermost arc rings that receive the wider "detailed" layout.
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
     * Returns a localised label map keyed by inner arc count, suitable for select elements.
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
     * Returns true when the SVG download button should be hidden from the chart toolbar.
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
     * Returns true when the PNG download button should be hidden from the chart toolbar.
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
     * Returns the CSS hex color used to tint paternal-side arc segments.
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
     * Returns the CSS hex color used to tint maternal-side arc segments.
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

    /**
     * Returns the dropdown options for the name-abbreviation strategy in
     * the admin config form. Keyed by the persisted enum value.
     *
     * @return array<string, string>
     */
    public function getNameAbbreviationList(): array
    {
        return [
            NameAbbreviation::AUTO    => I18N::translate("Automatic (based on tree's surname tradition)"),
            NameAbbreviation::GIVEN   => I18N::translate('Abbreviate given names first'),
            NameAbbreviation::SURNAME => I18N::translate('Abbreviate surnames first'),
        ];
    }

    /**
     * Returns the name-abbreviation strategy as stored. One of
     * {@see NameAbbreviation::AUTO}, GIVEN or SURNAME. The chart-render path
     * resolves AUTO to GIVEN/SURNAME via the tree's SURNAME_TRADITION before
     * serialising to the JS config — see {@see Module::getChartParameters()}.
     *
     * @return string
     */
    public function getNameAbbreviation(): string
    {
        $value = $this->validator()
            ->string(
                'nameAbbreviation',
                $this->module->getPreference(
                    'default_nameAbbreviation',
                    NameAbbreviation::AUTO
                )
            );

        return in_array($value, NameAbbreviation::CHOICES, true)
            ? $value
            : NameAbbreviation::AUTO;
    }

    /**
     * Returns the form-toggle parameter set used by every URL the chart
     * navigates to (POST → redirect, AJAX fragment, click-to-recenter).
     * Centralising the list here keeps the three call sites in sync —
     * dropping one parameter from a single URL silently flipped toggles
     * back to module preference defaults on navigation.
     *
     * @return array<string, int|string>
     */
    public function getRouteToggleParams(): array
    {
        return [
            'generations'             => $this->getGenerations(),
            'fanDegree'               => $this->getFanDegree(),
            'fontScale'               => $this->getFontScale(),
            'hideEmptySegments'       => $this->getHideEmptySegments() ? '1' : '0',
            'showFamilyColors'        => $this->getShowFamilyColors() ? '1' : '0',
            'showPlaces'              => $this->getShowPlaces() ? '1' : '0',
            'placeParts'              => $this->getPlaceParts(),
            'showParentMarriageDates' => $this->getShowParentMarriageDates() ? '1' : '0',
            'showImages'              => $this->getShowImages() ? '1' : '0',
            'showNames'               => $this->getShowNames() ? '1' : '0',
            'showNicknames'           => $this->getShowNicknames() ? '1' : '0',
            'innerArcs'               => $this->getInnerArcs(),
            'paternalColor'           => $this->getPaternalColor(),
            'maternalColor'           => $this->getMaternalColor(),
            'detailedDateGenerations' => $this->getDetailedDateGenerations(),
            'showDescendants'         => $this->getShowDescendants() ? '1' : '0',
        ];
    }
}
