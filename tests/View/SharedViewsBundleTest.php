<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\View;

use MagicSunday\Webtrees\FanChart\Test\Release\ModuleParameters;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

use function array_diff;
use function array_unique;
use function array_values;
use function dirname;
use function file_get_contents;
use function preg_match_all;
use function sort;
use function str_ends_with;

/**
 * The release archive bundles only the module base views that Make/module.mk names. A development
 * checkout has every view of the module base, so a view that the module renders but the list leaves
 * out only fails in the archive. This test reads the views of the module and pins that each shared
 * view that they render is on the list.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class SharedViewsBundleTest extends TestCase
{
    /**
     * Every shared view that a view of the module renders is bundled into the release archive.
     */
    #[Test]
    public function bundlesEverySharedViewThatTheViewsOfTheModuleRender(): void
    {
        $rendered = self::renderedSharedViews();

        self::assertNotSame([], $rendered, 'the scan finds the shared views that the module renders');

        self::assertSame([], array_values(array_diff($rendered, ModuleParameters::sharedViews())));
    }

    /**
     * Reads the names of the shared views that the views of the module render through the namespace
     * of the module base.
     *
     * @return list<string>
     */
    private static function renderedSharedViews(): array
    {
        $directory = dirname(__DIR__, 2) . '/resources/views';
        $names     = [];

        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory)) as $file) {
            if (!str_ends_with($file->getPathname(), '.phtml')) {
                continue;
            }

            $contents = file_get_contents($file->getPathname());

            self::assertIsString($contents, $file->getPathname());

            preg_match_all("/SharedViews::NAMESPACE\s*\.\s*'::([a-z0-9-]+)'/", $contents, $matches);

            foreach ($matches[1] as $name) {
                $names[] = $name;
            }
        }

        $names = array_values(array_unique($names));

        sort($names);

        return $names;
    }
}
