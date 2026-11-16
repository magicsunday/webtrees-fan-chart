<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Release;

use PHPUnit\Framework\Assert;

use function file_get_contents;
use function proc_close;
use function proc_open;
use function sys_get_temp_dir;
use function tempnam;
use function unlink;

/**
 * Runs a command without a shell for the release tests that drive make targets in a scratch copy of the module.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final readonly class ProcessRunner
{
    /**
     * @param string|null $temporaryDirectory The directory for the capture files, the system directory by default
     */
    public function __construct(
        private ?string $temporaryDirectory = null,
    ) {
    }

    /**
     * Runs a command without a shell and returns its exit status together with the standard output and error.
     *
     * The child writes both streams into temporary files and the files are read after it has exited, so a child that
     * writes more to one stream than a pipe buffer holds never waits for a reader that waits for the other stream.
     *
     * @param list<string>          $command          The program and its arguments, run without a shell
     * @param string                $workingDirectory The directory to run it in
     * @param array<string, string> $environment      The environment of the process, only the path by default
     *
     * @return array{int, string} The exit status and the standard output followed by the standard error
     */
    public function execute(array $command, string $workingDirectory, array $environment = ['PATH' => '/usr/local/bin:/usr/bin:/bin']): array
    {
        $directory  = $this->temporaryDirectory ?? sys_get_temp_dir();
        $outputFile = tempnam($directory, 'release-output-');
        $errorFile  = tempnam($directory, 'release-error-');

        Assert::assertIsString($outputFile);
        Assert::assertIsString($errorFile);

        try {
            $process = proc_open(
                $command,
                [1 => ['file', $outputFile, 'w'], 2 => ['file', $errorFile, 'w']],
                $pipes,
                $workingDirectory,
                $environment
            );

            Assert::assertIsResource($process);

            $status = proc_close($process);

            return [$status, $this->read($outputFile) . $this->read($errorFile)];
        } finally {
            unlink($outputFile);
            unlink($errorFile);
        }
    }

    /**
     * Reads the content of a file the child wrote.
     *
     * @param string $file The path of the file
     *
     * @return string The content of the file
     */
    private function read(string $file): string
    {
        $content = file_get_contents($file);

        Assert::assertIsString($content);

        return $content;
    }
}
