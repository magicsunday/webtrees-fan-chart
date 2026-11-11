<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use PHPUnit\Framework\AssertionFailedError;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Tests that a numeric token is found as a whole number only, so that the digits of an asset hash
 * never count as a year, while a real year in a field of the payload is still found.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class PayloadTokenTest extends TestCase
{
    /**
     * Payloads and the tokens that they hold.
     *
     * @return iterable<string, array{string, string}>
     */
    public static function presentTokens(): iterable
    {
        yield 'year in a date field' => ['{"birthDate":"1 JAN 1896"}', '1896'];
        yield 'year as the whole value' => ['{"birth":"1896"}', '1896'];
        yield 'year before a dash' => ['{"timespan":"1896-1950"}', '1896'];
        yield 'year after a dash' => ['{"timespan":"1850-1896"}', '1896'];
        yield 'year next to a hash that does not hold it' => ['{"url":"a.png?hash=1794418966","birth":"1896"}', '1896'];
        yield 'year after an escaped en dash' => ['{"timespan":"1850\u20131896"}', '1896'];
        yield 'year before an escaped en dash' => ['{"timespan":"1896\u20131950"}', '1896'];
        yield 'year after an escaped en dash next to a hash' => ['{"hash":"1794418966","timespan":"1850\u20131896"}', '1896'];
        yield 'name' => ['{"name":"Livingfather"}', 'Livingfather'];
        yield 'name inside a longer word' => ['{"name":"Livingfathers"}', 'Livingfather'];
    }

    /**
     * Payloads and the tokens that they do not hold.
     *
     * @return iterable<string, array{string, string}>
     */
    public static function absentTokens(): iterable
    {
        yield 'year inside the digits of an asset hash' => ['{"silhouette":"/m.png?hash=1794418966"}', '1896'];
        yield 'year at the start of a longer number' => ['{"hash":"18961234"}', '1896'];
        yield 'year at the end of a longer number' => ['{"hash":"12341896"}', '1896'];
        yield 'year inside a longer number' => ['{"hash":"1234189656"}', '1896'];
        yield 'name' => ['{"name":"Publicfather"}', 'Livingfather'];
        yield 'year glued to a longer number after an escaped en dash' => ['{"timespan":"1850\u201318961"}', '1896'];
        yield 'year inside a hash next to an escaped en dash' => ['{"timespan":"1850\u20131900","hash":"1794418966"}', '1896'];
        yield 'empty payload' => ['', '1896'];
    }

    /**
     * A token that the payload holds is found.
     *
     * @param string $payload The JSON text
     * @param string $token   The value to look for
     */
    #[Test]
    #[DataProvider('presentTokens')]
    public function findsAHeldToken(string $payload, string $token): void
    {
        self::assertTrue(PayloadToken::occursIn($payload, $token));
    }

    /**
     * A token that the payload does not hold is not found, in particular a year that only shows as
     * a digit sequence of a longer number.
     *
     * @param string $payload The JSON text
     * @param string $token   The value to look for
     */
    #[Test]
    #[DataProvider('absentTokens')]
    public function doesNotFindAnAbsentToken(string $payload, string $token): void
    {
        self::assertFalse(PayloadToken::occursIn($payload, $token));
    }

    /**
     * The absence assertion passes for a hash that holds the digits of a private year, and fails
     * for a real private year.
     */
    #[Test]
    public function absenceAssertionIgnoresHashesAndCatchesYears(): void
    {
        PayloadToken::assertAbsent($this, '1896', '{"silhouette":"/m.png?hash=1794418966"}', 'hash');

        $this->expectException(AssertionFailedError::class);
        PayloadToken::assertAbsent($this, '1896', '{"birthDate":"1 JAN 1896"}', 'date');
    }

    /**
     * The presence assertion fails when a public year only shows inside the digits of a hash.
     */
    #[Test]
    public function presenceAssertionDoesNotPassOnAHash(): void
    {
        PayloadToken::assertPresent($this, '1900', '{"birth":"1900"}', 'date');

        $this->expectException(AssertionFailedError::class);
        PayloadToken::assertPresent($this, '1900', '{"hash":"21900123"}', 'hash');
    }
}
