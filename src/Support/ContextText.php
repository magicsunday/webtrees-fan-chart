<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Support;

use Fisharebest\Webtrees\I18N;

/**
 * Chooses the wording of a text that the module words differently from the webtrees core.
 *
 * The module catalogue replaces a core text in the whole installation, so a text whose wording
 * differs from the core wording carries the name of the module as its context. A language that
 * has no entry for that context keeps the wording of the core instead of the English source text.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class ContextText
{
    /**
     * Private constructor, the class only offers static methods.
     */
    private function __construct()
    {
    }

    /**
     * Returns the translation of the context when the catalogue has one, otherwise the translation
     * of the core for the same source text.
     *
     * The caller passes the result of `I18N::translateContext()` with the source text as a literal,
     * so that the extraction of the catalogue finds the text.
     *
     * @param string $contextual The result of `I18N::translateContext()` for the source text
     * @param string $source     The English source text
     */
    public static function resolve(string $contextual, string $source): string
    {
        if ($contextual !== $source) {
            return $contextual;
        }

        return I18N::translate($source);
    }
}
