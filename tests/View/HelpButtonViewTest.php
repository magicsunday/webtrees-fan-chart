<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\View;

use DOMElement;
use MagicSunday\Webtrees\FanChart\Test\Support\EnglishLocaleFixture;
use MagicSunday\Webtrees\FanChart\Test\Support\ViewFixture;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function array_map;
use function ob_get_clean;
use function ob_start;
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
     * The button tells assistive technology that it controls the popover and whether that is open,
     * and the popover is a named region with the id that the button points to. The popover starts
     * closed, so the button starts with the state collapsed.
     */
    #[Test]
    public function exposesTheStateOfThePopoverOnTheButton(): void
    {
        $xpath = ViewFixture::xpathOf($this->render());

        $button  = ViewFixture::first($xpath, '//button[contains(concat(" ", @class, " "), " btn-help ")]');
        $popover = ViewFixture::first($xpath, '//div[contains(concat(" ", @class, " "), " help-popover ")]');

        self::assertSame('button', $button->getAttribute('type'));
        self::assertSame('false', $button->getAttribute('aria-expanded'));
        self::assertNotSame('', $popover->getAttribute('id'));
        self::assertSame($popover->getAttribute('id'), $button->getAttribute('aria-controls'));
        self::assertSame('region', $popover->getAttribute('role'));
        self::assertNotSame('', $popover->getAttribute('aria-label'));
        self::assertStringContainsString('d-none', $popover->getAttribute('class'));
    }

    /**
     * A translation can contain a quote, an ampersand or a tag. The title and the label are
     * attribute values, so both are escaped and keep the translated text as one value.
     */
    #[Test]
    public function keepsATranslatedTitleAndLabelInsideTheirAttributes(): void
    {
        $text  = 'Say "help" &amp; <b>more</b>';
        $xpath = ViewFixture::xpathOf($this->render(['Show help' => $text]));

        $button  = ViewFixture::first($xpath, '//button[contains(concat(" ", @class, " "), " btn-help ")]');
        $popover = ViewFixture::first($xpath, '//div[contains(concat(" ", @class, " "), " help-popover ")]');

        self::assertSame($text, $button->getAttribute('title'));
        self::assertSame($text, $popover->getAttribute('aria-label'));
    }

    /**
     * The popover lists the interactions of both modes of the chart. The entries of the mode with
     * the tooltip start visible, the entries of the mode with the detail panel start hidden, and the
     * page script switches them with the checkbox. The entries for the Tab key, zooming and moving
     * apply to both modes and carry no mode.
     */
    #[Test]
    public function marksTheEntriesOfEachMode(): void
    {
        $xpath = ViewFixture::xpathOf($this->render());

        $tooltip = ViewFixture::elements($xpath, '//tr[@data-help-mode="tooltip"]');
        $panel   = ViewFixture::elements($xpath, '//tr[@data-help-mode="panel"]');
        $both    = ViewFixture::elements($xpath, '//tr[not(@data-help-mode)]');

        self::assertNotSame([], $tooltip);
        self::assertNotSame([], $panel);
        self::assertSame(
            ['Tab key', 'Ctrl + scroll', 'Click and drag'],
            array_map(
                static fn (DOMElement $label): string => trim($label->textContent),
                ViewFixture::elements($xpath, '//tr[not(@data-help-mode)]/td[1]/strong'),
            ),
            'moving between the persons, zooming and moving apply to both modes',
        );

        foreach ($tooltip as $row) {
            self::assertStringNotContainsString('d-none', $row->getAttribute('class'));
        }

        foreach ($panel as $row) {
            self::assertStringContainsString('d-none', $row->getAttribute('class'));
        }

        foreach ($both as $row) {
            self::assertStringNotContainsString('d-none', $row->getAttribute('class'));
        }
    }

    /**
     * The row for the Tab key applies to both modes, because the persons are reached with the keyboard
     * with the detail panel as well as without it.
     */
    #[Test]
    public function sharesTheTabKeyRowBetweenBothModes(): void
    {
        $xpath = ViewFixture::xpathOf($this->render());

        $row = ViewFixture::first($xpath, '//tr[td/strong[normalize-space() = "Tab key"]]');

        self::assertFalse($row->hasAttribute('data-help-mode'));
        self::assertStringNotContainsString('d-none', $row->getAttribute('class'));
    }

    /**
     * The toggle lives in the page script, which also closes the popover on Escape, so the markup
     * carries no inline click handler that would toggle it a second time.
     */
    #[Test]
    public function carriesNoInlineClickHandler(): void
    {
        $xpath = ViewFixture::xpathOf($this->render());

        self::assertSame([], ViewFixture::elements($xpath, '//*[@onclick]'));
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
