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

use function dirname;
use function explode;
use function file_get_contents;
use function preg_match;
use function preg_split;
use function strlen;
use function substr;

use const PREG_SPLIT_NO_EMPTY;

/**
 * Reads the values of the module from Make/module.mk for the release tests, so that the tests hold no literal of
 * a module and stay the same in every module.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class ModuleParameters
{
    /**
     * The prefix that every package name of a module carries and that the name of the JavaScript bundle leaves out.
     */
    private const string NAME_PREFIX = 'webtrees-';

    /**
     * The prefix of the name of the view namespace, which the release completes with the name of the bundle.
     */
    private const string VIEW_NAMESPACE_PREFIX = 'webtrees-module-base-';

    /**
     * Only static access, the class holds no state.
     */
    private function __construct()
    {
    }

    /**
     * The package name of the module, for example the name of the release archive without its extension.
     */
    public static function moduleName(): string
    {
        return self::value('MODULE_NAME');
    }

    /**
     * The name that the versioned JavaScript bundle carries, which is the package name without the prefix.
     */
    public static function scriptName(): string
    {
        $name = self::moduleName();

        Assert::assertStringStartsWith(self::NAME_PREFIX, $name);

        return substr($name, strlen(self::NAME_PREFIX));
    }

    /**
     * The prefix that the release scopes the bundled module-base namespace with.
     */
    public static function scopeNamespace(): string
    {
        return self::value('SCOPE_NS');
    }

    /**
     * The name of the view namespace that the release scopes the bundled module-base views to.
     */
    public static function scopeViewNamespace(): string
    {
        return self::VIEW_NAMESPACE_PREFIX . self::scriptName();
    }

    /**
     * The shared module-base views that the module bundles, empty for a module without any.
     *
     * @return list<string>
     */
    public static function sharedViews(): array
    {
        $views = preg_split('/\s+/', self::value('SHARED_VIEWS', true), -1, PREG_SPLIT_NO_EMPTY);

        Assert::assertIsArray($views);

        return $views;
    }

    /**
     * Reads the value of a parameter from Make/module.mk the way make does. The last assignment with `=`, `:=` or
     * `::=` wins, a `?=` sets the name only when no earlier assignment did, indentation with spaces and a carriage
     * return at the line end are ignored, and every other line is ignored too. A value carries no comment. A
     * parameter whose value is an expression of make, such as the webtrees constraint of a module that derives it,
     * is not read by the tests.
     */
    private static function value(string $name, bool $mayBeEmpty = false): string
    {
        $file     = dirname(__DIR__, 2) . '/Make/module.mk';
        $contents = file_get_contents($file);

        Assert::assertIsString($contents, $file);

        $value = null;

        foreach (explode("\n", $contents) as $line) {
            if (preg_match('/^ *([A-Z][A-Z0-9_]*)[ \t]*(:?:?=|\?=)[ \t]*(.*?)[ \t\r]*$/', $line, $matches) !== 1) {
                continue;
            }

            if ($matches[1] !== $name) {
                continue;
            }

            if ($matches[2] === '?=' && $value !== null) {
                continue;
            }

            $value = $matches[3];
        }

        Assert::assertNotNull($value, $name);

        if (!$mayBeEmpty) {
            Assert::assertNotSame('', $value, $name);
        }

        return $value;
    }
}
