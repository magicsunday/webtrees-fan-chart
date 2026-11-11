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
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\FanChart\Test\Support\ViewFixture;
use MagicSunday\Webtrees\ModuleBase\Testing\EnglishLocaleFixture;
use MagicSunday\Webtrees\ModuleBase\Testing\MarkupFixture;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function array_diff;
use function array_keys;
use function array_values;
use function ob_get_clean;
use function ob_start;
use function substr_count;

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
     * The options form is posted to the chart route, where the configuration reads the settings
     * under their request keys. A field whose name is not such a key is submitted and silently
     * ignored, and the chart then ignores the setting that the visitor changed. The check is one-way
     * and collects every input, select and textarea with a name inside the form, the person selector,
     * the sliders, the display mode radios and the checkboxes with their hidden twins. It does not
     * demand that every request key has a field, because the display mode field stands for the two
     * switches of the images and the names.
     */
    #[Test]
    public function everyFieldOfTheOptionsFormIsNamedLikeARequestKeyOfTheConfiguration(): void
    {
        $xpath = MarkupFixture::xpathOf($this->render());
        $names = [];

        foreach (MarkupFixture::elements($xpath, '//form[@id="webtrees-fan-chart-form"]//*[self::input or self::select or self::textarea][@name]') as $field) {
            $names[] = $field->getAttribute('name');
        }

        $configuration = new Configuration(
            new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
            $this->createModuleWithPreferences([])
        );

        // The person is read by the route, the display mode stands for the two switches of the images and
        // the names, and the token belongs to the form post of webtrees.
        $requestKeys = [...array_keys($configuration->getRouteToggleParams()), 'xref', 'displayMode', '_csrf'];

        foreach (['xref', 'displayMode', 'generations', 'fontScale', 'showDetailPanel'] as $reached) {
            self::assertContains($reached, $names, 'the collection reaches the field ' . $reached);
        }

        self::assertSame([], array_values(array_diff($names, $requestKeys)));
    }

    /**
     * A translation can contain a quote, an ampersand or a tag. The label of the submit button is an
     * attribute value, so it is escaped and keeps the translated text as one value.
     */
    #[Test]
    public function keepsATranslatedLabelOfTheSubmitButtonInsideItsAttribute(): void
    {
        $text  = 'Say "more" &amp; <b>less</b>';
        $xpath = MarkupFixture::xpathOf($this->render('https://example.test/ajax', ['view' => $text]));

        self::assertSame($text, MarkupFixture::first($xpath, '//input[@type="submit"]')->getAttribute('value'));
    }

    /**
     * The module words the submit button differently from the webtrees core. The wording of the
     * module comes with the name of the module as its context, and a language without an entry for
     * that context keeps the wording of the core.
     */
    #[Test]
    public function showsTheWordingOfTheModuleOrOtherwiseOfTheCoreOnTheSubmitButton(): void
    {
        $context = "webtrees-fan-chart\x04view";

        $withContext = MarkupFixture::xpathOf($this->render('https://example.test/ajax', [$context => 'Anzeigen', 'view' => 'zeige']));
        $withoutIt   = MarkupFixture::xpathOf($this->render('https://example.test/ajax', ['view' => 'zeige']));

        self::assertSame('Anzeigen', MarkupFixture::first($withContext, '//input[@type="submit"]')->getAttribute('value'));
        self::assertSame('zeige', MarkupFixture::first($withoutIt, '//input[@type="submit"]')->getAttribute('value'));
    }

    /**
     * The panel carries the shared class that the shared CSS is scoped to next to the class of the
     * module, and every translated text of the page is the text of its own part, so a text that is
     * swapped or dropped is caught. The escaping of the texts is the business of the shared view.
     */
    #[Test]
    public function rendersThePanelWithBothClassesAndEveryTranslatedTextAsText(): void
    {
        $messages = [
            'Select a person in the chart to see the details here.' => 'Hint <i>one</i> &amp; "x"',
            'No details are available for this person.'             => 'Empty <i>two</i> &amp; "y"',
            'Open individual page'                                  => 'Individual <i>three</i> &amp; "z"',
            'Center chart on this person'                           => 'Center <i>four</i> &amp; "w"',
            'close'                                                 => 'Close <i>five</i> &amp; "v"',
        ];

        $xpath = MarkupFixture::xpathOf($this->render('https://example.test/ajax', $messages));
        $panel = MarkupFixture::first($xpath, '//aside[@id="webtrees-fan-detail-panel"]');

        foreach (['webtrees-detail-panel', 'webtrees-fan-detail-panel'] as $class) {
            self::assertContains($class, explode(' ', $panel->getAttribute('class')), 'the panel carries the class ' . $class);
        }

        $parts = [
            'hint'       => 'Select a person in the chart to see the details here.',
            'empty'      => 'No details are available for this person.',
            'individual' => 'Open individual page',
            'center'     => 'Center chart on this person',
        ];

        foreach ($parts as $part => $source) {
            self::assertSame(
                $messages[$source],
                trim(MarkupFixture::first($xpath, '//aside[@id="webtrees-fan-detail-panel"]//*[@data-panel="' . $part . '"]')->textContent),
                'the part ' . $part . ' shows its translated text as text'
            );
        }

        self::assertSame(
            $messages['close'],
            MarkupFixture::first($xpath, '//aside[@id="webtrees-fan-detail-panel"]//button[contains(concat(" ", @class, " "), " btn-close ")]')->getAttribute('aria-label'),
            'the close button is named by its translated text'
        );
    }

    /**
     * The toolbar buttons get their rules from the shared view, written once as a style element that
     * is scoped to the container of the chart, so the buttons are styled from the first paint and the
     * stylesheet of the module carries no copy of them.
     */
    #[Test]
    public function rendersTheToolbarStyleOnceForTheFullscreenContainer(): void
    {
        $output = $this->render();

        self::assertSame(
            1,
            substr_count($output, '.webtrees-fan-fullscreen-container .btn-chart {'),
            'the toolbar rules are written once'
        );

        $xpath = MarkupFixture::xpathOf($output);

        self::assertCount(
            1,
            MarkupFixture::elements($xpath, '//div[contains(concat(" ", @class, " "), " webtrees-fan-fullscreen-container ")]'),
            'the container that the rules name exists once'
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
