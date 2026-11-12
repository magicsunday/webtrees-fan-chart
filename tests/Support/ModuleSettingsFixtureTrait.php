<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Fisharebest\Webtrees\Services\ChartService;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Module;
use MagicSunday\Webtrees\ModuleBase\Testing\ModuleSettingsFixture;

/**
 * Provides a module whose preferences come from a real in-memory database.
 *
 * AbstractModule::getPreference() is final and cannot be stubbed, and the real
 * implementation reads from the `module_setting` table, so the tests that need
 * preferences seed it through the shared settings fixture of the module base.
 */
trait ModuleSettingsFixtureTrait
{
    /**
     * Seeds the given preferences through the shared settings fixture of the module base and builds
     * the module that reads them.
     *
     * @param array<string, string> $preferences The preferences to seed, keyed by setting name
     *
     * @return Module The module that reads them
     */
    private function createModuleWithPreferences(array $preferences): Module
    {
        ModuleSettingsFixture::seed('webtrees-fan-chart', $preferences);

        $chartService = self::createStub(ChartService::class);
        $module       = new Module($chartService, new DataFacade());

        $module->setName('webtrees-fan-chart');

        return $module;
    }
}
