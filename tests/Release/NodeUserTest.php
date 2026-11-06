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
     * The lang targets write the catalogues into the checkout, so they run as the numeric user and group of the
     * caller as well. The tooling image carries gettext, PHP and Composer, so no recipe installs a system package,
     * which would fail without root. Each row keeps the prerequisite recipes out of the dry run, so the output
     * holds the recipe of the target itself and a regression of that one recipe turns the test red.
     *
     * @param string       $target  The lang target to simulate
     * @param list<string> $options The make options that keep the prerequisite recipes out of the dry run
     */
    #[Test]
    #[DataProvider('langTargets')]
    public function runsLangTargetsAsTheCallingUserWithoutInstallingSystemPackages(string $target, array $options): void
    {
        [$status, $output] = $this->dryRun($target, $options);

        self::assertSame(0, $status);
        self::assertStringContainsString(
            '--user ' . $this->identity() . ' -e HOME=/tmp node sh -c',
            $output
        );
        self::assertStringNotContainsString('apk add', $output);
    }

    /**
     * Provides the lang targets that run a shell recipe in the compose service, with the make options that leave
     * only the recipe of the target in the dry run. The extract target is an alias of the POT file and prints its
     * recipe only when the file is out of date, so the case forces the rebuild.
     *
     * @return array<string, array{string, list<string>}> The target name and the make options by case name
     */
    public static function langTargets(): array
    {
        return [
            'lang-extract'       => ['lang-extract', ['--always-make']],
            'lang-merge'         => ['lang-merge', ['-o', 'resources/lang/messages.pot']],
            'lang-resolve-fuzzy' => ['lang-resolve-fuzzy', ['-o', 'resources/lang/messages.pot', '-o', 'lang-merge']],
            'lang-compile'       => ['lang-compile', []],
        ];
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
     * clean removes what an earlier run left behind and lint only reads. The commands of clean and lint end at the
     * line end, so that npm run lint:fix does not pass for lint.
     *
     * @return array<string, array{string, string}> The start of the command by target name
     */
    public static function rootTargets(): array
    {
        return [
            'clean' => ['clean', "rm -rf node_modules\n"],
            'lint'  => ['lint', "npm run lint\n"],
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
     * @param string       $target  The make target to simulate
     * @param list<string> $options Further make options, for example to keep prerequisite recipes out of the output
     *
     * @return array{int, string} The exit status and the output of make
     */
    private function dryRun(string $target, array $options = []): array
    {
        $process = proc_open(
            ['make', '--dry-run', ...$options, $target],
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
