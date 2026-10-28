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
use MagicSunday\Webtrees\FanChart\Test\Support\EnglishLocaleFixture;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use MagicSunday\Webtrees\FanChart\Test\Support\ViewFixture;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function ob_get_clean;
use function ob_start;

/**
 * Renders the details part of the options form and looks at the checkbox of the detail panel.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class DetailsFormViewTest extends TestCase
{
    use ModuleSettingsFixtureTrait;

    /**
     * Returns the module preferences that decide whether the box starts checked, which is the
     * dimension the cases vary.
     *
     * @return array<string, array{array<string, string>, bool}>
     */
    public static function checkedStateProvider(): array
    {
        return [
            'off by default'           => [[], false],
            'administrator default'    => [['default_showDetailPanel' => '1'], true],
            'administrator turned off' => [['default_showDetailPanel' => '0'], false],
        ];
    }

    /**
     * The form offers the checkbox of the detail panel in the state of the configuration, together
     * with a hidden field that submits the value 0 while the box is unchecked, otherwise the form
     * would not carry the switch at all.
     *
     * @param array<string, string> $preferences The module preferences of the case
     * @param bool                  $checked     Whether the box has to start checked
     */
    #[Test]
    #[DataProvider('checkedStateProvider')]
    public function offersTheDetailPanelCheckboxInTheConfiguredState(array $preferences, bool $checked): void
    {
        $xpath = ViewFixture::xpathOf($this->render($preferences));

        $boxes = ViewFixture::elements($xpath, '//input[@type="checkbox"][@name="showDetailPanel"]');

        self::assertCount(1, $boxes, 'the form offers one checkbox for the panel');
        self::assertSame($checked, $boxes[0]->hasAttribute('checked'));
        self::assertSame('1', $boxes[0]->getAttribute('value'));

        $hidden = ViewFixture::elements($xpath, '//input[@type="hidden"][@name="showDetailPanel"]');

        self::assertCount(1, $hidden, 'the form submits the unchecked value');
        self::assertSame('0', $hidden[0]->getAttribute('value'));
    }

    /**
     * Renders the details part of the form with the given module preferences.
     *
     * @param array<string, string> $preferences The module preferences of the test
     */
    private function render(array $preferences): string
    {
        ViewFixture::register();
        EnglishLocaleFixture::install();

        $configuration = new Configuration(
            new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
            $this->createModuleWithPreferences($preferences)
        );
        $moduleName = ViewFixture::MODULE_NAME;

        ob_start();

        include __DIR__ . '/../../resources/views/modules/fan-chart/form/details.phtml';

        $markup = ob_get_clean();

        self::assertIsString($markup);

        return $markup;
    }
}
