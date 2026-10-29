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
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Tree;
use Fisharebest\Webtrees\View;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Test\Support\EnglishLocaleFixture;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\FanChart\Test\Support\ViewFixture;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function ob_get_clean;
use function ob_start;

/**
 * Renders the page view of the fan chart and looks at the detail panel that it carries.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class PageViewTest extends TestCase
{
    use ModuleSettingsFixtureTrait;

    /**
     * The panel script of the chart library looks up its parts by the data-panel attribute and throws
     * for a part that the markup lacks, so the page has to carry each of them exactly once, in a
     * panel that stays hidden until the script enables it and that is named by its own heading.
     */
    #[Test]
    public function carriesTheHiddenPanelWithEveryPartTheScriptLooksUp(): void
    {
        $xpath  = ViewFixture::xpathOf($this->render());
        $panels = ViewFixture::elements($xpath, '//aside[@id="webtrees-fan-detail-panel"]');

        self::assertCount(1, $panels, 'the page carries exactly one panel element');

        $panel = $panels[0];

        self::assertTrue($panel->hasAttribute('hidden'), 'the panel stays hidden until the script enables it');
        self::assertSame('webtrees-fan-detail-panel-title', $panel->getAttribute('aria-labelledby'));

        foreach (['title', 'image', 'hint', 'facts', 'empty', 'actions', 'individual', 'center'] as $part) {
            self::assertCount(
                1,
                ViewFixture::elements($xpath, '//aside[@id="webtrees-fan-detail-panel"]//*[@data-panel="' . $part . '"]'),
                'the panel carries the part ' . $part . ' once'
            );
        }

        $headings = ViewFixture::elements($xpath, '//*[@id="webtrees-fan-detail-panel-title"]');

        self::assertCount(1, $headings);
        self::assertSame('title', $headings[0]->getAttribute('data-panel'), 'the heading that names the panel is the title part');
    }

    /**
     * The two actions are buttons that the panel script binds, and the parts that the script shows
     * only on demand are hidden in the markup.
     */
    #[Test]
    public function hidesThePartsThatTheScriptShowsOnDemand(): void
    {
        $xpath = ViewFixture::xpathOf($this->render());

        foreach (['image', 'empty', 'actions'] as $part) {
            self::assertTrue(
                ViewFixture::first($xpath, '//*[@data-panel="' . $part . '"]')->hasAttribute('hidden'),
                'the part ' . $part . ' starts hidden'
            );
        }

        self::assertFalse(
            ViewFixture::first($xpath, '//*[@data-panel="hint"]')->hasAttribute('hidden'),
            'the hint is what a panel without a selection shows'
        );

        foreach (['individual', 'center'] as $action) {
            self::assertSame('button', ViewFixture::first($xpath, '//*[@data-panel="' . $action . '"]')->tagName);
        }
    }

    /**
     * The URL is written into an inline script. Like every value of the chart view, it is encoded
     * with the tag, ampersand, apostrophe and quote flags, so text that opens or closes an element
     * or a string cannot leave the script, whatever a route builder hands over.
     */
    #[Test]
    public function encodesTheAjaxUrlWithTheHexFlags(): void
    {
        $output = $this->render('https://example.test/ajax?a=<!--<script>&\'"');

        self::assertStringNotContainsString('<!--<script>', $output, 'the text of the URL does not open an element');
        self::assertStringContainsString(
            'ajaxUrl:                        "https:\\/\\/example.test\\/ajax?a=\\u003C!--\\u003Cscript\\u003E\\u0026\\u0027\\u0022"',
            $output
        );
    }

    /**
     * A translation can contain a quote, an ampersand or a tag. The label of the submit button is an
     * attribute value, so it is escaped and keeps the translated text as one value.
     */
    #[Test]
    public function keepsATranslatedLabelOfTheSubmitButtonInsideItsAttribute(): void
    {
        $text  = 'Say "more" &amp; <b>less</b>';
        $xpath = ViewFixture::xpathOf($this->render('https://example.test/ajax', ['view' => $text]));

        self::assertSame($text, ViewFixture::first($xpath, '//input[@type="submit"]')->getAttribute('value'));
    }

    /**
     * The label of the close button of the offcanvas is an attribute value too, so it is escaped and
     * keeps the translated text as one value.
     */
    #[Test]
    public function keepsATranslatedLabelOfTheCloseButtonInsideItsAttribute(): void
    {
        $text  = 'Say "close" &amp; <b>now</b>';
        $xpath = ViewFixture::xpathOf($this->render('https://example.test/ajax', ['close' => $text]));

        self::assertSame(
            $text,
            ViewFixture::first($xpath, '//button[contains(concat(" ", @class, " "), " btn-close ")]')->getAttribute('aria-label')
        );
    }

    /**
     * Renders the page view with the variables of the page action, followed by the scripts that the
     * view pushed onto the javascript stack.
     *
     * @param array<string, string> $messages The translations by source text
     */
    private function render(string $url = 'https://example.test/ajax', array $messages = []): string
    {
        ViewFixture::register();
        EnglishLocaleFixture::install($messages);

        $configuration = new Configuration(
            new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
            $this->createModuleWithPreferences([])
        );
        $title             = 'Fan chart';
        $moduleName        = ViewFixture::MODULE_NAME;
        $individual        = self::createStub(Individual::class);
        $tree              = self::createStub(Tree::class);
        $chartParams       = [];
        $id                = [];
        $exportStylesheets = [];
        $javascript        = 'https://example.test/fan-chart-page.js';
        $stylesheets       = [];
        $ajaxUrl           = $url;

        View::stack('styles');
        View::stack('javascript');

        ob_start();

        include __DIR__ . '/../../resources/views/modules/fan-chart/page.phtml';

        $markup = ob_get_clean();

        self::assertIsString($markup);

        return $markup . View::stack('javascript');
    }
}
