<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Fisharebest\Webtrees\View;
use PHPUnit\Framework\AssertionFailedError;

use function libxml_clear_errors;
use function libxml_use_internal_errors;

/**
 * Registers the views of the module and replaces the two components of the webtrees core that the
 * views of the module render, so a view of the module can be rendered without a webtrees installation.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class ViewFixture
{
    /**
     * The name under which the module registers its views.
     */
    public const string MODULE_NAME = 'webtrees-fan-chart';

    /**
     * The namespace of the stand-ins for the components of the webtrees core.
     */
    private const string STUB_NAMESPACE = 'fan-test';

    /**
     * Registers the views of the module and redirects the core components that they use to stand-ins.
     * The stand-ins keep the parts that the tests look at: the name, the value and the checked state of
     * a checkbox.
     */
    public static function register(): void
    {
        View::registerNamespace(self::MODULE_NAME, __DIR__ . '/../../resources/views/');
        View::registerNamespace(self::STUB_NAMESPACE, __DIR__ . '/views/');

        View::registerCustomView('::components/checkbox', self::STUB_NAMESPACE . '::checkbox');
        View::registerCustomView('::components/select-individual', self::STUB_NAMESPACE . '::select-individual');
    }

    /**
     * Parses rendered markup into a document that can be queried.
     */
    public static function xpathOf(string $markup): DOMXPath
    {
        $previous = libxml_use_internal_errors(true);
        $document = new DOMDocument();
        $document->loadHTML('<?xml encoding="UTF-8">' . $markup);

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        return new DOMXPath($document);
    }

    /**
     * Returns the elements that the expression finds.
     *
     * @return list<DOMElement>
     */
    public static function elements(DOMXPath $xpath, string $expression): array
    {
        $elements = [];
        $nodes    = $xpath->query($expression);

        if ($nodes === false) {
            return $elements;
        }

        foreach ($nodes as $node) {
            if ($node instanceof DOMElement) {
                $elements[] = $node;
            }
        }

        return $elements;
    }

    /**
     * Returns the first element that the expression finds and fails the test when there is none.
     */
    public static function first(DOMXPath $xpath, string $expression): DOMElement
    {
        foreach (self::elements($xpath, $expression) as $element) {
            return $element;
        }

        throw new AssertionFailedError('The markup has no element for ' . $expression);
    }
}
