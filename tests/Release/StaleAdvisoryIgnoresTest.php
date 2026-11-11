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

use function dirname;
use function file_get_contents;
use function file_put_contents;
use function json_decode;
use function json_encode;
use function proc_close;
use function proc_open;
use function stream_get_contents;
use function sys_get_temp_dir;
use function tempnam;
use function unlink;

use const JSON_THROW_ON_ERROR;
use const PHP_BINARY;

/**
 * Tests scripts/check-stale-advisory-ignores.php against the output of a real `composer audit --format=json`.
 *
 * The fixture holds one advisory of each package that the module ignores, in the shape that Composer prints for
 * the advisories that match the installed packages.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class StaleAdvisoryIgnoresTest extends TestCase
{
    /**
     * @var list<string>
     */
    private array $temporaryFiles = [];

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $file) {
            unlink($file);
        }
    }

    /**
     * Every ignored id still matches an installed package, so nothing is reported.
     */
    #[Test]
    public function passesWhenEveryIgnoredAdvisoryStillApplies(): void
    {
        [$status, $output] = $this->check($this->composerJson(), $this->fixture('composer-audit-ignored.json'));

        self::assertSame(0, $status);
        self::assertSame('', $output);
    }

    /**
     * An id that the audit no longer reports as ignored has no match in the installed set and is stale, while the
     * ids that still apply are not named.
     */
    #[Test]
    public function failsAndNamesAnIgnoredAdvisoryThatNoLongerApplies(): void
    {
        $composerJson = $this->composerJson(['PKSA-stale-0000-0000' => 'UPSTREAM-PINNED: no longer affected']);

        [$status, $output] = $this->check($composerJson, $this->fixture('composer-audit-ignored.json'));

        self::assertSame(1, $status);
        self::assertStringContainsString('PKSA-stale-0000-0000', $output);
        self::assertStringNotContainsString('PKSA-gcrk-3vtt-1r14', $output);
    }

    /**
     * Composer leaves the key out of its report when no installed package matches any ignored id. Every ignored id
     * is stale then.
     */
    #[Test]
    public function failsWhenTheAuditReportsNoIgnoredAdvisoryAtAll(): void
    {
        $audit = $this->temporaryFile(json_encode(['advisories' => []], JSON_THROW_ON_ERROR));

        [$status, $output] = $this->check($this->composerJson(), $audit);

        self::assertSame(1, $status);
        self::assertStringContainsString('PKSA-gcrk-3vtt-1r14', $output);
        self::assertStringContainsString('PKSA-z7t6-zt6p-wtng', $output);
    }

    /**
     * Without any ignored id there is nothing that can be stale.
     */
    #[Test]
    public function passesWithoutAnyIgnoredAdvisory(): void
    {
        $composerJson = $this->temporaryFile(json_encode(['name' => 'fixture/module'], JSON_THROW_ON_ERROR));
        $audit        = $this->temporaryFile(json_encode(['advisories' => []], JSON_THROW_ON_ERROR));

        [$status] = $this->check($composerJson, $audit);

        self::assertSame(0, $status);
    }

    /**
     * Composer also accepts a plain list of ids, where the id is the value and not the key.
     */
    #[Test]
    public function readsAnIgnoreListThatHoldsPlainIds(): void
    {
        $composerJson = $this->temporaryFile(json_encode(
            ['config' => ['policy' => ['advisories' => ['ignore-id' => ['PKSA-gcrk-3vtt-1r14', 'PKSA-stale-0000-0000']]]]],
            JSON_THROW_ON_ERROR,
        ));

        [$status, $output] = $this->check($composerJson, $this->fixture('composer-audit-ignored.json'));

        self::assertSame(1, $status);
        self::assertStringContainsString('PKSA-stale-0000-0000', $output);
        self::assertStringNotContainsString('PKSA-gcrk-3vtt-1r14', $output);
    }

    /**
     * An audit report that is not JSON, for example the empty file that a crashed audit leaves, is a failure and
     * never a pass.
     */
    #[Test]
    public function failsWhenTheAuditReportIsNotJson(): void
    {
        [$status, $output] = $this->check($this->composerJson(), $this->temporaryFile(''));

        self::assertSame(2, $status);
        self::assertStringContainsString('not valid JSON', $output);
    }

    /**
     * Builds a composer.json that ignores the advisories of the fixture, plus the given extra ids.
     *
     * @param array<string, string> $extraIds
     */
    private function composerJson(array $extraIds = []): string
    {
        $contents = file_get_contents(__DIR__ . '/Fixture/composer-ignoring.json');
        self::assertIsString($contents);

        /** @var array{config: array{policy: array{advisories: array{'ignore-id': array<string, string>}}}} $manifest */
        $manifest = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);

        foreach ($extraIds as $id => $reason) {
            $manifest['config']['policy']['advisories']['ignore-id'][$id] = $reason;
        }

        return $this->temporaryFile(json_encode($manifest, JSON_THROW_ON_ERROR));
    }

    private function fixture(string $name): string
    {
        return __DIR__ . '/Fixture/' . $name;
    }

    private function temporaryFile(string $contents): string
    {
        $path = tempnam(sys_get_temp_dir(), 'stale-ignores-');
        self::assertIsString($path);

        file_put_contents($path, $contents);

        $this->temporaryFiles[] = $path;

        return $path;
    }

    /**
     * Runs the script and returns its exit status and its combined output.
     *
     * @return array{int, string}
     */
    private function check(string $composerJson, string $audit): array
    {
        $process = proc_open(
            [PHP_BINARY, dirname(__DIR__, 2) . '/scripts/check-stale-advisory-ignores.php', $composerJson, $audit],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
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
