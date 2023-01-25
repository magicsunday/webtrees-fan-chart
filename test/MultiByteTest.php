<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test;

use DOMXPath;
use MagicSunday\Webtrees\FanChart\Module;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * MultiByteTest.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class MultiByteTest extends TestCase
{
    /**
     * @return string[][]
     */
    public function encodingDataProvider(): array
    {
        // [ input, expected ]
        return [
            // German umlauts
            [
                '<div>abc <span>äöü</span> <p>&#228;&#246;&#252;</p></div>',
                'abc äöü äöü',
            ],

            // Euro sign
            [
                '€ &#8364;',
                '€ €',
            ],

            // Korean
            [
                '박성욱',
                '박성욱',
            ],
            [
                '<span><span>&#48149;</span>&#49457;&#50865;</span>',
                '박성욱',
            ],
        ];
    }

    /**
     * Tests conversion of UTF-8 characters to HTML entities.
     *
     * @test
     * @dataProvider encodingDataProvider
     *
     * @param string $input
     * @param string $expected
     *
     * @return void
     */
    public function convertUtf8ToHtmlEntities(string $input, string $expected): void
    {
        $reflection = new ReflectionClass(Module::class);
        $method = $reflection->getMethod('getXPath');
        $method->setAccessible(true);

        $module = new Module();
        $result = $method->invokeArgs($module, [ $input ]);

        self::assertInstanceOf(DOMXPath::class, $result);
        self::assertSame($expected, $result->query('*')->item(0)->nodeValue);
    }
}
