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

use function proc_close;
use function proc_open;
use function stream_get_contents;

/**
 * Runs a command without a shell for the release tests that drive make targets in a scratch copy of the module.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class ProcessRunner
{
    /**
     * Runs a command without a shell and returns its exit status together with the standard output and error.
     *
     * @param list<string>          $command          The program and its arguments, run without a shell
     * @param string                $workingDirectory The directory to run it in
     * @param array<string, string> $environment      The environment of the process, only the path by default
     *
     * @return array{int, string} The exit status and the standard output followed by the standard error
     */
    public function execute(array $command, string $workingDirectory, array $environment = ['PATH' => '/usr/local/bin:/usr/bin:/bin']): array
    {
        $process = proc_open(
            $command,
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            $workingDirectory,
            $environment
        );

        Assert::assertIsResource($process);

        $standardOutput = $pipes[1] ?? null;
        $standardError  = $pipes[2] ?? null;

        Assert::assertIsResource($standardOutput);
        Assert::assertIsResource($standardError);

        $output = stream_get_contents($standardOutput) . stream_get_contents($standardError);

        return [proc_close($process), $output];
    }
}
