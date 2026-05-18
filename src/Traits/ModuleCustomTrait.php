<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Traits;

use MagicSunday\Webtrees\ModuleBase\Traits\ModuleCustomTrait as BaseModuleCustomTrait;

/**
 * Supplies ModuleCustomInterface metadata (author, version, support URL) and
 * loads compiled MO translation files for the module's supported languages.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
trait ModuleCustomTrait
{
    use BaseModuleCustomTrait;
}
