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

use function ob_get_clean;
use function ob_start;

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

        self::assertSame('false', $button->getAttribute('aria-expanded'));
        self::assertNotSame('', $popover->getAttribute('id'));
        self::assertSame($popover->getAttribute('id'), $button->getAttribute('aria-controls'));
        self::assertSame('region', $popover->getAttribute('role'));
        self::assertNotSame('', $popover->getAttribute('aria-label'));
        self::assertStringContainsString('d-none', $popover->getAttribute('class'));
    }

    /**
     * The popover lists the interactions of both modes of the chart. The entries of the mode with
     * the tooltip start visible, the entries of the mode with the detail panel start hidden, and the
     * page script switches them with the checkbox. The entries for zooming and moving apply to both
     * modes and carry no mode.
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
        self::assertCount(2, $both, 'zooming and moving apply to both modes');

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
     */
    private function render(): string
    {
        EnglishLocaleFixture::install();

        ob_start();

        include __DIR__ . '/../../resources/views/modules/components/buttonbar/help-button.phtml';

        $markup = ob_get_clean();

        self::assertIsString($markup);

        return $markup;
    }
}
