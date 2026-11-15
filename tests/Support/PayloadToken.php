<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use PHPUnit\Framework\TestCase;

use function ctype_digit;
use function preg_match;
use function preg_quote;
use function preg_replace;
use function str_contains;

/**
 * Looks for a value in the JSON text of a chart payload. A numeric value such as a year only counts
 * when no letter or digit touches it, because the payload also holds asset URLs with a signature
 * in hexadecimal digits and a numeric hash parameter that can contain the digits of a year inside a
 * longer run of characters, and a JSON escape does not count as a letter or digit. Any other value
 * is a plain substring search.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class PayloadToken
{
    /**
     * Private constructor, the class only holds static helpers.
     */
    private function __construct()
    {
    }

    /**
     * Returns whether the payload holds the token, a numeric token only when no letter or digit
     * touches it.
     *
     * @param string $payload The JSON text
     * @param string $token   The value to look for
     */
    public static function occursIn(string $payload, string $token): bool
    {
        if (!ctype_digit($token)) {
            return str_contains($payload, $token);
        }

        // A JSON escape ends in a letter or hex digits, so it would glue itself to a year that
        // follows it (a dash between years is written as a unicode escape). A space keeps the
        // boundary of the year. An escaped backslash is consumed as a unit, so the letter after
        // it stays a plain letter.
        $text = preg_replace('/\\\\(?:\\\\|u[0-9a-fA-F]{4}|[bfnrt])/', ' ', $payload) ?? $payload;

        return preg_match('/(?<![0-9A-Za-z])' . preg_quote($token, '/') . '(?![0-9A-Za-z])/', $text) === 1;
    }

    /**
     * Asserts that the payload holds the token.
     *
     * @param TestCase $test    The running test
     * @param string   $token   The value to look for
     * @param string   $payload The JSON text
     * @param string   $message The failure message
     */
    public static function assertPresent(TestCase $test, string $token, string $payload, string $message): void
    {
        $test::assertTrue(self::occursIn($payload, $token), $message);
    }

    /**
     * Asserts that the payload does not hold the token.
     *
     * @param TestCase $test    The running test
     * @param string   $token   The value to look for
     * @param string   $payload The JSON text
     * @param string   $message The failure message
     */
    public static function assertAbsent(TestCase $test, string $token, string $payload, string $message): void
    {
        $test::assertFalse(self::occursIn($payload, $token), $message);
    }
}
