<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Services\ChartService;
use Illuminate\Database\Schema\Blueprint;
use MagicSunday\Webtrees\FanChart\Facade\DataFacade;
use MagicSunday\Webtrees\FanChart\Module;
use ReflectionProperty;

use function array_keys;
use function array_map;

/**
 * Provides a module whose preferences come from a real in-memory database.
 *
 * AbstractModule::getPreference() is final and cannot be stubbed, and the real
 * implementation reads from the `module_setting` table, so the tests that need
 * preferences boot a minimal SQLite schema for it.
 */
trait ModuleSettingsFixtureTrait
{
    /**
     * Boots an in-memory SQLite + minimal `module_setting` schema once per
     * test class that uses this trait, because the static flag is kept per
     * using class. Subsequent calls in the same class just truncate the table
     * and re-seed.
     *
     * @param array<string, string> $preferences The preferences to seed, keyed by setting name
     *
     * @return Module The module that reads them
     */
    private function createModuleWithPreferences(array $preferences): Module
    {
        static $initialised = false;

        if ($initialised === false) {
            $database = new DB();
            $database->addConnection([
                'driver'   => 'sqlite',
                'database' => ':memory:',
            ]);
            $database->setAsGlobal();
            $database->bootEloquent();
            DB::connection()->getSchemaBuilder()->create('module_setting', static function (Blueprint $table): void {
                $table->string('module_name');
                $table->string('setting_name');
                $table->string('setting_value');
            });

            $initialised = true;
        }

        DB::table('module_setting')->delete();
        DB::table('module_setting')->insert(
            array_map(
                static fn (string $name, string $value): array => [
                    'module_name'   => 'webtrees-fan-chart',
                    'setting_name'  => $name,
                    'setting_value' => $value,
                ],
                array_keys($preferences),
                $preferences
            )
        );

        $chartService = self::createStub(ChartService::class);
        $module       = new Module($chartService, new DataFacade());

        $reflection = new ReflectionProperty(AbstractModule::class, 'name');
        $reflection->setValue($module, 'webtrees-fan-chart');

        return $module;
    }
}
