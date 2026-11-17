<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\View;

use Fig\Http\Message\RequestMethodInterface;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\FanChart\Test\Support\ViewFixture;
use MagicSunday\Webtrees\ModuleBase\Testing\EnglishLocaleFixture;
use MagicSunday\Webtrees\ModuleBase\Testing\MarkupFixture;
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
    use ModuleSettingsFixtureTrait;

    /**
     * Returns the buttons that the button bar renders through the shared views of the module base, with
     * the id that the page script looks up and the source text of their title.
     *
     * @return array<string, array{string, string}>
     */
    public static function sharedButtons(): array
    {
        return [
            'center'     => ['centerButton', 'Re center'],
            'png export' => ['exportPNG', 'Export as PNG'],
            'svg export' => ['exportSVG', 'Export as SVG'],
        ];
    }

    /**
     * A translation can contain a quote, an ampersand or a tag. The title is an attribute value, so
     * it is escaped and keeps the translated text as one value.
     */
    #[Test]
    public function keepsATranslatedTitleOfTheFullScreenButtonInsideItsAttribute(): void
    {
        $source = 'Switch between full screen mode and normal view';
        $text   = 'Say "more" &amp; <b>less</b>';

        EnglishLocaleFixture::install([$source => $text]);

        ob_start();

        include __DIR__ . '/../../resources/views/modules/components/buttonbar/fullscreen-button.phtml';

        $markup = ob_get_clean();

        self::assertIsString($markup);

        $xpath = MarkupFixture::xpathOf($markup);

        self::assertSame($text, MarkupFixture::first($xpath, '//button')->getAttribute('title'));
    }

    /**
     * The button bar translates the title of each shared button in the view of the module, so the
     * source text stays in the catalogue extraction of the module, and the shared view escapes it.
     */
    #[Test]
    #[DataProvider('sharedButtons')]
    public function passesTheTranslatedTitleToTheSharedButton(string $id, string $source): void
    {
        $text   = 'Say "more" &amp; <b>less</b>';
        $xpath  = MarkupFixture::xpathOf($this->renderButtonBar([$source => $text]));
        $button = MarkupFixture::first($xpath, '//button[@id="' . $id . '"]');

        self::assertSame($text, $button->getAttribute('title'));
    }

    /**
     * Renders the button bar of the module with the given translations.
     *
     * @param array<string, string> $messages The translations by source text
     */
    private function renderButtonBar(array $messages): string
    {
        ViewFixture::register();
        EnglishLocaleFixture::install($messages);

        $configuration = new Configuration(
            new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
            $this->createModuleWithPreferences([])
        );
        $moduleName = ViewFixture::MODULE_NAME;

        ob_start();

        include __DIR__ . '/../../resources/views/modules/components/buttonbar.phtml';

        $markup = ob_get_clean();

        self::assertIsString($markup);

        return $markup;
    }
}
