<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Aura\Router\RouterContainer;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Gedcom;
use Fisharebest\Webtrees\GuestUser;
use Fisharebest\Webtrees\Http\Routes\WebRoutes;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Services\GedcomImportService;
use Fisharebest\Webtrees\Services\MigrationService;
use Fisharebest\Webtrees\Services\TreeService;
use Fisharebest\Webtrees\Services\UserService;
use Fisharebest\Webtrees\Site;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\Webtrees;
use Illuminate\Database\Schema\Blueprint;
use Psr\Http\Message\ServerRequestFactoryInterface;
use Psr\Http\Message\ServerRequestInterface;

use function preg_split;

/**
 * Boots webtrees on a real schema in memory, logs in an administrator and imports a GEDCOM
 * the way the import of a tree runs in production, so that a test drives the real record
 * factories, the real privacy engine and the real queries.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
trait RealTreeFixtureTrait
{
    /**
     * Boots webtrees, builds a fresh schema in memory and logs in an administrator.
     */
    private function bootRealWebtrees(): void
    {
        Site::$preferences = [];
        (new Webtrees())->bootstrap();
        I18N::init('en-US', true);

        DB::connect(
            driver: DB::SQLITE,
            host: '',
            port: '',
            database: ':memory:',
            username: '',
            password: '',
            prefix: 'wt_',
            key: '',
            certificate: '',
            ca: '',
            verify_certificate: false,
        );

        $migrationService = new MigrationService();
        $migrationService->updateSchema('\Fisharebest\Webtrees\Schema', 'WT_SCHEMA_VERSION', Webtrees::SCHEMA_VERSION);
        $migrationService->seedDatabase();

        I18N::init('en-US');
        (new Gedcom())->registerTags(Registry::elementFactory(), true);

        $routerContainer = new RouterContainer('/');
        (new WebRoutes())->load($routerContainer->getMap());
        Registry::container()->set(RouterContainer::class, $routerContainer);

        $requestFactory = Registry::container()->get(ServerRequestFactoryInterface::class);
        self::assertInstanceOf(ServerRequestFactoryInterface::class, $requestFactory);

        Registry::container()->set(
            ServerRequestInterface::class,
            $requestFactory
                ->createServerRequest('GET', 'https://webtrees.test/index.php')
                ->withAttribute('base_url', 'https://webtrees.test')
                ->withAttribute('client-ip', '127.0.0.1')
                ->withAttribute('user', new GuestUser())
        );

        $admin = (new UserService())->create('admin', 'Admin', 'admin@example.test', 'secret');
        $admin->setPreference(UserInterface::PREF_IS_ADMINISTRATOR, '1');
        Auth::login($admin);
    }

    /**
     * Replaces the real schema by the minimal in-memory database that the other tests of the suite
     * expect, which holds the module settings only and has no foreign keys. The settings fixture of
     * the module base boots that database once per process and then reuses the global connection,
     * so the connection of a test that booted the real schema must not outlive it.
     */
    private function restoreMinimalDatabase(): void
    {
        DB::connect(
            driver: DB::SQLITE,
            host: '',
            port: '',
            database: ':memory:',
            username: '',
            password: '',
            prefix: '',
            key: '',
            certificate: '',
            ca: '',
            verify_certificate: false,
        );

        DB::connection()->getSchemaBuilder()->create('module_setting', static function (Blueprint $table): void {
            $table->string('module_name');
            $table->string('setting_name');
            $table->string('setting_value');
        });
    }

    /**
     * Imports a GEDCOM as the logged-in administrator into a new tree, record by record.
     *
     * @param string $gedcom The GEDCOM text
     * @param string $name   The name and title of the new tree
     *
     * @return Tree The new tree with the imported records
     */
    private function importGedcom(string $gedcom, string $name): Tree
    {
        $service = new GedcomImportService();
        $tree    = (new TreeService($service))->create($name, $name);

        foreach (
            [
                'individuals' => 'i_file',
                'families'    => 'f_file',
                'other'       => 'o_file',
                'name'        => 'n_file',
                'dates'       => 'd_file',
                'places'      => 'p_file',
                'placelinks'  => 'pl_file',
                'link'        => 'l_file',
                'media'       => 'm_file',
                'media_file'  => 'm_file',
            ] as $table => $column
        ) {
            DB::table($table)->where($column, '=', $tree->id())->delete();
        }

        $records = preg_split('/\n(?=0)/', $gedcom);
        self::assertIsArray($records);

        foreach ($records as $record) {
            $service->importRecord($record, $tree, false);
        }

        return $tree;
    }
}
