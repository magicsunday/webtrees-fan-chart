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
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function ob_get_clean;
use function ob_start;

/**
 * Renders the buttons of the toolbar, whose titles are translated texts.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class ToolbarButtonsViewTest extends TestCase
{
    /**
     * Returns the views of the buttons with the source text of their title.
     *
     * @return array<string, array{string, string}>
     */
    public static function buttonTitles(): array
    {
        return [
            'full screen' => ['fullscreen-button', 'Switch between full screen mode and normal view'],
            'center'      => ['center-button', 'Re center'],
            'png export'  => ['png-export-button', 'Export as PNG'],
            'svg export'  => ['svg-export-button', 'Export as SVG'],
        ];
    }

    /**
     * A translation can contain a quote, an ampersand or a tag. The title is an attribute value, so
     * it is escaped and keeps the translated text as one value.
     */
    #[Test]
    #[DataProvider('buttonTitles')]
    public function keepsATranslatedTitleInsideItsAttribute(string $view, string $source): void
    {
        $text  = 'Say "more" & <b>less</b>';
        $xpath = ViewFixture::xpathOf($this->render($view, [$source => $text]));

        self::assertSame($text, ViewFixture::first($xpath, '//button')->getAttribute('title'));
    }

    /**
     * Renders the view of a button with the given translations.
     *
     * @param string                $view     The name of the view in the button bar folder
     * @param array<string, string> $messages The translations by source text
     */
    private function render(string $view, array $messages): string
    {
        EnglishLocaleFixture::install($messages);

        ob_start();

        include __DIR__ . '/../../resources/views/modules/components/buttonbar/' . $view . '.phtml';

        $markup = ob_get_clean();

        self::assertIsString($markup);

        return $markup;
    }
}
