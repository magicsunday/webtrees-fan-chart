<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Fisharebest\Webtrees\I18N;
use MagicSunday\Webtrees\FanChart\Support\ContextText;
use MagicSunday\Webtrees\ModuleBase\Testing\EnglishLocaleFixture;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * Tests that a text with the context of the module takes the wording of the module and that a
 * language without such an entry keeps the wording of the webtrees core.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversClass(ContextText::class)]
final class ContextTextTest extends TestCase
{
    /**
     * The entry with the context of the module wins over the translation of the core.
     */
    #[Test]
    public function takesTheTranslationOfTheContextWhenTheCatalogueHasOne(): void
    {
        EnglishLocaleFixture::install([
            "webtrees-fan-chart\x04left" => 'Links',
            'left'                       => 'links',
        ]);

        self::assertSame(
            'Links',
            ContextText::resolve(I18N::translateContext('webtrees-fan-chart', 'left'), 'left')
        );
    }

    /**
     * A language that has no entry for the context shows the translation of the core and not the
     * English source text.
     */
    #[Test]
    public function fallsBackToTheTranslationOfTheCoreWithoutAnEntryForTheContext(): void
    {
        EnglishLocaleFixture::install(['left' => 'links']);

        self::assertSame(
            'links',
            ContextText::resolve(I18N::translateContext('webtrees-fan-chart', 'left'), 'left')
        );
    }

    /**
     * Without any translation the source text stays.
     */
    #[Test]
    public function keepsTheSourceTextWhenNeitherTheContextNorTheCoreTranslatesIt(): void
    {
        EnglishLocaleFixture::install();

        self::assertSame(
            'left',
            ContextText::resolve(I18N::translateContext('webtrees-fan-chart', 'left'), 'left')
        );
    }
}
