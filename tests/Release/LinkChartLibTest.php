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
use function proc_close;
use function proc_open;
use function readlink;
use function realpath;
use function stream_get_contents;
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
     * Scratch directory that holds the module copy, the sibling clone and the stub docker command.
     */
    private string $workDir = '';

    /**
     * Builds the module copy next to a sibling directory and puts a stub docker command first on the path.
     * The stub answers the compose probe, logs every other call and creates the package like npm install does.
     */
    protected function setUp(): void
    {
        $base = tempnam(sys_get_temp_dir(), 'link-chart-lib-');
        self::assertIsString($base);

        unlink($base);

        $this->workDir = $base;

        mkdir($this->workDir . '/bin', 0o777, true);
        mkdir($this->workDir . '/module', 0o777, true);

        $root = dirname(__DIR__, 2);

        $this->execute(['cp', '-R', $root . '/Makefile', $root . '/Make', $this->workDir . '/module/'], $this->workDir);

        file_put_contents(
            $this->workDir . '/bin/docker',
            "#!/bin/sh\n"
            . "if [ \"\$1\" = compose ] && [ \"\$2\" = version ]; then exit 0; fi\n"
            . "echo \"\$@\" >> \"$this->workDir/docker-calls\"\n"
            . "mkdir -p node_modules/@magicsunday/webtrees-chart-lib\n"
            . "echo restored > node_modules/@magicsunday/webtrees-chart-lib/package.json\n"
            . "exit 0\n"
        );
        chmod($this->workDir . '/bin/docker', 0o755);
    }

    /**
     * Removes the scratch directory.
     */
    protected function tearDown(): void
    {
        $this->execute(['rm', '-rf', $this->workDir], sys_get_temp_dir());
    }

    /**
     * The package entry becomes a link with a relative target that resolves to the sibling clone.
     */
    #[Test]
    public function linksTheSiblingCloneWithARelativeTarget(): void
    {
        mkdir($this->workDir . '/webtrees-chart-lib', 0o777, true);

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

        file_put_contents($this->packagePath() . '/package.json', '{}');

        [$status] = $this->make('link-chart-lib');

        self::assertSame(0, $status);
        self::assertTrue(is_link($this->packagePath()));
        self::assertFileDoesNotExist($this->packagePath() . '/package.json');
    }

    /**
     * Without the sibling clone the target fails and leaves the installed package alone.
     */
    #[Test]
    public function failsWithoutTheSiblingCloneAndKeepsTheInstalledPackage(): void
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
        return $this->execute(
            ['make', $target],
            $this->workDir . '/module',
            [
                'PATH' => $this->workDir . '/bin:/usr/local/bin:/usr/bin:/bin',
                'HOME' => $this->workDir,
            ]
        );
    }

    /**
     * Runs a command without a shell and returns its exit status together with the standard output and error.
     *
     * @param list<string>          $command
     * @param array<string, string> $environment
     *
     * @return array{int, string}
     */
    private function execute(array $command, string $workingDirectory, array $environment = ['PATH' => '/usr/local/bin:/usr/bin:/bin']): array
    {
        $process = proc_open(
            $command,
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            $workingDirectory,
            $environment
        );

        self::assertIsResource($process);

        $standardOutput = $pipes[1] ?? null;
        $standardError  = $pipes[2] ?? null;

        self::assertIsResource($standardOutput);
        self::assertIsResource($standardError);

        $output = stream_get_contents($standardOutput) . stream_get_contents($standardError);

        return [proc_close($process), $output];
    }
}
