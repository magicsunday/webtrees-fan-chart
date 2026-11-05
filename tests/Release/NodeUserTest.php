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
use function proc_close;
use function proc_open;
use function shell_exec;
use function stream_get_contents;
use function sys_get_temp_dir;
use function trim;

/**
 * Tests which targets of Make/node.mk, Make/dev.mk and Make/lint.mk run npm as the owner of the checkout, using make dry runs.
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
     * so no root-owned file lands in the bind mount. The user, the environment and the service name
     * follow each other in one piece, because options placed behind the service name would reach npm.
     */
    #[Test]
    #[DataProvider('writingTargets')]
    public function runsWritingTargetsAsTheCallingUser(string $target, string $npmCommand): void
    {
        [$status, $output] = $this->dryRun($target);

        self::assertSame(0, $status);
        self::assertStringContainsString(
            '--user ' . $this->identity() . ' -e HOME=/tmp node ' . $npmCommand . "\n",
            $output
        );
    }

    /**
     * Targets that need root keep it and run the expected command, because the catch-all rule of the
     * Makefile turns a removed target into a successful dry run without any command.
     */
    #[Test]
    #[DataProvider('rootTargets')]
    public function keepsRootForTheTargetsThatNeedIt(string $target, string $command): void
    {
        [$status, $output] = $this->dryRun($target);

        self::assertSame(0, $status);
        self::assertStringContainsString(' run --rm node ' . $command, $output);
        self::assertStringNotContainsString('--user', $output);
    }

    /**
     * The repair target runs as root and changes only files that belong to root to the numeric user and
     * group of the caller. It changes a symbolic link itself and never the file the link points to, because
     * a link that points out of the checkout would otherwise hand a foreign file to the caller.
     */
    #[Test]
    public function fixOwnerGivesRootFilesBackToTheCallingUser(): void
    {
        [$status, $output] = $this->dryRun('fix-owner');

        self::assertSame(0, $status);
        self::assertStringContainsString(
            ' run --rm node find . -xdev -user 0 -exec chown -h ' . $this->identity() . " {} +\n",
            $output
        );
        self::assertStringNotContainsString('--user', $output);
    }

    /**
     * Provides the targets that write into the checkout with the npm command each of them starts.
     *
     * @return array<string, array{string, string}> The npm command by target name
     */
    public static function writingTargets(): array
    {
        return [
            'install'          => ['install', 'npm install'],
            'build'            => ['build', 'npm run prepare'],
            'watch'            => ['watch', 'npm run watch'],
            'lint-fix'         => ['lint-fix', 'npm run lint:fix'],
            'unlink-chart-lib' => ['unlink-chart-lib', 'npm install --quiet'],
        ];
    }

    /**
     * Provides the targets that run as root with the start of the command each of them runs.
     *
     * clean removes what an earlier run left behind, lint only reads, and lang-compile stands for the lang targets,
     * which install gettext with apk. The commands of clean and lint end at the line end, so that npm run lint:fix does
     * not pass for lint.
     *
     * @return array<string, array{string, string}> The start of the command by target name
     */
    public static function rootTargets(): array
    {
        return [
            'clean'        => ['clean', "rm -rf node_modules\n"],
            'lint'         => ['lint', "npm run lint\n"],
            'lang-compile' => ['lang-compile', 'sh -c'],
        ];
    }

    /**
     * Returns the numeric user and group of the caller in the form the recipe passes to the compose service.
     *
     * The id command is the source the recipe uses as well, so the test needs no PHP extension.
     *
     * @return string The user and the group, separated by a colon
     */
    private function identity(): string
    {
        return trim((string) shell_exec('id -u')) . ':' . trim((string) shell_exec('id -g'));
    }

    /**
     * Returns the exit status and the commands that make would run for the target, without running any of them.
     *
     * @param string $target The make target to simulate
     *
     * @return array{int, string} The exit status and the output of make
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
