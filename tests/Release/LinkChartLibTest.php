<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Release;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function chmod;
use function dirname;
use function file_get_contents;
use function file_put_contents;
use function is_link;
use function mkdir;
use function posix_getgid;
use function posix_getuid;
use function readlink;
use function realpath;
use function symlink;
use function sys_get_temp_dir;
use function tempnam;
use function unlink;

/**
 * Tests the link-chart-lib and unlink-chart-lib targets of Make/dev.mk in a copy of the module that sits next to a sibling chart-lib clone.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class LinkChartLibTest extends TestCase
{
    /**
     * Runs the commands of the scratch copy.
     */
    private ProcessRunner $processRunner;

    /**
     * Scratch directory that holds the module copy, the sibling clone and the stub docker command.
     */
    private string $workDir = '';

    /**
     * Builds the module copy next to a sibling directory and puts a stub docker command first on the path.
     * The stub answers the compose probe, logs every other call and creates the package like npm install does, unless
     * the marker file docker-fails exists, which makes every other call fail. A stub rm acts like the real one, unless the
     * marker file rm-fails exists, which makes it fail.
     */
    protected function setUp(): void
    {
        $this->processRunner = new ProcessRunner();

        $base = tempnam(sys_get_temp_dir(), 'link-chart-lib-');
        self::assertIsString($base);

        unlink($base);

        $this->workDir = $base;

        mkdir($this->workDir . '/bin', 0o777, true);
        mkdir($this->workDir . '/module', 0o777, true);

        $root = dirname(__DIR__, 2);

        $this->processRunner->execute(['cp', '-R', $root . '/Makefile', $root . '/Make', $this->workDir . '/module/'], $this->workDir);

        file_put_contents(
            $this->workDir . '/bin/docker',
            "#!/bin/sh\n"
            . "if [ \"\$1\" = compose ] && [ \"\$2\" = version ]; then exit 0; fi\n"
            . "echo \"\$@\" >> \"$this->workDir/docker-calls\"\n"
            . "if [ -f \"$this->workDir/docker-fails\" ]; then exit 1; fi\n"
            . "mkdir -p node_modules/@magicsunday/webtrees-chart-lib\n"
            . "echo restored > node_modules/@magicsunday/webtrees-chart-lib/package.json\n"
            . "exit 0\n"
        );
        chmod($this->workDir . '/bin/docker', 0o755);

        file_put_contents(
            $this->workDir . '/bin/rm',
            "#!/bin/sh\n"
            . "if [ -f \"$this->workDir/rm-fails\" ]; then echo \"rm: cannot remove\" >&2; exit 1; fi\n"
            . "exec /bin/rm \"\$@\"\n"
        );
        chmod($this->workDir . '/bin/rm', 0o755);
    }

    /**
     * Removes the scratch directory.
     */
    protected function tearDown(): void
    {
        $this->processRunner->execute(['rm', '-rf', $this->workDir], sys_get_temp_dir());
    }

    /**
     * The package entry becomes a link with a relative target that resolves to the sibling clone.
     */
    #[Test]
    public function linksTheSiblingCloneWithARelativeTarget(): void
    {
        mkdir($this->workDir . '/webtrees-chart-lib', 0o777, true);

        file_put_contents($this->workDir . '/webtrees-chart-lib/package.json', '{}');

        [$status] = $this->make('link-chart-lib');

        self::assertSame(0, $status);
        self::assertTrue(is_link($this->packagePath()));
        self::assertSame('../../../webtrees-chart-lib', readlink($this->packagePath()));
        self::assertSame(realpath($this->workDir . '/webtrees-chart-lib'), realpath($this->packagePath()));
    }

    /**
     * A package directory that npm installed is replaced by the link.
     */
    #[Test]
    public function replacesAnInstalledPackageDirectoryWithTheLink(): void
    {
        mkdir($this->workDir . '/webtrees-chart-lib', 0o777, true);
        mkdir($this->packagePath(), 0o777, true);

        file_put_contents($this->workDir . '/webtrees-chart-lib/package.json', '{}');
        file_put_contents($this->packagePath() . '/installed.json', '{}');

        [$status] = $this->make('link-chart-lib');

        self::assertSame(0, $status);
        self::assertTrue(is_link($this->packagePath()));
        self::assertFileDoesNotExist($this->packagePath() . '/installed.json');
    }

    /**
     * Without the sibling clone the target fails and leaves the installed package alone.
     */
    #[Test]
    public function failsWithoutTheSiblingCloneAndKeepsTheInstalledPackage(): void
    {
        $this->assertLinkIsRefusedAndTheInstalledPackageStays();
    }

    /**
     * A sibling directory without the package manifest is no clone, for example the empty directory that a compose
     * bind mount leaves behind. The target fails and leaves the installed package alone.
     */
    #[Test]
    public function failsWithAnEmptySiblingDirectoryAndKeepsTheInstalledPackage(): void
    {
        mkdir($this->workDir . '/webtrees-chart-lib', 0o777, true);

        $this->assertLinkIsRefusedAndTheInstalledPackageStays();
    }

    /**
     * The link is removed before npm installs the package again, and the sibling clone stays as it was.
     */
    #[Test]
    public function unlinkRemovesTheLinkBeforeInstallingThePackageAgain(): void
    {
        mkdir($this->workDir . '/webtrees-chart-lib', 0o777, true);
        mkdir($this->workDir . '/module/node_modules/@magicsunday', 0o777, true);

        file_put_contents($this->workDir . '/webtrees-chart-lib/package.json', 'sibling');
        symlink('../../../webtrees-chart-lib', $this->packagePath());

        [$status] = $this->make('unlink-chart-lib');

        self::assertSame(0, $status);
        self::assertFalse(is_link($this->packagePath()));
        self::assertDirectoryExists($this->packagePath());
        self::assertSame("restored\n", file_get_contents($this->packagePath() . '/package.json'));
        self::assertSame('sibling', file_get_contents($this->workDir . '/webtrees-chart-lib/package.json'));
        self::assertSame(
            'compose run --rm --user ' . posix_getuid() . ':' . posix_getgid() . " -e HOME=/tmp node npm install --quiet\n",
            file_get_contents($this->workDir . '/docker-calls')
        );
    }

    /**
     * A real package directory is not a link, so unlink leaves it untouched and does not run the install.
     */
    #[Test]
    public function unlinkLeavesAnInstalledPackageDirectoryUntouched(): void
    {
        mkdir($this->packagePath(), 0o777, true);

        file_put_contents($this->packagePath() . '/package.json', 'installed');

        [$status, $output] = $this->make('unlink-chart-lib');

        self::assertSame(0, $status);
        self::assertStringContainsString('not a symlink', $output);
        self::assertFalse(is_link($this->packagePath()));
        self::assertSame('installed', file_get_contents($this->packagePath() . '/package.json'));
        self::assertFileDoesNotExist($this->workDir . '/docker-calls');
    }

    /**
     * Without a package entry there is nothing to unlink, so the target says so and does not run the install.
     */
    #[Test]
    public function unlinkReportsThatThereIsNothingToUnlink(): void
    {
        [$status, $output] = $this->make('unlink-chart-lib');

        self::assertSame(0, $status);
        self::assertStringContainsString('nothing to unlink', $output);
        self::assertFileDoesNotExist($this->workDir . '/docker-calls');
    }

    /**
     * A failing install after the link was removed fails the target and names the way back to a working package.
     */
    #[Test]
    public function unlinkReportsAFailedInstallAndNamesTheWayBack(): void
    {
        mkdir($this->workDir . '/webtrees-chart-lib', 0o777, true);
        mkdir($this->workDir . '/module/node_modules/@magicsunday', 0o777, true);

        symlink('../../../webtrees-chart-lib', $this->packagePath());
        file_put_contents($this->workDir . '/docker-fails', '');

        [$status, $output] = $this->make('unlink-chart-lib');

        self::assertNotSame(0, $status);
        self::assertStringContainsString('make install', $output);
        self::assertFalse(is_link($this->packagePath()));
        self::assertFileDoesNotExist($this->packagePath());
        self::assertSame(
            'compose run --rm --user ' . posix_getuid() . ':' . posix_getgid() . " -e HOME=/tmp node npm install --quiet\n",
            file_get_contents($this->workDir . '/docker-calls')
        );
    }

    /**
     * A link whose target is gone, as after the sibling clone was deleted, is still a link, so unlink removes it and
     * installs the package again.
     */
    #[Test]
    public function unlinkRemovesADanglingLinkAndInstallsThePackageAgain(): void
    {
        mkdir($this->workDir . '/module/node_modules/@magicsunday', 0o777, true);

        symlink('../../../webtrees-chart-lib', $this->packagePath());

        [$status] = $this->make('unlink-chart-lib');

        self::assertSame(0, $status);
        self::assertFalse(is_link($this->packagePath()));
        self::assertSame("restored\n", file_get_contents($this->packagePath() . '/package.json'));
        self::assertSame(
            'compose run --rm --user ' . posix_getuid() . ':' . posix_getgid() . " -e HOME=/tmp node npm install --quiet\n",
            file_get_contents($this->workDir . '/docker-calls')
        );
    }

    /**
     * When the link cannot be removed the target stops before the install, so the install cannot report a restored
     * package while the link is still in place.
     */
    #[Test]
    public function unlinkStopsBeforeTheInstallWhenTheLinkCannotBeRemoved(): void
    {
        mkdir($this->workDir . '/webtrees-chart-lib', 0o777, true);
        mkdir($this->workDir . '/module/node_modules/@magicsunday', 0o777, true);

        symlink('../../../webtrees-chart-lib', $this->packagePath());
        file_put_contents($this->workDir . '/rm-fails', '');

        [$status, $output] = $this->make('unlink-chart-lib');

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Could not remove', $output);
        self::assertTrue(is_link($this->packagePath()));
        self::assertFileDoesNotExist($this->workDir . '/docker-calls');
    }

    /**
     * Installs a package, runs the link target and asserts that it fails with the clone message and leaves the package
     * as it was.
     */
    private function assertLinkIsRefusedAndTheInstalledPackageStays(): void
    {
        mkdir($this->packagePath(), 0o777, true);

        file_put_contents($this->packagePath() . '/package.json', '{}');

        [$status, $output] = $this->make('link-chart-lib');

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Expected sibling clone at ../webtrees-chart-lib', $output);
        self::assertFalse(is_link($this->packagePath()));
        self::assertFileExists($this->packagePath() . '/package.json');
    }

    /**
     * Returns the path of the chart-lib package inside the module copy.
     */
    private function packagePath(): string
    {
        return $this->workDir . '/module/node_modules/@magicsunday/webtrees-chart-lib';
    }

    /**
     * Runs a make target in the module copy with the stub docker command on the path.
     *
     * @return array{int, string}
     */
    private function make(string $target): array
    {
        return $this->processRunner->execute(
            ['make', $target],
            $this->workDir . '/module',
            [
                'PATH' => $this->workDir . '/bin:/usr/local/bin:/usr/bin:/bin',
                'HOME' => $this->workDir,
            ]
        );
    }
}
