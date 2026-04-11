<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Processor;

use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Place;

/**
 * Extracts birth, death, and marriage place names from an individual's life
 * events. Returns both full GEDCOM place strings (for tooltips) and shortened
 * versions truncated to a configurable number of hierarchy levels (for arc text).
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class PlaceProcessor
{
    /**
     * @param Individual $individual The individual to process
     * @param int        $placeParts Number of place hierarchy parts to show in arcs (0 = full)
     */
    public function __construct(
        private readonly Individual $individual,
        private readonly int $placeParts,
    ) {
    }

    /**
     * Returns the full GEDCOM birth place name for tooltip display.
     *
     * @return string
     */
    public function getBirthPlace(): string
    {
        return $this->fullPlaceName($this->individual->getBirthPlace());
    }

    /**
     * Returns the full GEDCOM death place name for tooltip display.
     *
     * @return string
     */
    public function getDeathPlace(): string
    {
        return $this->fullPlaceName($this->individual->getDeathPlace());
    }

    /**
     * Returns the full GEDCOM marriage place name (from the individual's first spouse family)
     * for tooltip display. Empty string when no spouse family exists.
     *
     * @return string
     */
    public function getMarriagePlace(): string
    {
        $family = $this->individual->spouseFamilies()->first();

        if ($family === null) {
            return '';
        }

        return $this->fullPlaceName($family->getMarriagePlace());
    }

    /**
     * Returns the birth place name truncated to the configured number of hierarchy levels,
     * for use in arc text where space is limited.
     *
     * @return string
     */
    public function getBirthPlaceShort(): string
    {
        return $this->shortPlaceName($this->individual->getBirthPlace());
    }

    /**
     * Returns the death place name truncated to the configured number of hierarchy levels,
     * for use in arc text where space is limited.
     *
     * @return string
     */
    public function getDeathPlaceShort(): string
    {
        return $this->shortPlaceName($this->individual->getDeathPlace());
    }

    /**
     * Returns the unmodified GEDCOM place name string.
     *
     * @param Place $place
     *
     * @return string
     */
    private function fullPlaceName(Place $place): string
    {
        return $place->gedcomName();
    }

    /**
     * Returns a shortened place name according to the configured
     * number of hierarchy parts. This method is stateless — it only
     * uses the placeParts scalar, not any individual-specific state.
     *
     * @param Place $place
     *
     * @return string
     *
     * @internal Used by DataFacade for marriage place formatting
     */
    public function shortPlaceName(Place $place): string
    {
        $placeName = $place->gedcomName();

        if ($placeName === '') {
            return '';
        }

        if ($this->placeParts === 0) {
            return $placeName;
        }

        return $place->firstParts($this->placeParts)->implode(', ');
    }
}
