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
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\Validator;
use MagicSunday\Webtrees\ModuleBase\Model\NameAbbreviation;
use MagicSunday\Webtrees\ModuleBase\Model\PlaceFormatChoice;
use MagicSunday\Webtrees\ModuleBase\Model\PlaceFormatSpec;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Holds all user-configurable chart settings, reading values from the HTTP
 * request (POST body or query params) and falling back to module-level
 * preferences when absent. Provides clamped, type-safe accessors used by both
 * the chart renderer and the admin configuration page.
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
    public const int MIN_GENERATIONS = 2;

    /**
     * Maximum number of displayable generations.
     */
    public const int MAX_GENERATIONS = 10;

    /**
     * The default number of inner levels.
     */
    private const int DEFAULT_INNER_ARCS = 3;

    /**
     * Minimum number of displayable inner levels.
     */
    public const int MIN_INNER_ARCS = 0;

    /**
     * Maximum number of displayable inner levels.
     */
    public const int MAX_INNER_ARCS = 5;

    /**
     * The default fan chart degree.
     */
    private const int DEFAULT_FAN_DEGREE = 210;

    /**
     * Minimum opening angle of the fan in degrees.
     */
    public const int MIN_FAN_DEGREE = 180;

    /**
     * Maximum opening angle of the fan when descendants are hidden.
     */
    public const int MAX_FAN_DEGREE = 360;

    /**
     * Maximum opening angle when descendants are rendered; narrower than
     * MAX_FAN_DEGREE to reserve angular space for the descendant section.
     */
    public const int MAX_FAN_DEGREE_WITH_DESCENDANTS = 270;

    /**
     * The default font size scaling factor in percent.
     */
    private const int DEFAULT_FONT_SCALE = 100;

    /**
     * Minimum font-scale percentage.
     */
    public const int MIN_FONT_SCALE = 75;

    /**
     * Maximum font-scale percentage.
     */
    public const int MAX_FONT_SCALE = 125;

    /**
     * The default color for the paternal lineage (blue).
     */
    public const string PATERNAL_COLOR_DEFAULT = '#70a9cf';

    /**
     * The default color for the maternal lineage (pink).
     */
    public const string MATERNAL_COLOR_DEFAULT = '#d06f94';

    /**
     * Name of the request parameter and admin form field carrying the place
     * format. The admin form's field name and the key read back here have to be
     * the same string, and nothing else enforces that: a mismatch does not
     * error, it makes every save persist the previously stored choice and
     * silently discard the admin's selection. Both sides reference this
     * constant so they cannot drift apart.
     */
    public const string PLACE_FORMAT_PARAM = 'placeFormat';

    /**
     * Hierarchy levels shown when no tree is available to inherit from. Matches
     * the pre-3.0 DEFAULT_PLACE_PARTS.
     */
    private const int DEFAULT_PLACE_LEVELS = 1;

    /**
     * The default number of generations for which detailed life event dates are
     * displayed.
     */
    private const int DEFAULT_DETAILED_DATE_GENERATIONS = 0;

    /**
     * Minimum number of generations showing detailed life event dates.
     */
    private const int MIN_DETAILED_DATE_GENERATIONS = 0;

    // The getters below are each called once per individual while the tree is
    // built — up to ~1023 nodes for ten generations, via getRouteToggleParams()
    // on the click-to-recenter URL and directly from the DataFacade. Both
    // AbstractModule::getPreference() (an uncached `module_setting` query on
    // every call) and Validator::__construct() (which re-scans every request
    // parameter for valid UTF-8) would otherwise put the cost in linear
    // proportion to the chart size. Each getter therefore returns its memoised
    // value before doing either — an assignment at the return site would be too
    // late, because the validator is built above it. The configuration is
    // constructed per request, so a resolved value cannot go stale within its
    // lifetime.

    /**
     * The resolved number of generations to display, or null until first resolved.
     */
    private ?int $generations = null;

    /**
     * The resolved detailed-date generation threshold, or null until first resolved.
     */
    private ?int $detailedDateGenerations = null;

    /**
     * The resolved font-scale percentage, or null until first resolved.
     */
    private ?int $fontScale = null;

    /**
     * Whether descendant support is active, or null until first resolved.
     */
    private ?bool $showDescendants = null;

    /**
     * The resolved unclamped fan degree, or null until first resolved.
     */
    private ?int $fanDegreeUnclamped = null;

    /**
     * Whether empty ancestor arcs are hidden, or null until first resolved.
     */
    private ?bool $hideEmptySegments = null;

    /**
     * Whether lineage colouring is enabled, or null until first resolved.
     */
    private ?bool $showFamilyColors = null;

    /**
     * Whether place names are rendered, or null until first resolved.
     */
    private ?bool $showPlaces = null;

    /**
     * The resolved place-format choice, or null until first resolved.
     */
    private ?PlaceFormatChoice $placeFormatChoice = null;

    /**
     * Whether parent marriage dates are shown, or null until first resolved.
     */
    private ?bool $showParentMarriageDates = null;

    /**
     * Whether highlight images are rendered, or null until first resolved.
     */
    private ?bool $showImages = null;

    /**
     * Whether individual names are rendered, or null until first resolved.
     */
    private ?bool $showNames = null;

    /**
     * Whether nicknames are shown, or null until first resolved.
     */
    private ?bool $showNicknames = null;

    /**
     * The resolved number of inner arcs, or null until first resolved.
     */
    private ?int $innerArcs = null;

    /**
     * The resolved paternal arc colour, or null until first resolved.
     */
    private ?string $paternalColor = null;

    /**
     * The resolved maternal arc colour, or null until first resolved.
     */
    private ?string $maternalColor = null;

    /**
     * @param ServerRequestInterface $request
     * @param AbstractModule         $module
     * @param Tree|null              $tree    The active tree, used to resolve the "Automatic" place-format
     *                                        choice from SHOW_PEDIGREE_PLACES / _SUFFIX; null in
     *                                        tree-agnostic contexts such as the admin configuration page
     */
    public function __construct(
        private readonly ServerRequestInterface $request,
        private readonly AbstractModule $module,
        private readonly ?Tree $tree = null,
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
     * Returns the number of ancestor generations to render, clamped to [MIN,
     * MAX].
     *
     * @return int
     */
    public function getGenerations(): int
    {
        if ($this->generations !== null) {
            return $this->generations;
        }

        return $this->generations = $this->validator()
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
     * Returns how many innermost generations show full DD.MM.YYYY dates.
     * Generations beyond this threshold display year-only.
     *
     * @return int
     */
    public function getDetailedDateGenerations(): int
    {
        if ($this->detailedDateGenerations !== null) {
            return $this->detailedDateGenerations;
        }

        return $this->detailedDateGenerations = $this->validator()
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
        if ($this->fontScale !== null) {
            return $this->fontScale;
        }

        return $this->fontScale = $this->validator()
            ->isBetween(self::MIN_FONT_SCALE, self::MAX_FONT_SCALE)
            ->integer(
                'fontScale',
                (int) $this->module->getPreference(
                    'default_fontScale',
                    (string) self::DEFAULT_FONT_SCALE
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
        if ($this->showDescendants !== null) {
            return $this->showDescendants;
        }

        return $this->showDescendants = $this->validator()
            ->boolean(
                'showDescendants',
                (bool) $this->module->getPreference(
                    'default_showDescendants',
                    '0'
                )
            );
    }

    /**
     * Returns the opening angle of the fan in degrees (180–360). When
     * showDescendants is active, the value is clamped to 180–270 to reserve
     * angular space for the descendant section.
     *
     * Deliberately not memoised: it only combines two already-memoised getters
     * with a clamp, so it reads no preference and builds no validator of its
     * own — a property here would cache nothing that is not already cached.
     *
     * @return int
     */
    public function getFanDegree(): int
    {
        $value = $this->getFanDegreeUnclamped();

        if ($this->getShowDescendants()) {
            return min(self::MAX_FAN_DEGREE_WITH_DESCENDANTS, max(self::MIN_FAN_DEGREE, $value));
        }

        return $value;
    }

    /**
     * Returns the opening angle of the fan in degrees WITHOUT descendant
     * clamping. Used by page.phtml to initialise the fanDegreeRaw storage key.
     *
     * @return int
     */
    public function getFanDegreeUnclamped(): int
    {
        if ($this->fanDegreeUnclamped !== null) {
            return $this->fanDegreeUnclamped;
        }

        return $this->fanDegreeUnclamped = $this->validator()
            ->isBetween(self::MIN_FAN_DEGREE, self::MAX_FAN_DEGREE)
            ->integer(
                'fanDegree',
                (int) $this->module->getPreference(
                    'default_fanDegree',
                    (string) self::DEFAULT_FAN_DEGREE
                )
            );
    }

    /**
     * Returns true when ancestor arcs with no data should be omitted from the
     * chart.
     *
     * @return bool
     */
    public function getHideEmptySegments(): bool
    {
        if ($this->hideEmptySegments !== null) {
            return $this->hideEmptySegments;
        }

        return $this->hideEmptySegments = $this->validator()
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
        if ($this->showFamilyColors !== null) {
            return $this->showFamilyColors;
        }

        return $this->showFamilyColors = $this->validator()
            ->boolean(
                'showFamilyColors',
                (bool) $this->module->getPreference(
                    'default_showFamilyColors',
                    '1'
                )
            );
    }

    /**
     * Returns true when birth/death place names should be rendered in chart
     * arcs.
     *
     * @return bool
     */
    public function getShowPlaces(): bool
    {
        if ($this->showPlaces !== null) {
            return $this->showPlaces;
        }

        return $this->showPlaces = $this->validator()
            ->boolean(
                'showPlaces',
                (bool) $this->module->getPreference(
                    'default_showPlaces',
                    '0'
                )
            );
    }

    /**
     * The place-detail option as selected, before the tree preferences are
     * applied. This is the value the configuration select shows and the value
     * forwarded on navigation.
     *
     * An unusable value — a tampered query parameter, or a preference written by
     * a newer version before a downgrade — never silently resets the admin's
     * choice: the query parameter falls back to the stored preference, and an
     * unusable stored preference falls through to the legacy key.
     *
     * @return PlaceFormatChoice
     */
    public function getPlaceFormatChoice(): PlaceFormatChoice
    {
        if ($this->placeFormatChoice instanceof PlaceFormatChoice) {
            return $this->placeFormatChoice;
        }

        $stored = PlaceFormatChoice::tryFrom($this->module->getPreference('default_placeFormat', ''))
            ?? $this->legacyPlaceFormat();

        return $this->placeFormatChoice = PlaceFormatChoice::tryFrom(
            $this->validator()->string(self::PLACE_FORMAT_PARAM, $stored->value)
        ) ?? $stored;
    }

    /**
     * Translate the pre-3.0 integer preference into a choice value. Read-only:
     * the old key is never rewritten, so downgrading to an earlier module
     * version keeps working. Anything unrecognised means "inherit from the tree".
     *
     * Returns the case rather than its backing value: every arm yields a valid
     * choice, so handing the caller a string would only invite a `tryFrom()`
     * that can never fail and a fallback arm that can never run.
     *
     * @return PlaceFormatChoice
     */
    private function legacyPlaceFormat(): PlaceFormatChoice
    {
        return match ($this->module->getPreference('default_placeParts', '')) {
            '0'     => PlaceFormatChoice::Full,
            '1'     => PlaceFormatChoice::Levels1,
            '2'     => PlaceFormatChoice::Levels2,
            '3'     => PlaceFormatChoice::Levels3,
            default => PlaceFormatChoice::Automatic,
        };
    }

    /**
     * The fully resolved formatting instruction. The automatic choice is applied
     * against the tree's SHOW_PEDIGREE_PLACES / SHOW_PEDIGREE_PLACES_SUFFIX
     * preferences here, because this is where the tree is available — the
     * processor stays free of webtrees configuration.
     *
     * Deliberately not memoised: it reads no module preference of its own — the
     * choice comes from the memoised getPlaceFormatChoice() and the tree
     * preferences are already cached in the Tree instance — so the per-node cost
     * this fix targets (the uncached `module_setting` query) never arises here.
     *
     * @return PlaceFormatSpec
     */
    public function getPlaceFormat(): PlaceFormatSpec
    {
        if (!$this->tree instanceof Tree) {
            return $this->getPlaceFormatChoice()->toSpec(self::DEFAULT_PLACE_LEVELS, false);
        }

        return $this->getPlaceFormatChoice()->toSpec(
            (int) $this->tree->getPreference('SHOW_PEDIGREE_PLACES'),
            $this->tree->getPreference('SHOW_PEDIGREE_PLACES_SUFFIX') === '1'
        );
    }

    /**
     * Localised labels for the place-detail selector, keyed by stored value. The
     * literals live here rather than in the shared package so xgettext can
     * extract them into this module's catalogue.
     *
     * @return array<string, string>
     */
    public function getPlaceFormatList(): array
    {
        return [
            PlaceFormatChoice::Automatic->value   => I18N::translate('Automatic (from the tree configuration)'),
            PlaceFormatChoice::Full->value        => I18N::translate('Full place name'),
            PlaceFormatChoice::Levels1->value     => I18N::translate('Lowest level (e.g. parish)'),
            PlaceFormatChoice::Levels2->value     => I18N::translate('Lowest two levels'),
            PlaceFormatChoice::Levels3->value     => I18N::translate('Lowest three levels'),
            PlaceFormatChoice::CityCountry->value => I18N::translate('Place and country'),
            PlaceFormatChoice::CityIso2->value    => I18N::translate('Place and country code (2 letters)'),
            PlaceFormatChoice::CityIso3->value    => I18N::translate('Place and country code (3 letters)'),
        ];
    }

    /**
     * Returns true when the marriage date of an individual's parents should
     * appear in arc text.
     *
     * @return bool
     */
    public function getShowParentMarriageDates(): bool
    {
        if ($this->showParentMarriageDates !== null) {
            return $this->showParentMarriageDates;
        }

        return $this->showParentMarriageDates = $this->validator()
            ->boolean(
                'showParentMarriageDates',
                (bool) $this->module->getPreference(
                    'default_showParentMarriageDates',
                    '0'
                )
            );
    }

    /**
     * Returns true when highlight images (or silhouettes) should be rendered
     * inside arcs.
     *
     * @return bool
     */
    public function getShowImages(): bool
    {
        if ($this->showImages !== null) {
            return $this->showImages;
        }

        $displayMode = $this->resolveDisplayMode();

        if ($displayMode !== null) {
            return $this->showImages = in_array($displayMode, ['both', 'images'], true);
        }

        return $this->showImages = $this->validator()
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
     * quotes between the given names and the surname (e.g. `Martin "Chalky"
     * White`). Default off so existing trees keep the post-2.0 webtrees
     * rendering.
     *
     * @return bool
     */
    public function getShowNicknames(): bool
    {
        if ($this->showNicknames !== null) {
            return $this->showNicknames;
        }

        return $this->showNicknames = $this->validator()
            ->boolean(
                'showNicknames',
                (bool) $this->module->getPreference(
                    'default_showNicknames',
                    '0'
                )
            );
    }

    /**
     * Returns true when individual names should be rendered inside arc
     * segments.
     *
     * @return bool
     */
    public function getShowNames(): bool
    {
        if ($this->showNames !== null) {
            return $this->showNames;
        }

        $displayMode = $this->resolveDisplayMode();

        if ($displayMode !== null) {
            return $this->showNames = in_array($displayMode, ['both', 'names'], true);
        }

        return $this->showNames = $this->validator()
            ->boolean(
                'showNames',
                (bool) $this->module->getPreference(
                    'default_showNames',
                    '1'
                )
            );
    }

    /**
     * Resolves the displayMode parameter from the request. Returns null if not
     * present, allowing fallback to the individual showNames/showImages
     * parameters.
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
     * Returns the count of innermost arc rings that receive the wider
     * "detailed" layout.
     *
     * @return int
     */
    public function getInnerArcs(): int
    {
        if ($this->innerArcs !== null) {
            return $this->innerArcs;
        }

        return $this->innerArcs = $this->validator()
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
     * Returns true when the SVG download button should be hidden from the chart
     * toolbar.
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
     * Returns true when the PNG download button should be hidden from the chart
     * toolbar.
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
        if ($this->paternalColor !== null) {
            return $this->paternalColor;
        }

        return $this->paternalColor = $this->validator()
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
        if ($this->maternalColor !== null) {
            return $this->maternalColor;
        }

        return $this->maternalColor = $this->validator()
            ->string(
                'maternalColor',
                $this->module->getPreference(
                    'default_maternalColor',
                    self::MATERNAL_COLOR_DEFAULT
                )
            );
    }

    /**
     * Returns the dropdown options for the name-abbreviation strategy in the
     * admin config form. Keyed by the persisted enum value.
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
     * Returns the name-abbreviation strategy as stored. One of {@see
     * NameAbbreviation::AUTO}, GIVEN or SURNAME. The chart-render path resolves
     * AUTO to GIVEN/SURNAME via the tree's SURNAME_TRADITION before serialising
     * to the JS config — see {@see Module::getChartParameters()}.
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
     * Centralising the list here keeps the three call sites in sync — dropping
     * one parameter from a single URL silently flipped toggles back to module
     * preference defaults on navigation.
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
            self::PLACE_FORMAT_PARAM  => $this->getPlaceFormatChoice()->value,
            'showParentMarriageDates' => $this->getShowParentMarriageDates() ? '1' : '0',
            'showImages'              => $this->getShowImages() ? '1' : '0',
            'showNames'               => $this->getShowNames() ? '1' : '0',
            'showNicknames'           => $this->getShowNicknames() ? '1' : '0',
            'innerArcs'               => $this->getInnerArcs(),
            'paternalColor'           => $this->getPaternalColor(),
            'maternalColor'           => $this->getMaternalColor(),
            'showDescendants'         => $this->getShowDescendants() ? '1' : '0',
        ];
    }
}
