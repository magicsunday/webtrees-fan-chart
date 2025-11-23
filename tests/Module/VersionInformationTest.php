<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Module;

use Fisharebest\Webtrees\Cache;
use Fisharebest\Webtrees\Contracts\CacheFactoryInterface;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Registry;
use MagicSunday\Webtrees\FanChart\Module\VersionInformation;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Cache\Adapter\ArrayAdapter;

#[CoversClass(VersionInformation::class)]
/**
 * Confirms version information retrieval behaviour for the module.
 */
final class VersionInformationTest extends TestCase
{
    /**
     * Ensures the current module version is returned when no remote URL is provided.
     */
    #[Test]
    public function fetchLatestVersionFallsBackToCustomWhenUrlMissing(): void
    {
        $factory = new class implements CacheFactoryInterface {
            public function array(): Cache
            {
                return new Cache(new ArrayAdapter());
            }

            public function file(): Cache
            {
                return new Cache(new ArrayAdapter());
            }
        };

        Registry::cache($factory);

        $module = $this->createMock(ModuleCustomInterface::class);
        $module->method('customModuleLatestVersionUrl')->willReturn('');
        $module->method('customModuleVersion')->willReturn('3.0.1');
        $module->method('name')->willReturn('webtrees-fan-chart');

        $versionInformation = new VersionInformation($module);

        self::assertSame('3.0.1', $versionInformation->fetchLatestVersion());
    }
}
