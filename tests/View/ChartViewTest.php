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
use Fisharebest\Webtrees\View;
use GuzzleHttp\Psr7\ServerRequest;
use MagicSunday\Webtrees\FanChart\Configuration;
use MagicSunday\Webtrees\FanChart\Model\Node;
use MagicSunday\Webtrees\FanChart\Model\NodeData;
use MagicSunday\Webtrees\FanChart\Test\Support\ModuleSettingsFixtureTrait;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

use function ob_get_clean;
use function ob_start;
use function substr_count;

/**
 * Renders the chart view of the fan chart and looks at the script that it emits.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class ChartViewTest extends TestCase
{
    use ModuleSettingsFixtureTrait;

    /**
     * The name of a person is free text of an editor. In an inline script the opener of an HTML
     * comment followed by the opener of a script element switches the parser of the page into a
     * state where the closing tag of the script no longer ends it, so the data of the chart must
     * not carry those sequences raw.
     */
    #[Test]
    public function aNameCannotBreakOutOfTheInlineScript(): void
    {
        $hostile = '<!--<script>&\'"';

        $output = $this->render(
            new Node(
                (new NodeData())
                    ->setXref('X1')
                    ->setName($hostile)
            )
        );

        self::assertStringNotContainsString('<!--', $output);
        self::assertSame(1, substr_count($output, '<script'), 'only the script element of the view opens');
        self::assertSame(1, substr_count($output, '</script>'), 'only the script element of the view closes');
        self::assertStringContainsString('\\u003C!--\\u003Cscript\\u003E\\u0026\\u0027\\u0022', $output);
    }

    /**
     * Every JSON value of the script that can carry text is written with the tag, ampersand and
     * quote characters as escapes, the labels, the style sheets, the asset URL and the abbreviation
     * as well as the chart data. The generated element id is not JSON and stays as it is, as does
     * the integer of the generations.
     */
    #[Test]
    public function everyTextValueOfTheScriptIsEscaped(): void
    {
        $hostile = '<!--<script>';
        $escaped = '\\u003C!--\\u003Cscript\\u003E';

        $output = $this->render(
            null,
            ['labels' => ['zoom' => $hostile, 'move' => '&'], 'nameAbbreviation' => $hostile],
            [$hostile]
        );

        self::assertStringNotContainsString('<!--', $output);
        self::assertSame(1, substr_count($output, '<script'), 'only the script element of the view opens');
        self::assertStringContainsString('asset=1\\u0026hash=2', $output);
        self::assertStringContainsString('"zoom":"' . $escaped . '"', $output);
        self::assertStringContainsString('"move":"\\u0026"', $output);
        self::assertStringContainsString('cssFiles: ["' . $escaped . '"]', $output);
        self::assertStringContainsString('nameAbbreviation: "' . $escaped . '"', $output);
        self::assertStringContainsString('-container-abc', $output);
        self::assertMatchesRegularExpression('/opts\.generations \?\? \d+;/', $output);
    }

    /**
     * The panel switch reaches the chart as the server value, which the browser storage cannot
     * override because the server reads the facts only while it is on.
     */
    #[Test]
    public function handsTheDetailPanelSwitchToTheChart(): void
    {
        $output = $this->render(null);

        self::assertStringContainsString('showDetailPanel: false,', $output);
        self::assertStringNotContainsString('opts.showDetailPanel', $output);

        // The value is the one of the configuration, not a constant of the view
        $enabled = $this->render(null, [], [], ['default_showDetailPanel' => '1']);

        self::assertStringContainsString('showDetailPanel: true,', $enabled);
    }

    /**
     * Renders the view with the variables of the chart action and returns the page together with
     * the script that the view pushes onto the javascript stack.
     *
     * @param Node|null             $chartData         The chart data tree
     * @param array<string, mixed>  $chartParamsChange Values that replace the chart parameters
     * @param list<string>          $stylesheets       The style sheets of the SVG export
     * @param array<string, string> $preferences       The module preferences of the test
     */
    private function render(
        ?Node $chartData,
        array $chartParamsChange = [],
        array $stylesheets = [],
        array $preferences = [],
    ): string {
        $javascript    = 'https://example.test/fan-chart.js?asset=1&hash=2';
        $configuration = new Configuration(
            new ServerRequest(RequestMethodInterface::METHOD_GET, '/'),
            $this->createModuleWithPreferences($preferences)
        );
        $id          = 'abc';
        $chartParams = [
            'rtl'              => false,
            'showSilhouettes'  => true,
            'nameAbbreviation' => 'GIVEN',
            'labels'           => ['zoom' => 'Zoom', 'move' => 'Move'],
            ...$chartParamsChange,
        ];
        $exportStylesheets = $stylesheets;
        $data              = $chartData;

        View::stack('javascript');

        ob_start();

        include __DIR__ . '/../../resources/views/modules/fan-chart/chart.phtml';

        return ob_get_clean() . View::stack('javascript');
    }
}
