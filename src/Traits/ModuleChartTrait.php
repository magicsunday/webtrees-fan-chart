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
use Fisharebest\Webtrees\Menu;

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
    use \Fisharebest\Webtrees\Module\ModuleChartTrait;

    /**
     * Returns the CSS class applied to the chart menu item.
     */
    public function chartMenuClass(): string
    {
        return 'menu-chart-fanchart';
    }

    /**
     * Returns the chart menu entry shown in the individual's chart box context menu.
     *
     * @return Menu|null
     */
    public function chartBoxMenu(Individual $individual): ?Menu
    {
        return $this->chartMenu($individual);
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

    /**
     * Builds the URL for the fan chart rooted at the given individual.
     * Additional route parameters (e.g. generations, ajax) can be merged via $parameters.
     *
     * @param array<array<string>|bool|int|string|null> $parameters
     *
     * @return string
     */
    public function chartUrl(
        Individual $individual,
        array $parameters = [],
    ): string {
        return route(
            self::ROUTE_DEFAULT,
            [
                'xref' => $individual->xref(),
                'tree' => $individual->tree()->name(),
            ] + $parameters
        );
    }
}
