<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\View;

use MagicSunday\Webtrees\FanChart\Test\Support\EnglishLocaleFixture;
use MagicSunday\Webtrees\FanChart\Test\Support\ViewFixture;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function count;
use function ob_get_clean;
use function ob_start;
use function str_contains;
use function trim;

/**
 * Renders the help button of the toolbar with its popover.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class HelpButtonViewTest extends TestCase
{
    /**
     * The rows follow each other in a fixed order, each with its own mode and its own text, so a row
     * that moves to the other mode or to another place changes what the help shows in each mode. The
     * popover starts in the mode with the tooltip, so the rows of that mode and the rows without a
     * mode are visible and the rows of the mode with the detail panel are hidden. The button has a
     * title, because the icon is the only content of it.
     */
    #[Test]
    public function listsTheRowsInTheirOrderWithTheirModes(): void
    {
        $xpath    = ViewFixture::xpathOf($this->render());
        $expected = [
            ['tooltip', 'Right-click', 'Show details of a person'],
            ['tooltip', 'Click on a person', 'Reload chart for that person'],
            ['', 'Tab key', 'Move between the persons'],
            ['panel', 'Click or Enter on a person', 'Show the details of the person in the panel'],
            ['panel', 'Details panel', 'Open the individual page or center the chart on the person'],
            ['', 'Ctrl + scroll', 'Zoom in/out'],
            ['', 'Click and drag', 'Move the chart'],
        ];

        self::assertCount(count($expected), ViewFixture::elements($xpath, '//tr'));

        foreach ($expected as $index => [$mode, $key, $text]) {
            $row = '(//tr)[' . ($index + 1) . ']';

            self::assertSame(
                $mode,
                ViewFixture::first($xpath, $row)->getAttribute('data-help-mode'),
                'the row ' . $key . ' belongs to the mode ' . ($mode === '' ? 'of both' : $mode)
            );
            self::assertSame($key, trim(ViewFixture::first($xpath, $row . '/td[1]')->textContent));
            self::assertSame($text, trim(ViewFixture::first($xpath, $row . '/td[2]')->textContent));
            self::assertSame(
                $mode === 'panel',
                str_contains(ViewFixture::first($xpath, $row)->getAttribute('class'), 'd-none'),
                'the row ' . $key . ' is hidden exactly when it belongs to the mode with the panel'
            );
        }

        $button = ViewFixture::first($xpath, '//button[contains(concat(" ", @class, " "), " btn-help ")]');

        self::assertNotSame('', $button->getAttribute('title'));
    }

    /**
     * Renders the help button.
     *
     * @param array<string, string> $messages The translations by source text
     */
    private function render(array $messages = []): string
    {
        EnglishLocaleFixture::install($messages);
        ViewFixture::register();

        ob_start();

        include __DIR__ . '/../../resources/views/modules/components/buttonbar/help-button.phtml';

        $markup = ob_get_clean();

        self::assertIsString($markup);

        return $markup;
    }
}
