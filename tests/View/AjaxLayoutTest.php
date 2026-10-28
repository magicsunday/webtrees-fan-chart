<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\View;

use Fisharebest\Webtrees\View;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function ob_get_clean;
use function ob_start;

/**
 * Renders the layout of the ajax response that carries the chart.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class AjaxLayoutTest extends TestCase
{
    /**
     * The page that loads the chart links the stylesheets of the module in its head already. The
     * response that fills the chart container must not link them a second time, even when the
     * chart action still hands a list of stylesheets to the layout.
     */
    #[Test]
    public function linksNoStylesheetThatThePageAlreadyLinks(): void
    {
        $content     = '<div id="chart"></div>';
        $stylesheets = ['https://example.test/chart.css', 'https://example.test/svg.css'];

        View::stack('styles');
        View::stack('javascript');

        ob_start();

        include __DIR__ . '/../../resources/views/layouts/ajax.phtml';

        $output = ob_get_clean();

        self::assertIsString($output);
        self::assertStringContainsString($content, $output);
        self::assertStringNotContainsString('<link', $output);
    }
}
