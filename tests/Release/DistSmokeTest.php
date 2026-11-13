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
use function array_filter;
use function array_key_exists;
use function array_slice;
use function array_values;
use function chmod;
use function count;
use function dirname;
use function explode;
use function file_get_contents;
use function file_put_contents;
use function implode;
use function is_dir;
use function json_encode;
use function mkdir;
use function posix_geteuid;
use function sprintf;
use function str_repeat;
use function strpos;
use function substr;
use function substr_count;
use function sys_get_temp_dir;
use function tempnam;
use function trim;
use function unlink;

use const FILE_APPEND;
use const JSON_THROW_ON_ERROR;

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
    /**
     * The directory of the bundled module base inside the archive, with the trailing slash.
     */
    private const string BASE = 'vendor/magicsunday/webtrees-module-base/';

    private const string BASE_VIEWS = self::BASE . 'resources/views/';

    private const string BASE_SOURCES = self::BASE . 'src/';

    /**
     * Runs the commands of the scratch copy.
     */
    private ProcessRunner $processRunner;

    /**
     * The package name of the module, read from its parameter file.
     */
    private string $moduleName = '';

    private string $workDir = '';

    protected function setUp(): void
    {
        $this->processRunner = new ProcessRunner();
        $this->moduleName    = ModuleParameters::moduleName();

        $base = tempnam(sys_get_temp_dir(), 'dist-smoke-');
        self::assertIsString($base);

        unlink($base);

        $this->workDir = $base;

        mkdir($this->workDir . '/module', 0o777, true);
        mkdir($this->workDir . '/stage', 0o777, true);

        $root = dirname(__DIR__, 2);

        $this->processRunner->execute(['cp', '-R', $root . '/Makefile', $root . '/Make', $this->workDir . '/module/'], $this->workDir);
    }

    protected function tearDown(): void
    {
        $this->processRunner->execute(['rm', '-rf', $this->workDir], sys_get_temp_dir());
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
        $this->skipWithoutSharedViews($view);

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
     * The dist target bundles the shared views that the module names and no other view of the module base.
     */
    #[Test]
    public function bundlesOnlyTheConfiguredSharedViews(): void
    {
        $configured = ModuleParameters::sharedViews();

        if ($configured === []) {
            self::markTestSkipped('The module bundles no shared module-base views.');
        }

        $bundled   = array_slice($configured, 0, 2);
        $unbundled = array_diff([...$configured, 'unlisted-view'], $bundled);

        [$status, $output] = $this->dist(implode(' ', $bundled), [...$configured, 'unlisted-view']);

        self::assertSame(0, $status, $output);

        $paths = $this->archivePaths();

        foreach ($bundled as $view) {
            self::assertContains(self::BASE_VIEWS . $view . '.phtml', $paths);
        }

        foreach ($unbundled as $view) {
            self::assertNotContains(self::BASE_VIEWS . $view . '.phtml', $paths);
        }
    }

    /**
     * The dist target stops when a configured shared view is missing from the module base, instead of building an
     * archive that the smoke test would reject afterwards.
     */
    #[Test]
    public function refusesToBundleASharedViewThatTheModuleBaseLacks(): void
    {
        $configured = ModuleParameters::sharedViews();

        if ($configured === []) {
            self::markTestSkipped('The module bundles no shared module-base views.');
        }

        [$status, $output] = $this->dist(implode(' ', [...$configured, 'absent-view']), $configured);

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: shared view absent-view is missing from', $output);
        self::assertFileDoesNotExist($this->workDir . '/module/' . $this->moduleName . '.zip');
    }

    /**
     * The dist target stops when the copy of a shared view fails, also when the views named after it copy fine, so
     * that no archive without that view is built.
     */
    #[Test]
    public function refusesToBuildWhenTheCopyOfANonLastSharedViewFails(): void
    {
        $configured = ModuleParameters::sharedViews();

        if (count($configured) < 2) {
            self::markTestSkipped('The module bundles fewer than two shared module-base views.');
        }

        if (posix_geteuid() === 0) {
            self::markTestSkipped('A file mode does not block reading as root.');
        }

        [$status, $output] = $this->dist(implode(' ', $configured), $configured, [$configured[0]]);

        self::assertNotSame(0, $status, $output);
        self::assertFileDoesNotExist($this->workDir . '/module/' . $this->moduleName . '.zip');
    }

    /**
     * An archive without the commit that it was built on fails the smoke test, because the publish step could not
     * tell which commit the archive belongs to.
     */
    #[Test]
    public function rejectsAnArchiveWithoutTheBuildCommit(): void
    {
        $this->buildArchive([], [], false);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: the zip carries no build commit', $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * A stamp that is not a full commit id fails the smoke test, whether it is short, not hexadecimal, in capitals
     * or too long.
     */
    #[Test]
    #[DataProvider('malformedBuildCommits')]
    public function rejectsAnArchiveWithAMalformedBuildCommit(string $stampText): void
    {
        $this->buildArchive([], [], true, $stampText);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: the zip carries no build commit', $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * The stamp target writes the commit of the commit file into the comment of the archive and removes the file,
     * and the archive passes the smoke test afterwards.
     */
    #[Test]
    public function stampsTheArchiveWithTheCommitOfTheCommitFile(): void
    {
        $commit = str_repeat('b', 40);

        $this->buildArchive([], [], false);
        file_put_contents($this->workDir . '/module/' . $this->moduleName . '.commit', $commit . "\n");

        [$status, $output] = $this->processRunner->execute(['make', 'dist-stamp'], $this->workDir . '/module');

        self::assertSame(0, $status, $output);
        self::assertFileDoesNotExist($this->workDir . '/module/' . $this->moduleName . '.commit');

        [$status, $comment] = $this->processRunner->execute(
            ['unzip', '-z', $this->workDir . '/module/' . $this->moduleName . '.zip'],
            $this->workDir . '/module'
        );

        self::assertSame(0, $status, $comment);
        self::assertSame($commit, substr(trim($comment), -40));

        [$status, $output] = $this->smoke();

        self::assertSame(0, $status, $output);
    }

    /**
     * The dist target resolves the commit once, archives that commit and stamps the same one, in this order. The
     * dry run lists the commands, so a recipe that resolves HEAD again for the stamp turns the test red.
     */
    #[Test]
    public function archivesAndStampsTheCommitThatWasResolvedFirst(): void
    {
        [$status, $output] = $this->processRunner->execute(['make', '-n', 'dist'], $this->workDir . '/module');

        self::assertSame(0, $status, $output);

        $resolved = strpos($output, 'git rev-parse HEAD > ' . $this->moduleName . '.commit');
        $archived = strpos($output, 'git archive --prefix=' . $this->moduleName . '/ "$(cat ' . $this->moduleName . '.commit)"');
        $stamped  = strpos($output, 'zip --quiet -z ' . $this->moduleName . '.zip < ' . $this->moduleName . '.commit');

        self::assertNotFalse($resolved, $output);
        self::assertNotFalse($archived, $output);
        self::assertNotFalse($stamped, $output);
        self::assertLessThan($archived, $resolved);
        self::assertLessThan($stamped, $archived);
        self::assertSame(1, substr_count($output, 'git rev-parse HEAD'), $output);
    }

    /**
     * An archive without the version of the bundled module base fails the smoke test, because nothing in the archive
     * would say which module base it carries.
     */
    #[Test]
    public function rejectsAnArchiveWithoutTheModuleBaseVersion(): void
    {
        $this->buildArchive([], [self::BASE . 'VERSION']);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: the zip carries no well-formed module base version', $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * An entry that is not a single release version fails the smoke test, whether it is a branch, a short version,
     * free text, empty, padded or spread over two lines.
     */
    #[Test]
    #[DataProvider('malformedModuleBaseVersions')]
    public function rejectsAnArchiveWithAMalformedModuleBaseVersion(string $entry): void
    {
        $this->buildArchive([self::BASE . 'VERSION' => $entry]);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: the zip carries no well-formed module base version', $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * A release version of the module base passes the smoke test, with or without a pre-release suffix or a tag
     * prefix.
     */
    #[Test]
    #[DataProvider('wellFormedModuleBaseVersions')]
    public function acceptsAnArchiveWithAWellFormedModuleBaseVersion(string $entry): void
    {
        $this->buildArchive([self::BASE . 'VERSION' => $entry]);

        [$status, $output] = $this->smoke();

        self::assertSame(0, $status, $output);
        self::assertStringContainsString('dist-smoke passed', $output);
    }

    /**
     * The version target writes the version that composer resolved for the module base into the bundled copy, and
     * leaves the versions of the other packages alone.
     */
    #[Test]
    public function recordsTheVersionThatComposerResolvedForTheModuleBase(): void
    {
        $this->prepareResolvedPackages([
            ['name' => 'psr/log', 'version' => '9.9.9'],
            ['name' => 'magicsunday/webtrees-module-base', 'version' => '3.4.0'],
        ]);

        [$status, $output] = $this->processRunner->execute(['make', 'dist-base-version'], $this->workDir . '/module');

        self::assertSame(0, $status, $output);
        self::assertSame("3.4.0\n", file_get_contents($this->baseVersionFile()));
    }

    /**
     * The version target stops when composer resolved no release version of the module base, so a build from a
     * branch or without the package cannot produce an archive without a version.
     *
     * @param list<array{name: string, version: string}> $packages The packages as composer lists them.
     */
    #[Test]
    #[DataProvider('unusableResolvedPackages')]
    public function refusesToRecordWhenComposerResolvedNoReleaseOfTheModuleBase(array $packages): void
    {
        $this->prepareResolvedPackages($packages);

        [$status, $output] = $this->processRunner->execute(['make', 'dist-base-version'], $this->workDir . '/module');

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: no well-formed version of the module base', $output);
    }

    /**
     * The dist target records the version after it bundled the module base and before it packs the archive, and it
     * builds without the flag that switches the advisory blocking of composer off.
     */
    #[Test]
    public function recordsTheModuleBaseVersionBeforePackingAndKeepsSecurityBlockingOn(): void
    {
        [$status, $output] = $this->processRunner->execute(['make', '-n', 'dist'], $this->workDir . '/module');

        self::assertSame(0, $status, $output);

        $bundled  = strpos($output, 'cp -L .build/vendor/magicsunday/webtrees-module-base/LICENSE');
        $recorded = strpos($output, '> ' . $this->moduleName . '/' . self::BASE . 'VERSION');
        $packed   = strpos($output, 'zip --quiet --recurse-paths');

        self::assertNotFalse($bundled, $output);
        self::assertNotFalse($recorded, $output);
        self::assertNotFalse($packed, $output);
        self::assertLessThan($recorded, $bundled);
        self::assertLessThan($packed, $recorded);
        self::assertStringContainsString('composer update --no-dev', $output);
        self::assertStringNotContainsString('--no-security-blocking', $output);
    }

    /**
     * A required file that is missing from the file list of the archive fails the smoke test.
     */
    #[Test]
    #[DataProvider('requiredFiles')]
    public function rejectsAnArchiveWithoutARequiredFile(string $file): void
    {
        $this->buildArchive([], [$file]);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: required file missing from zip: ' . $file, $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * A required prefix without any entry in the archive fails the smoke test with the message of the prefix.
     */
    #[Test]
    #[DataProvider('requiredPrefixes')]
    public function rejectsAnArchiveWithoutARequiredPrefix(string $entry, string $prefix): void
    {
        $this->buildArchive([], [$entry]);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: required prefix has no entries in zip: ' . $prefix, $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * An empty shared view fails the smoke test after the extraction.
     */
    #[Test]
    #[DataProvider('sharedViews')]
    public function rejectsAnArchiveWithAnEmptySharedView(string $view): void
    {
        $this->skipWithoutSharedViews($view);

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
     * An entry that the archive must not carry fails the smoke test with the message of its own check.
     */
    #[Test]
    #[DataProvider('forbiddenEntries')]
    public function rejectsAnArchiveWithAForbiddenEntry(string $path, string $message): void
    {
        $this->buildArchive([$path => "content\n"]);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString($message, $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * An entry that only resembles a forbidden one passes, so the checks reject exactly their own paths.
     */
    #[Test]
    #[DataProvider('lookalikeEntries')]
    public function acceptsAnEntryThatOnlyLooksForbidden(string $path): void
    {
        $this->buildArchive([$path => "content\n"]);

        [$status, $output] = $this->smoke();

        self::assertSame(0, $status, $output);
        self::assertStringContainsString('dist-smoke passed', $output);
    }

    /**
     * The unprefixed module-base namespace in module.php fails the smoke test in either spelling.
     */
    #[Test]
    #[DataProvider('unprefixedNamespaces')]
    public function rejectsAnArchiveWithAnUnprefixedNamespace(string $namespace): void
    {
        $this->buildArchive([
            'module.php' => "<?php\n\n// MagicSunday\\\\" . ModuleParameters::scopeNamespace() . "\\\\Webtrees\\\\ModuleBase\n// " . $namespace . "\n",
        ]);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: module.php in zip still contains unprefixed', $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * A module.php without the scoped module-base namespace fails the smoke test.
     */
    #[Test]
    public function rejectsAnArchiveWithoutTheScopedNamespace(): void
    {
        $this->buildArchive(['module.php' => "<?php\n"]);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString('Error: module.php in zip is missing prefixed namespace', $output);
        self::assertStringNotContainsString('dist-smoke passed', $output);
    }

    /**
     * A bundled module-base source directory without a PHP file fails the smoke test after the extraction.
     */
    #[Test]
    #[DataProvider('sourceDirectories')]
    public function rejectsAnArchiveWithASourceDirectoryWithoutPhpFiles(string $directory): void
    {
        $sources = self::BASE_SOURCES . $directory . '/';

        $this->buildArchive([$sources . 'README.md' => "text\n"], [$sources . 'Entry.php']);

        [$status, $output] = $this->smoke();

        self::assertNotSame(0, $status);
        self::assertStringContainsString(
            'Error: bundled module-base src/' . $directory . ' has no PHP files in extracted zip',
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
    public static function malformedBuildCommits(): array
    {
        return [
            'short'     => ['c0ffee'],
            'not hex'   => [str_repeat('g', 40)],
            'uppercase' => [str_repeat('A', 40)],
            'too long'  => [str_repeat('a', 41)],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function malformedModuleBaseVersions(): array
    {
        return [
            'branch'          => ["dev-main\n"],
            'prefixed branch' => ["dev-fix-1.2.3\n"],
            'short'           => ["3.4\n"],
            'text'            => ["latest\n"],
            'empty'           => [''],
            'padded'          => ["3.4.0 \n"],
            'two lines'       => ["3.4.0\n3.4.1\n"],
            'extra line'      => ["3.4.0\nnote\n"],
            'bare suffix'     => ["3.4.0-\n"],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function wellFormedModuleBaseVersions(): array
    {
        return [
            'release'     => ["3.4.0\n"],
            'pre-release' => ["3.4.0-rc.1\n"],
            'tag prefix'  => ["v3.4.0\n"],
            'no newline'  => ['3.4.0'],
        ];
    }

    /**
     * @return array<string, array{list<array{name: string, version: string}>}>
     */
    public static function unusableResolvedPackages(): array
    {
        return [
            'branch'          => [[['name' => 'magicsunday/webtrees-module-base', 'version' => 'dev-main']]],
            'prefixed branch' => [[['name' => 'magicsunday/webtrees-module-base', 'version' => 'dev-fix-1.2.3']]],
            'absent'          => [[['name' => 'psr/log', 'version' => '3.0.0']]],
            'no list'         => [[]],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function requiredFiles(): array
    {
        return [
            'module entry point' => ['module.php'],
            'license'            => ['LICENSE'],
        ];
    }

    /**
     * Provides the one entry whose omission leaves a required prefix without entries, with the prefix that the
     * check names.
     *
     * @return array<string, array{string, string}>
     */
    public static function requiredPrefixes(): array
    {
        return [
            'versioned bundle' => [
                'resources/js/' . ModuleParameters::scriptName() . '-1.min.js',
                'resources/js/' . ModuleParameters::scriptName() . '-[0-9]',
            ],
            'contracts'  => [self::BASE_SOURCES . 'Contract/Entry.php', self::BASE_SOURCES . 'Contract/'],
            'models'     => [self::BASE_SOURCES . 'Model/Entry.php', self::BASE_SOURCES . 'Model/'],
            'modules'    => [self::BASE_SOURCES . 'Module/Entry.php', self::BASE_SOURCES . 'Module/'],
            'processors' => [self::BASE_SOURCES . 'Processor/Entry.php', self::BASE_SOURCES . 'Processor/'],
        ];
    }

    /**
     * The shared views that the module bundles, by name. A module without shared views gets one row with an empty
     * name, so that the cases that need a view are reported as skipped and not as an empty data provider.
     *
     * @return array<string, array{string}>
     */
    public static function sharedViews(): array
    {
        $views = [];

        foreach (ModuleParameters::sharedViews() as $view) {
            $views[$view] = [$view];
        }

        return $views === [] ? ['no shared views' => ['']] : $views;
    }

    /**
     * @return array<string, array{string, string}>
     */
    public static function forbiddenEntries(): array
    {
        return [
            'composer manifest'        => ['composer.json', 'Error: composer.json found in zip'],
            'nested composer manifest' => ['resources/composer.json', 'Error: composer.json found in zip'],
            'assets directory'         => ['assets/logo.png', 'Error: assets/ found in zip'],
            'dev directory'            => ['dev/tool.sh', 'Error: dev/ found in zip'],
            'git hooks'                => ['.githooks/pre-commit', 'Error: .githooks/ found in zip'],
            'deptrac yaml'             => ['deptrac.yaml', 'Error: deptrac.yaml found in zip'],
            'deptrac short yaml'       => ['deptrac.yml', 'Error: deptrac.yaml found in zip'],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function lookalikeEntries(): array
    {
        return [
            'character before git hooks' => ['agithooks/pre-commit'],
            'nested git hooks'           => ['resources/.githooks/pre-commit'],
            'nested dev directory'       => ['resources/dev/tool.sh'],
            'nested assets directory'    => ['resources/assets/logo.png'],
            'character in composer file' => ['composerxjson'],
            'nested deptrac file'        => ['resources/deptrac.yaml'],
            'text after deptrac file'    => ['deptrac.yaml.dist'],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function sourceDirectories(): array
    {
        return [
            'contracts'  => ['Contract'],
            'models'     => ['Model'],
            'modules'    => ['Module'],
            'processors' => ['Processor'],
        ];
    }

    /**
     * @return array<string, array{string}>
     */
    public static function unprefixedNamespaces(): array
    {
        return [
            'doubled backslashes' => ['MagicSunday\\\\Webtrees\\\\ModuleBase'],
            'single backslashes'  => ['MagicSunday\\Webtrees\\ModuleBase'],
        ];
    }

    /**
     * Builds an archive that satisfies every check of the smoke test, with the given changes.
     *
     * @param array<string, string> $overrides Entries to add or to replace, by path.
     * @param list<string>          $omitted   Entries to leave out of the archive.
     * @param bool                  $stamp     Whether the archive carries the commit that it was built on.
     * @param string|null           $stampText The text of the stamp, or null for a well-formed commit.
     */
    private function buildArchive(
        array $overrides = [],
        array $omitted = [],
        bool $stamp = true,
        ?string $stampText = null,
    ): void {
        $scopedNamespace = 'MagicSunday\\\\' . ModuleParameters::scopeNamespace() . '\\\\Webtrees\\\\ModuleBase';
        $base            = self::BASE;

        $files = [
            'module.php'                                                   => "<?php\n\n// " . $scopedNamespace . "\n",
            'LICENSE'                                                      => "license\n",
            'resources/js/' . ModuleParameters::scriptName() . '-1.min.js' => "bundle\n",
            $base . 'src/Contract/Entry.php'                               => "<?php\n",
            $base . 'src/Model/Entry.php'                                  => "<?php\n",
            $base . 'src/Module/Entry.php'                                 => "<?php\n",
            $base . 'src/Processor/Entry.php'                              => "<?php\n",
            $base . 'VERSION'                                              => "3.4.0\n",
        ];

        if (ModuleParameters::sharedViews() !== []) {
            $files[$base . 'src/View/SharedViews.php'] = "<?php\n\n// '" . ModuleParameters::scopeViewNamespace() . "'\n";

            foreach (ModuleParameters::sharedViews() as $view) {
                $files[self::BASE_VIEWS . $view . '.phtml'] = "view\n";
            }
        }

        foreach ($overrides as $path => $content) {
            $files[$path] = $content;
        }

        foreach ($omitted as $path) {
            self::assertTrue(array_key_exists($path, $files), $path);

            unset($files[$path]);
        }

        foreach ($files as $path => $content) {
            $this->writeFile($this->workDir . '/stage/' . $path, $content);
        }

        [$status, $output] = $this->processRunner->execute(
            ['zip', '-qr', $this->workDir . '/module/' . $this->moduleName . '.zip', '.'],
            $this->workDir . '/stage'
        );

        self::assertSame(0, $status, $output);

        if (!$stamp) {
            return;
        }

        [$status, $output] = $this->processRunner->execute(
            [
                'sh',
                '-c',
                'printf "%s\n" "$0" | zip -q -z "$1"',
                $stampText ?? str_repeat('a', 40),
                $this->workDir . '/module/' . $this->moduleName . '.zip',
            ],
            $this->workDir . '/stage'
        );

        self::assertSame(0, $status, $output);
    }

    /**
     * Gives the scratch copy the composer metadata of a build and the bundled module base that the version target
     * writes into.
     *
     * @param list<array{name: string, version: string}> $packages The packages as composer lists them.
     */
    private function prepareResolvedPackages(array $packages): void
    {
        mkdir($this->workDir . '/module/.build/vendor/composer', 0o777, true);
        mkdir(dirname($this->baseVersionFile()), 0o777, true);

        file_put_contents(
            $this->workDir . '/module/.build/vendor/composer/installed.json',
            json_encode(['packages' => $packages], JSON_THROW_ON_ERROR)
        );
    }

    /**
     * Returns the path of the version file that the version target writes into the bundled module base of the
     * scratch copy.
     */
    private function baseVersionFile(): string
    {
        return $this->workDir . '/module/' . $this->moduleName . '/' . self::BASE . 'VERSION';
    }

    /**
     * Runs the dist target for a module whose build tools are stubbed. The module base that the stubbed composer
     * installs holds the given views, and SHARED_VIEWS names the views that the module configures for this build.
     *
     * @param string       $sharedViews The value of SHARED_VIEWS for this build.
     * @param list<string> $baseViews   The views that the module base ships, by name without extension.
     * @param list<string> $unreadable  The views that the stubbed composer makes unreadable after it installed them.
     *
     * @return array{int, string}
     */
    private function dist(string $sharedViews, array $baseViews, array $unreadable = []): array
    {
        $fixture = $this->workDir . '/base-fixture';
        $stubs   = $this->workDir . '/stubs';
        $module  = $this->workDir . '/module';

        foreach (['Contract', 'Model', 'Module', 'Processor'] as $directory) {
            $this->writeFile($fixture . '/src/' . $directory . '/Entry.php', "<?php\n");
        }

        $this->writeFile($fixture . '/src/View/SharedViews.php', "<?php\n\n// 'webtrees-module-base'\n");
        $this->writeFile($fixture . '/LICENSE', "license\n");

        foreach ($baseViews as $view) {
            $this->writeFile($fixture . '/resources/views/' . $view . '.phtml', "view\n");
        }

        $this->writeFile(
            $stubs . '/composer',
            sprintf(
                "#!/bin/sh\nset -e\nmkdir -p .build/vendor/composer .build/vendor/magicsunday\n"
                . "cp -R '%s' .build/vendor/magicsunday/webtrees-module-base\n"
                . "printf '%%s' '{\"packages\":[{\"name\":\"magicsunday/webtrees-module-base\",\"version\":\"3.4.0\"}]}'"
                . " > .build/vendor/composer/installed.json\n",
                $fixture
            )
        );

        foreach ($unreadable as $view) {
            file_put_contents(
                $stubs . '/composer',
                sprintf("chmod 000 '.build/vendor/magicsunday/webtrees-module-base/resources/views/%s.phtml'\n", $view),
                FILE_APPEND
            );
        }

        chmod($stubs . '/composer', 0o755);

        $environment = [
            'PATH' => $stubs . ':/usr/local/bin:/usr/bin:/bin',
            'HOME' => $this->workDir,
        ];

        foreach (
            [
                ['git', 'init', '-q'],
                ['git', 'add', 'Makefile', 'Make'],
                ['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'Module'],
            ] as $command
        ) {
            [$status, $output] = $this->processRunner->execute($command, $module, $environment);

            self::assertSame(0, $status, $output);
        }

        return $this->processRunner->execute(['make', 'dist', 'SHARED_VIEWS=' . $sharedViews], $module, $environment);
    }

    /**
     * Lists the entries of the archive that the dist target built.
     *
     * @return list<string>
     */
    private function archivePaths(): array
    {
        [$status, $output] = $this->processRunner->execute(
            ['unzip', '-Z1', $this->workDir . '/module/' . $this->moduleName . '.zip'],
            $this->workDir . '/module'
        );

        self::assertSame(0, $status, $output);

        return array_values(array_filter(explode("\n", $output), static fn (string $path): bool => $path !== ''));
    }

    /**
     * Writes a file and creates its directory.
     */
    private function writeFile(string $path, string $content): void
    {
        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0o777, true);
        }

        file_put_contents($path, $content);
    }

    /**
     * Skips the case when the module bundles no shared views, which the data provider reports as an empty view name.
     */
    private function skipWithoutSharedViews(string $view): void
    {
        if ($view === '') {
            self::markTestSkipped('The module bundles no shared module-base views.');
        }
    }

    /**
     * @return array{int, string}
     */
    private function smoke(): array
    {
        return $this->processRunner->execute(['make', 'dist-smoke'], $this->workDir . '/module');
    }
}
