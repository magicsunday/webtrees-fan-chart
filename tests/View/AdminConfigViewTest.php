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
use MagicSunday\Webtrees\ModuleBase\Testing\RoutingFixture;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function ob_get_clean;
use function ob_start;
use function trim;

/**
 * Tests the wording of the heading of the general part of the administration page.
 *
 * The module words the heading differently from the webtrees core, so it carries the name of the
 * module as its context. A language without an entry for that context keeps the wording of the core.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class AdminConfigViewTest extends TestCase
{
    use ModuleSettingsFixtureTrait;

    /**
     * The catalogues of the cases by source text. A key with the context of the module holds the
     * wording of the module, a plain key holds the wording of the core.
     *
     * @return array<string, array{array<string, string>, string}>
     */
    public static function wordingProvider(): array
    {
        return [
            'the module wording of the context wins' => [
                ["webtrees-fan-chart\x04General" => 'Allgemein', 'General' => 'Allgemeines'],
                'Allgemein',
            ],
            'a language without a context keeps the core wording' => [
                ['General' => 'Allgemeines'],
                'Allgemeines',
            ],
            'no translation keeps the source text' => [
                [],
                'General',
            ],
        ];
    }

    /**
     * The heading of the part that holds the export and placeholder switches shows the wording that
     * the catalogue gives it.
     *
     * @param array<string, string> $messages The translations by source text
     * @param string                $heading  The expected heading
     */
    #[Test]
    #[DataProvider('wordingProvider')]
    public function showsTheWordingOfTheCatalogueForTheHeadingOfTheGeneralPart(array $messages, string $heading): void
    {
        $xpath = MarkupFixture::xpathOf($this->render($messages));

        self::assertSame(
            $heading,
            trim(
                MarkupFixture::first(
                    $xpath,
                    '//div[contains(@class, "wt-page-options-label")][following-sibling::div//input[@name="hideSvgExport"]]'
                )->textContent
            )
        );
    }

    /**
     * Renders the administration page with the given translations.
     *
     * @param array<string, string> $messages The translations by source text
     */
    private function render(array $messages): string
    {
        ViewFixture::register();
        RoutingFixture::register();
        EnglishLocaleFixture::install($messages);

        $configuration = new Configuration(
            new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
            $this->createModuleWithPreferences([])
        );
        $moduleName  = ViewFixture::MODULE_NAME;
        $title       = 'Fan chart';
        $description = 'A fan chart.';

        ob_start();

        include __DIR__ . '/../../resources/views/modules/fan-chart/config.phtml';

        $markup = ob_get_clean();

        self::assertIsString($markup);

        return $markup;
    }
}
