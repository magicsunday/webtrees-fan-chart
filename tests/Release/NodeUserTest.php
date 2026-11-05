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
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function dirname;
use function posix_getgid;
use function posix_getuid;
use function proc_close;
use function proc_open;
use function stream_get_contents;
use function sys_get_temp_dir;

/**
 * Tests which npm targets of Make/node.mk and Make/dev.mk run as the owner of the checkout, using make dry runs.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class NodeUserTest extends TestCase
{
    /**
     * A target that writes into the checkout runs npm as the numeric user and group of the caller,
     * so no root-owned file lands in the bind mount.
     */
    #[Test]
    #[DataProvider('writingTargets')]
    public function runsWritingTargetsAsTheCallingUser(string $target): void
    {
        [$status, $output] = $this->dryRun($target);

        self::assertSame(0, $status);
        self::assertStringContainsString('--user ' . posix_getuid() . ':' . posix_getgid(), $output);
        self::assertStringContainsString('HOME=/tmp', $output);
    }

    /**
     * Targets that need root keep it, because make clean removes files that an earlier run left behind.
     */
    #[Test]
    public function keepsRootForTheCleanTarget(): void
    {
        [$status, $output] = $this->dryRun('clean');

        self::assertSame(0, $status);
        self::assertStringContainsString('rm -rf node_modules', $output);
        self::assertStringNotContainsString('--user', $output);
    }

    /**
     * The lang targets install gettext with apk and the lint target only reads, so both stay with root.
     */
    #[Test]
    #[DataProvider('rootTargets')]
    public function keepsRootForTheOtherTargets(string $target): void
    {
        [$status, $output] = $this->dryRun($target);

        self::assertSame(0, $status);
        self::assertStringNotContainsString('--user', $output);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function writingTargets(): array
    {
        return [
            'install'          => ['install'],
            'build'            => ['build'],
            'watch'            => ['watch'],
            'lint-fix'         => ['lint-fix'],
            'unlink-chart-lib' => ['unlink-chart-lib'],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function rootTargets(): array
    {
        return [
            'lint'         => ['lint'],
            'lang-compile' => ['lang-compile'],
        ];
    }

    /**
     * Returns the exit status and the commands that make would run for the target, without running any of them.
     *
     * @return array{int, string}
     */
    private function dryRun(string $target): array
    {
        $process = proc_open(
            ['make', '--dry-run', $target],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            dirname(__DIR__, 2),
            ['PATH' => '/usr/local/bin:/usr/bin:/bin', 'HOME' => sys_get_temp_dir()]
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
