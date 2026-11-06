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
use function shell_exec;
use function stream_get_contents;
use function sys_get_temp_dir;
use function tempnam;
use function trim;
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

        $this->installPushRecordingGit('main');
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
     * Inline notes given as a variable on the command line arrive in the release without the shell reading them.
     */
    #[Test]
    public function passesInlineNotesOfTheCommandLineWithoutShellEvaluation(): void
    {
        $this->installRecordingStub();

        $notes = 'Fix `echo INJECTED` in the "chart" and the \'legend\'';

        [$status] = $this->publish(['NOTES=' . $notes]);

        self::assertSame(0, $status);
        self::assertStringEndsWith($notes . "\n", $this->recordedNotes());
    }

    /**
     * Inline notes given through the environment arrive in the release unchanged, dollar signs included.
     */
    #[Test]
    public function passesInlineNotesOfTheEnvironmentUnchanged(): void
    {
        $this->installRecordingStub();

        $notes = 'Cost $HOME-ish and $(id) and `echo INJECTED`';

        [$status] = $this->publish([], ['NOTES' => $notes]);

        self::assertSame(0, $status);
        self::assertStringEndsWith($notes . "\n", $this->recordedNotes());
    }

    /**
     * Inline notes with dollar signs given on the command line arrive unchanged and make runs nothing from them.
     */
    #[Test]
    public function passesInlineNotesWithDollarSignsOfTheCommandLineUnchanged(): void
    {
        $this->installRecordingStub();

        $notes = 'Cost $HOME-ish, $$ and $(id) and $(shell touch executed-by-make)';

        [$status] = $this->publish(['NOTES=' . $notes]);

        self::assertSame(0, $status);
        self::assertStringEndsWith($notes . "\n", $this->recordedNotes());
        self::assertFileDoesNotExist($this->workDir . '/module/executed-by-make');
    }

    /**
     * Without the archive the target stops before anything is pushed, because a pushed tag cannot be removed.
     */
    #[Test]
    public function failsBeforeThePushWhenTheArchiveIsMissing(): void
    {
        $this->installPushRecordingGit('main');
        $this->installStub('gh', "#!/bin/sh\necho stub\n");

        unlink($this->workDir . '/module/webtrees-fan-chart.zip');

        [$status, $output] = $this->publish();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('webtrees-fan-chart.zip', $output);
        self::assertStringContainsString('on the tagged commit 9.9.9', $output);
        self::assertStringContainsString('make dist-smoke', $output);
        self::assertStringNotContainsString('RELEASE_PUBLISHED', $output);
        self::assertFileDoesNotExist($this->workDir . '/pushed');
    }

    /**
     * An archive that was built on another commit than the tagged one is not published, because it would carry the
     * tag of a different commit.
     */
    #[Test]
    public function failsBeforeThePushWhenHeadIsNotTheTaggedCommit(): void
    {
        $this->installPushRecordingGit('main', 'aaa111', 'bbb222');
        $this->installStub('gh', "#!/bin/sh\necho stub\n");

        [$status, $output] = $this->publish();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('HEAD is not the commit that the tag 9.9.9 points at', $output);
        self::assertStringContainsString('make dist-smoke', $output);
        self::assertStringNotContainsString('RELEASE_PUBLISHED', $output);
        self::assertFileDoesNotExist($this->workDir . '/pushed');
        self::assertFileExists($this->workDir . '/module/webtrees-fan-chart.zip');
    }

    /**
     * Without the release tag nothing is pushed, because there is no commit to compare HEAD with.
     */
    #[Test]
    public function failsBeforeThePushWhenTheTagDoesNotExist(): void
    {
        $this->installPushRecordingGit('main', 'aaa111', null);
        $this->installStub('gh', "#!/bin/sh\necho stub\n");

        [$status, $output] = $this->publish();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('the tag 9.9.9 does not exist', $output);
        self::assertStringNotContainsString('RELEASE_PUBLISHED', $output);
        self::assertFileDoesNotExist($this->workDir . '/pushed');
    }

    /**
     * A release started on a branch other than main is refused, because the pushes name main literally.
     */
    #[Test]
    public function refusesAReleaseFromABranchOtherThanMain(): void
    {
        $this->installReleaseCheckStubs('GH-1');

        [$status, $output] = $this->check();

        self::assertNotSame(0, $status);
        self::assertStringContainsString("Error: releases are made from 'main' only", $output);
        self::assertStringNotContainsString('HEAD is detached', $output);
        self::assertStringNotContainsString('Release checks passed', $output);
    }

    /**
     * A release started on main passes the branch check.
     */
    #[Test]
    public function acceptsAReleaseFromMain(): void
    {
        $this->installReleaseCheckStubs('main');

        [$status, $output] = $this->check();

        self::assertSame(0, $status, $output);
        self::assertStringContainsString('Release checks passed for 9.9.9', $output);
    }

    /**
     * A node_modules tree with a file of another owner is refused before any build starts, and the refusal names
     * the command that removes the tree and installs it again. The id stub reports a user that owns nothing in
     * the work directory.
     */
    #[Test]
    #[DataProvider('targetsWithTheOwnerGuard')]
    public function refusesNodeModulesThatTheCallerDoesNotOwn(string $target): void
    {
        $this->installReleaseCheckStubs('main');
        $this->installIdStubOfAnotherUser();
        $this->createNodeModules();

        [$status, $output] = $this->runTarget($target);

        self::assertNotSame(0, $status);
        self::assertStringContainsString('make clean && make install', $output);
        self::assertStringContainsString('usual cause', $output);
        self::assertStringNotContainsString('fix-owner', $output);
        self::assertStringNotContainsString('unlink-chart-lib', $output);
        self::assertStringNotContainsString('Release checks passed', $output);
    }

    /**
     * A node_modules tree that belongs to the caller passes the owner guard.
     */
    #[Test]
    public function acceptsNodeModulesThatTheCallerOwns(): void
    {
        $this->installReleaseCheckStubs('main');
        $this->createNodeModules();

        [$status, $output] = $this->check();

        self::assertSame(0, $status, $output);
        self::assertStringContainsString('Release checks passed for 9.9.9', $output);
    }

    /**
     * Provides the targets that refuse a node_modules tree with files of another owner.
     *
     * @return array<string, array{string}> The target name by target name
     */
    public static function targetsWithTheOwnerGuard(): array
    {
        return [
            'release-check'   => ['release-check'],
            'release-dry-run' => ['release-dry-run'],
        ];
    }

    /**
     * Installs an id stub that reports the user after the caller as the current user, so that every file the
     * caller owns counts as a file of another owner, whatever user runs the test. Every other call goes to the real id.
     */
    private function installIdStubOfAnotherUser(): void
    {
        $realId = trim((string) shell_exec('command -v id'));

        $this->installStub(
            'id',
            "#!/bin/sh\ncase \"\$1\" in -u) echo \$((\$($realId -u) + 1)) ;; *) exec $realId \"\$@\" ;; esac\n"
        );
    }

    /**
     * Creates a node_modules directory with one file in the module, owned by the user who runs the test.
     */
    private function createNodeModules(): void
    {
        mkdir($this->workDir . '/module/node_modules', 0o777, true);

        file_put_contents($this->workDir . '/module/node_modules/package', 'content');
    }

    /**
     * Installs a git stub that records every push and reports the given branch as checked out. The short form of the
     * ref answers with the ambiguous name that git prints when a tag has the name of the branch, so only a check of
     * the full ref passes for main. HEAD and the release tag point at the given commits, and a null tag commit
     * stands for a tag that does not exist.
     *
     * @param string      $branch     The branch that is checked out
     * @param string      $headCommit The commit that HEAD points at
     * @param string|null $tagCommit  The commit that the release tag points at, or null without the tag
     */
    private function installPushRecordingGit(
        string $branch,
        string $headCommit = 'c0ffee',
        ?string $tagCommit = 'c0ffee',
    ): void {
        $tagAnswer = $tagCommit === null ? 'exit 1' : "echo '$tagCommit'";

        $this->installStub(
            'git',
            "#!/bin/sh\n"
            . "case \"\$1\" in\n"
            . "  push) echo \"\$*\" >> \"$this->workDir/pushed\"; exit 0 ;;\n"
            . "  symbolic-ref) case \"\$*\" in *--quiet*) exit 0 ;; *--short*) echo 'heads/$branch' ;; *) echo 'refs/heads/$branch' ;; esac; exit 0 ;;\n"
            . "  rev-parse) case \"\$*\" in *refs/tags/*) $tagAnswer ;; *) echo '$headCommit' ;; esac; exit 0 ;;\n"
            . "  *) exit 0 ;;\n"
            . "esac\n"
        );
    }

    /**
     * Installs stubs for every tool that release-check asks for, with git on the given branch.
     */
    private function installReleaseCheckStubs(string $branch): void
    {
        $this->installPushRecordingGit($branch);

        foreach (['node', 'npm', 'composer', 'jq', 'zip', 'unzip', 'gh', 'sed', 'php'] as $tool) {
            $this->installStub($tool, "#!/bin/sh\nexit 0\n");
        }
    }

    /**
     * @return array{int, string}
     */
    private function check(): array
    {
        return $this->runTarget('release-check');
    }

    /**
     * Runs a release target of the module with the stubs first on the path.
     *
     * @param string $target The make target to run
     *
     * @return array{int, string} The exit status and the output of make
     */
    private function runTarget(string $target): array
    {
        return $this->execute(
            ['make', $target, 'VERSION=9.9.9'],
            $this->workDir . '/module',
            [
                'PATH'   => $this->workDir . '/bin:/usr/local/bin:/usr/bin:/bin',
                'TMPDIR' => $this->workDir . '/tmp',
                'HOME'   => $this->workDir,
            ]
        );
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
     * Installs a gh stub that keeps the notes file of the release it is asked to create.
     */
    private function installRecordingStub(): void
    {
        $this->installStub(
            'gh',
            "#!/bin/sh\n"
            . "if [ \"\$1\" = release ]; then\n"
            . "  while [ \$# -gt 0 ]; do\n"
            . "    if [ \"\$1\" = --notes-file ]; then cat \"\$2\" > \"$this->workDir/recorded-notes\"; fi\n"
            . "    shift\n"
            . "  done\n"
            . "  exit 0\n"
            . "fi\n"
            . "echo stub\n"
        );
    }

    /**
     * Returns the notes text that the recording stub received.
     */
    private function recordedNotes(): string
    {
        $notes = file_get_contents($this->workDir . '/recorded-notes');

        self::assertIsString($notes);

        return $notes;
    }

    /**
     * @param list<string>          $arguments   Further arguments of the make call.
     * @param array<string, string> $environment Further variables of the environment of the make call.
     *
     * @return array{int, string}
     */
    private function publish(array $arguments = [], array $environment = []): array
    {
        return $this->execute(
            ['make', 'release-publish', 'VERSION=9.9.9', ...$arguments],
            $this->workDir . '/module',
            [
                'PATH'   => $this->workDir . '/bin:/usr/local/bin:/usr/bin:/bin',
                'TMPDIR' => $this->workDir . '/tmp',
                'HOME'   => $this->workDir,
                ...$environment,
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
