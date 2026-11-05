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

use function array_key_exists;
use function dirname;
use function file_put_contents;
use function is_dir;
use function mkdir;
use function proc_close;
use function proc_open;
use function stream_get_contents;
use function sys_get_temp_dir;
use function tempnam;
use function unlink;

/**
 * Tests the dist-smoke target of Make/release.mk against small archives built for each case.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class DistSmokeTest extends TestCase
{
    private const string BASE_VIEWS = 'vendor/magicsunday/webtrees-module-base/resources/views/';

    private string $workDir = '';

    protected function setUp(): void
    {
        $base = tempnam(sys_get_temp_dir(), 'dist-smoke-');
        self::assertIsString($base);

        unlink($base);

        $this->workDir = $base;

        mkdir($this->workDir . '/module', 0o777, true);
        mkdir($this->workDir . '/stage', 0o777, true);

        $root = dirname(__DIR__, 2);

        $this->execute(['cp', '-R', $root . '/Makefile', $root . '/Make', $this->workDir . '/module/'], $this->workDir);
    }

    protected function tearDown(): void
    {
        $this->execute(['rm', '-rf', $this->workDir], sys_get_temp_dir());
    }

    /**
     * A well-formed archive passes, so the failing cases below are caused by their change alone.
     */
    #[Test]
    public function acceptsAWellFormedArchive(): void
    {
        $this->buildArchive();

        [$status, $output] = $this->smoke();

        self::assertSame(0, $status, $output);
        self::assertStringContainsString('dist-smoke passed', $output);
    }

    /**
     * A TypeScript configuration in the archive fails the smoke test, at the root and in a subdirectory.
     */
    #[Test]
    #[DataProvider('typeScriptConfigurations')]
    public function rejectsAnArchiveWithATypeScriptConfiguration(string $path): void
    {
        $this->buildArchive([$path => "{}\n"]);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: tsconfig.json found in zip', $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * A shared view that is missing from the file list of the archive fails the smoke test.
     */
    #[Test]
    #[DataProvider('sharedViews')]
    public function rejectsAnArchiveWithoutASharedView(string $view): void
    {
        $this->buildArchive([], [self::BASE_VIEWS . $view . '.phtml']);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString(
            'Error: required prefix has no entries in zip: ' . self::BASE_VIEWS . $view . '.phtml',
            $output
        );
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * An empty shared view fails the smoke test after the extraction.
     */
    #[Test]
    #[DataProvider('sharedViews')]
    public function rejectsAnArchiveWithAnEmptySharedView(string $view): void
    {
        $this->buildArchive([self::BASE_VIEWS . $view . '.phtml' => '']);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString(
            'Error: bundled module-base view ' . $view . ' is missing or empty in extracted zip',
            $output
        );
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function typeScriptConfigurations(): array
    {
        return [
            'root'         => ['tsconfig.json'],
            'subdirectory' => ['resources/tsconfig.json'],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function sharedViews(): array
    {
        return [
            'detail panel'  => ['detail-panel'],
            'help popover'  => ['help-popover'],
            'toolbar style' => ['toolbar-style'],
        ];
    }

    /**
     * Builds an archive that satisfies every check of the smoke test, with the given changes.
     *
     * @param array<string, string> $overrides Entries to add or to replace, by path.
     * @param list<string>          $omitted   Entries to leave out of the archive.
     */
    private function buildArchive(array $overrides = [], array $omitted = []): void
    {
        $scopedNamespace = 'MagicSunday\\\\FanChartVendor\\\\Webtrees\\\\ModuleBase';
        $base            = 'vendor/magicsunday/webtrees-module-base/';

        $files = [
            'module.php'                             => "<?php\n\n// " . $scopedNamespace . "\n",
            'LICENSE'                                => "license\n",
            'resources/js/fan-chart-1.min.js'        => "bundle\n",
            $base . 'src/Contract/Entry.php'         => "<?php\n",
            $base . 'src/Model/Entry.php'            => "<?php\n",
            $base . 'src/Module/Entry.php'           => "<?php\n",
            $base . 'src/Processor/Entry.php'        => "<?php\n",
            $base . 'src/View/SharedViews.php'       => "<?php\n\n// 'webtrees-module-base-fan-chart'\n",
            self::BASE_VIEWS . 'detail-panel.phtml'  => "view\n",
            self::BASE_VIEWS . 'help-popover.phtml'  => "view\n",
            self::BASE_VIEWS . 'toolbar-style.phtml' => "view\n",
        ];

        foreach ($overrides as $path => $content) {
            $files[$path] = $content;
        }

        foreach ($omitted as $path) {
            self::assertTrue(array_key_exists($path, $files), $path);

            unset($files[$path]);
        }

        foreach ($files as $path => $content) {
            $directory = dirname($this->workDir . '/stage/' . $path);

            if (!is_dir($directory)) {
                mkdir($directory, 0o777, true);
            }

            file_put_contents($this->workDir . '/stage/' . $path, $content);
        }

        [$status, $output] = $this->execute(
            ['zip', '-qr', $this->workDir . '/module/webtrees-fan-chart.zip', '.'],
            $this->workDir . '/stage'
        );

        self::assertSame(0, $status, $output);
    }

    /**
     * @return array{int, string}
     */
    private function smoke(): array
    {
        return $this->execute(['make', 'dist-smoke'], $this->workDir . '/module');
    }

    /**
     * @param list<string> $command
     *
     * @return array{int, string}
     */
    private function execute(array $command, string $workingDirectory): array
    {
        $process = proc_open(
            $command,
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            $workingDirectory,
            ['PATH' => '/usr/local/bin:/usr/bin:/bin']
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
