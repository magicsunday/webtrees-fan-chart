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

use function array_filter;
use function array_unique;
use function array_values;
use function chmod;
use function dirname;
use function explode;
use function file;
use function file_get_contents;
use function file_put_contents;
use function is_file;
use function json_decode;
use function mkdir;
use function preg_match_all;
use function proc_close;
use function proc_open;
use function reset;
use function stream_get_contents;
use function sys_get_temp_dir;
use function tempnam;
use function unlink;

use const FILE_IGNORE_NEW_LINES;
use const FILE_SKIP_EMPTY_LINES;

/**
 * Tests the locale loops of lang-merge and lang-compile in Make/lang.mk against stubbed gettext tools.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class LangLoopTest extends TestCase
{
    private string $workDir = '';

    protected function setUp(): void
    {
        $base = tempnam(sys_get_temp_dir(), 'lang-loop-');
        self::assertIsString($base);

        unlink($base);

        $this->workDir = $base;

        mkdir($this->workDir . '/bin', 0o777, true);
        mkdir($this->workDir . '/module/resources/lang/aa', 0o777, true);
        mkdir($this->workDir . '/module/resources/lang/bb', 0o777, true);

        $root = dirname(__DIR__, 2);

        $this->execute(
            ['cp', '-R', $root . '/Makefile', $root . '/Make', $root . '/composer.json', $this->workDir . '/module/'],
            $this->workDir
        );

        file_put_contents($this->workDir . '/module/resources/lang/messages.pot', '');
        file_put_contents($this->workDir . '/module/resources/lang/aa/messages.po', '');
        file_put_contents($this->workDir . '/module/resources/lang/bb/messages.po', '');
    }

    protected function tearDown(): void
    {
        $this->execute(['rm', '-rf', $this->workDir], sys_get_temp_dir());
    }

    /**
     * The first failing locale ends the loop with a failing status, and no further locale is processed.
     *
     * @param list<string> $options The make options that keep the prerequisite stages out of the run
     */
    #[Test]
    #[DataProvider('loopTargets')]
    public function stopsAtTheFirstFailingLocale(string $target, string $failingTool, array $options): void
    {
        $this->installStubs($failingTool);

        [$status] = $this->make($target, $options);

        self::assertNotSame(0, $status);
        self::assertSame(['aa'], $this->localesOf($this->calls($failingTool)));
    }

    /**
     * Without a failure every locale is processed and the target succeeds.
     *
     * @param list<string> $options The make options that keep the prerequisite stages out of the run
     */
    #[Test]
    #[DataProvider('loopTargets')]
    public function processesEveryLocaleWhenNothingFails(string $target, string $failingTool, array $options): void
    {
        $this->installStubs(null);

        [$status] = $this->make($target, $options);

        self::assertSame(0, $status);
        self::assertSame(['aa', 'bb'], $this->localesOf($this->calls($failingTool)));
    }

    /**
     * A locale directory without a PO is seeded from the POT, and the locales that have one are merged.
     */
    #[Test]
    public function seedsALocaleDirectoryWithoutAPo(): void
    {
        $this->installStubs(null);

        mkdir($this->workDir . '/module/resources/lang/cc', 0o777, true);

        [$status] = $this->make('lang-merge');

        self::assertSame(0, $status);
        self::assertCount(1, $this->calls('msginit'));
        self::assertStringContainsString('--locale=cc', $this->calls('msginit')[0]);
        self::assertCount(2, $this->calls('msgmerge'));
    }

    /**
     * The texts that webtrees core owns are left out of the POT when the list exists, and nothing is left out
     * without it.
     */
    #[Test]
    #[DataProvider('coreOwnedLists')]
    public function leavesTheCoreOwnedTextsOutOnlyWhenTheListExists(bool $listExists): void
    {
        $this->installStubs(null);

        if ($listExists) {
            mkdir($this->workDir . '/module/dev', 0o777, true);
            file_put_contents($this->workDir . '/module/dev/core-owned.pot', '');
        }

        [$status] = $this->make('lang-extract', ['--always-make']);

        self::assertSame(0, $status);
        self::assertCount(1, $this->calls('xgettext'));
        self::assertSame($listExists, str_contains($this->calls('xgettext')[0], '--exclude-file=dev/core-owned.pot'));
    }

    /**
     * The POT names the module after the package in composer.json, whichever fragment sets the name, and not
     * after the checkout directory, which is the same in every CI container.
     */
    #[Test]
    public function namesTheModuleAfterThePackageInComposerJson(): void
    {
        $this->installStubs(null);

        $composer = json_decode((string) file_get_contents($this->workDir . '/module/composer.json'), true);

        self::assertIsArray($composer);
        self::assertIsString($composer['name'] ?? null);

        $parts = explode('/', $composer['name']);

        self::assertCount(2, $parts);

        [$status] = $this->make('lang-extract', ['--always-make']);

        $calls = $this->calls('xgettext');

        self::assertSame(0, $status);
        self::assertCount(1, $calls);
        self::assertStringContainsString('--package-name=' . $parts[1], $calls[0]);
        self::assertStringContainsString('github.com/magicsunday/' . $parts[1] . '/issues', $calls[0]);
    }

    /**
     * @return array<string, array{bool}>
     */
    public static function coreOwnedLists(): array
    {
        return [
            'list exists'  => [true],
            'list missing' => [false],
        ];
    }

    /**
     * Provides the loop targets with the tool whose calls are counted and the make options that keep the
     * prerequisite stages out of the run.
     *
     * @return array<string, array{string, string, list<string>}>
     */
    public static function loopTargets(): array
    {
        return [
            'lang-merge'   => ['lang-merge', 'msgmerge', []],
            'merge attrib' => ['lang-merge', 'msgattrib', []],
            'lang-compile' => ['lang-compile', 'msgfmt', ['-o', 'lang-resolve-fuzzy']],
        ];
    }

    /**
     * Installs recording stubs for the gettext tools, the named one fails on its first call only.
     */
    private function installStubs(?string $failingTool): void
    {
        foreach (['msgmerge', 'msgattrib', 'msgfmt', 'msginit', 'xgettext'] as $tool) {
            $failure = $tool === $failingTool
                ? "if [ ! -f \"$this->workDir/seen-$tool\" ]; then touch \"$this->workDir/seen-$tool\"; exit 5; fi\n"
                : '';

            file_put_contents(
                $this->workDir . '/bin/' . $tool,
                "#!/bin/sh\necho \"\$*\" >> \"$this->workDir/calls-$tool\"\n" . $failure . "exit 0\n"
            );
            chmod($this->workDir . '/bin/' . $tool, 0o755);
        }
    }

    /**
     * Returns the locales that the given calls processed, in call order, read from the catalogue paths of each call.
     * A call has to read a source catalogue, and every catalogue path of it, the source and the compiled one, has
     * to name the same locale, so a call that reads one locale and writes another turns the test red.
     *
     * @param list<string> $calls The recorded arguments of the calls
     *
     * @return list<string> The locale of each call
     */
    private function localesOf(array $calls): array
    {
        $locales = [];

        foreach ($calls as $call) {
            self::assertMatchesRegularExpression('#resources/lang/[^/]+/messages\.po#', $call);
            self::assertGreaterThan(0, preg_match_all('#resources/lang/([^/]+)/messages\.(?:po|mo)#', $call, $matches), $call);
            $unique = array_unique($matches[1]);

            self::assertCount(1, $unique, $call);

            $locale = reset($unique);

            self::assertIsString($locale, $call);

            $locales[] = $locale;
        }

        return $locales;
    }

    /**
     * @return list<string>
     */
    private function calls(string $tool): array
    {
        $file = $this->workDir . '/calls-' . $tool;

        if (!is_file($file)) {
            return [];
        }

        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        self::assertIsArray($lines);

        return array_values(array_filter($lines, static fn (string $line): bool => $line !== ''));
    }

    /**
     * @param list<string> $options Further make options
     *
     * @return array{int, string}
     */
    private function make(string $target, array $options = []): array
    {
        return $this->execute(
            ['make', $target, 'COMPOSE_RUN=', 'COMPOSE_RUN_USER=', ...$options],
            $this->workDir . '/module',
            [
                'PATH' => $this->workDir . '/bin:/usr/local/bin:/usr/bin:/bin',
                'HOME' => $this->workDir,
            ]
        );
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
