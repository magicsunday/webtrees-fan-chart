<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Fisharebest\Webtrees\View;
use MagicSunday\Webtrees\ModuleBase\View\SharedViews;

/**
 * Registers the views of the module and replaces the two components of the webtrees core that the
 * views of the module render, so a view of the module can be rendered without a webtrees installation.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class ViewFixture
{
    /**
     * The name under which the module registers its views.
     */
    public const string MODULE_NAME = 'webtrees-fan-chart';

    /**
     * The namespace of the stand-ins for the components of the webtrees core.
     */
    private const string STUB_NAMESPACE = 'fan-test';

    /**
     * Registers the views of the module and of the module base and redirects the core components that
     * they use to stand-ins. The stand-ins keep the parts that the tests look at: the name, the value and
     * the checked state of a checkbox.
     */
    public static function register(): void
    {
        View::registerNamespace(self::MODULE_NAME, __DIR__ . '/../../resources/views/');
        View::registerNamespace(self::STUB_NAMESPACE, __DIR__ . '/views/');
        SharedViews::register();

        View::registerCustomView('::components/checkbox', self::STUB_NAMESPACE . '::checkbox');
        View::registerCustomView('::components/select-individual', self::STUB_NAMESPACE . '::select-individual');
    }
}
