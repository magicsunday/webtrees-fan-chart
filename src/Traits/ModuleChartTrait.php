<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Traits;

use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use MagicSunday\Webtrees\ModuleBase\Traits\ModuleChartTrait as BaseModuleChartTrait;

/**
 * Implements the webtrees ModuleChartInterface methods specific to the fan chart:
 * menu CSS class, chart box menu entry, title, and URL generation.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
trait ModuleChartTrait
{
    use BaseModuleChartTrait;

    /**
     * Returns the CSS class applied to the chart menu item.
     */
    public function chartMenuClass(): string
    {
        return 'menu-chart-fanchart';
    }

    /**
     * Returns the localised chart title shown in the chart box menu and page headings.
     *
     * @return string
     */
    public function chartTitle(Individual $individual): string
    {
        return I18N::translate('Fan chart of %s', $individual->fullName());
    }
}
