<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Release;

use FilesystemIterator;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function bin2hex;
use function explode;
use function iterator_count;
use function mkdir;
use function random_bytes;
use function rmdir;
use function strlen;
use function sys_get_temp_dir;

use const PHP_BINARY;

/**
 * Tests the helper that runs a command for the release tests.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class ProcessRunnerTest extends TestCase
{
    /**
     * A child that writes more to standard error than a pipe buffer holds before it writes to standard output does
     * not block the helper, and the helper returns the standard output followed by the whole standard error.
     */
    #[Test]
    public function returnsBothStreamsOfAChildThatFillsTheErrorPipeFirst(): void
    {
        $errorLength = 1_048_576;

        [$status, $output] = (new ProcessRunner())->execute(
            [PHP_BINARY, '-r', 'fwrite(STDERR, str_repeat("e", ' . $errorLength . ')); fwrite(STDOUT, "out");'],
            sys_get_temp_dir()
        );

        self::assertSame(0, $status);
        self::assertStringStartsWith('out', $output);
        self::assertSame(3 + $errorLength, strlen($output));
    }

    /**
     * The helper returns the exit status of the child and keeps the order of the output, the standard output first
     * and the standard error behind it, whatever the child wrote first.
     */
    #[Test]
    public function returnsTheExitStatusAndTheStandardOutputBeforeTheStandardError(): void
    {
        [$status, $output] = (new ProcessRunner())->execute(
            [PHP_BINARY, '-r', 'fwrite(STDERR, "error"); fwrite(STDOUT, "output"); exit(3);'],
            sys_get_temp_dir()
        );

        self::assertSame(3, $status);
        self::assertSame('outputerror', $output);
    }

    /**
     * The files that capture the output of the child are created in the directory the helper was given and are gone
     * after the run, also when the child exits with a failure status. The child lists the entries of that directory
     * while it runs, so the test does not depend on a platform specific view of the open files of a process.
     */
    #[Test]
    public function removesItsCaptureFilesAfterARun(): void
    {
        $directory = sys_get_temp_dir() . '/release-runner-' . bin2hex(random_bytes(6));

        mkdir($directory);

        try {
            [$status, $output] = (new ProcessRunner($directory))->execute(
                [PHP_BINARY, '-r', 'echo implode("\n", glob($argv[1] . "/*")); exit(1);', $directory],
                $directory
            );

            self::assertSame(1, $status);

            $paths = explode("\n", $output);

            self::assertCount(2, $paths);

            foreach ($paths as $path) {
                self::assertStringStartsWith($directory . '/', $path);
                self::assertFileDoesNotExist($path);
            }

            self::assertSame(0, iterator_count(new FilesystemIterator($directory)));
        } finally {
            rmdir($directory);
        }
    }
}
