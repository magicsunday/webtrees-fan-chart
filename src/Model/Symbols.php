<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Model;

/**
 * Genealogical symbol constants used in date labels and tooltips.
 *
 * These mirror the JS constants defined in resources/js/modules/custom/hierarchy.js
 * (SYMBOL_BIRTH, SYMBOL_DEATH, SYMBOL_MARRIAGE).
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class Symbols
{
    /**
     * Birth symbol (asterisk).
     */
    public const string SYMBOL_BIRTH = '*';

    /**
     * Death symbol (dagger / obelisk).
     */
    public const string SYMBOL_DEATH = "\u{2020}";

    /**
     * Marriage symbol (joined rings).
     */
    public const string SYMBOL_MARRIAGE = "\u{26AD}";

    /**
     * Placeholder returned when a marriage fact exists but has no date.
     * The JS side checks for this sentinel to display the marriage symbol
     * without an accompanying date string.
     */
    public const string MARRIAGE_DATE_UNKNOWN = '?';
}
