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

use function array_diff;
use function array_values;
use function chmod;
use function dirname;
use function file_put_contents;
use function is_dir;
use function is_file;
use function mkdir;
use function proc_close;
use function proc_open;
use function scandir;
use function stream_get_contents;
use function sys_get_temp_dir;
use function tempnam;
use function unlink;

/**
 * Tests the release-publish target of Make/release.mk against stubbed git and gh commands.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class ReleasePublishTest extends TestCase
{
    private string $workDir = '';

    protected function setUp(): void
    {
        $base = tempnam(sys_get_temp_dir(), 'release-publish-');
        self::assertIsString($base);

        unlink($base);

        $this->workDir = $base;

        mkdir($this->workDir . '/bin', 0o777, true);
        mkdir($this->workDir . '/tmp', 0o777, true);
        mkdir($this->workDir . '/module', 0o777, true);

        $root = dirname(__DIR__, 2);

        $this->execute(['cp', '-R', $root . '/Makefile', $root . '/Make', $this->workDir . '/module/'], $this->workDir);

        file_put_contents($this->workDir . '/module/webtrees-fan-chart.zip', 'archive');

        $this->installStub('git', "#!/bin/sh\nexit 0\n");
    }

    protected function tearDown(): void
    {
        $this->execute(['rm', '-rf', $this->workDir], sys_get_temp_dir());
    }

    /**
     * A failed gh release create must fail the target, keep the archive and still remove the notes file.
     */
    #[Test]
    public function failsWhenTheReleaseCannotBeCreated(): void
    {
        $this->installStub(
            'gh',
            "#!/bin/sh\n"
            . "if [ \"\$1\" = release ]; then echo 'gh: release failed' >&2; exit 3; fi\n"
            . "echo stub\n"
        );

        [$status, $output] = $this->publish();

        self::assertNotSame(0, $status);
        self::assertStringNotContainsString('RELEASE_PUBLISHED', $output);
        self::assertFileExists($this->workDir . '/module/webtrees-fan-chart.zip');
        self::assertSame([], $this->leftoverTemporaryFiles());
    }

    /**
     * A failed generation of the release notes must fail the target before a release is created.
     */
    #[Test]
    public function failsWhenTheReleaseNotesCannotBeGenerated(): void
    {
        $this->installStub(
            'gh',
            "#!/bin/sh\n"
            . "if [ \"\$1\" = release ]; then touch \"$this->workDir/release-created\"; exit 0; fi\n"
            . "echo 'gh: notes failed' >&2; exit 4\n"
        );

        [$status, $output] = $this->publish();

        self::assertNotSame(0, $status);
        self::assertStringNotContainsString('RELEASE_PUBLISHED', $output);
        self::assertFalse(is_file($this->workDir . '/release-created'));
        self::assertFileExists($this->workDir . '/module/webtrees-fan-chart.zip');
        self::assertSame([], $this->leftoverTemporaryFiles());
    }

    /**
     * A working gh reports the publication and removes the archive.
     */
    #[Test]
    public function reportsThePublicationWhenTheReleaseIsCreated(): void
    {
        $this->installStub('gh', "#!/bin/sh\necho stub\n");

        [$status, $output] = $this->publish();

        self::assertSame(0, $status);
        self::assertStringContainsString('RELEASE_PUBLISHED version=9.9.9', $output);
        self::assertFalse(is_file($this->workDir . '/module/webtrees-fan-chart.zip'));
        self::assertSame([], $this->leftoverTemporaryFiles());
    }

    /**
     * @return list<string>
     */
    private function leftoverTemporaryFiles(): array
    {
        $entries = scandir($this->workDir . '/tmp');

        self::assertIsArray($entries);

        return array_values(array_diff($entries, ['.', '..']));
    }

    private function installStub(string $name, string $script): void
    {
        self::assertTrue(is_dir($this->workDir . '/bin'));

        file_put_contents($this->workDir . '/bin/' . $name, $script);
        chmod($this->workDir . '/bin/' . $name, 0o755);
    }

    /**
     * @return array{int, string}
     */
    private function publish(): array
    {
        return $this->execute(['make', 'release-publish', 'VERSION=9.9.9'], $this->workDir . '/module', [
            'PATH'   => $this->workDir . '/bin:/usr/local/bin:/usr/bin:/bin',
            'TMPDIR' => $this->workDir . '/tmp',
            'HOME'   => $this->workDir,
        ]);
    }

    /**
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
