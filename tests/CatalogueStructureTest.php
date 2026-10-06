<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test;

use MagicSunday\Webtrees\ModuleBase\Testing\AbstractCatalogueStructureTestCase;
use PHPUnit\Framework\Attributes\CoversNothing;

/**
 * Locks the structure of the shipped translation catalogues. The checks live in the
 * shared abstract case of webtrees-module-base, this class only names the directory
 * that holds the catalogues of this module.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
#[CoversNothing]
final class CatalogueStructureTest extends AbstractCatalogueStructureTestCase
{
    /**
     * Returns the directory that holds the catalogues of all locales.
     *
     * @return string The path of the catalogue directory
     */
    protected static function languageDirectory(): string
    {
        return __DIR__ . '/../resources/lang';
    }

    /**
     * Declares that the catalogues of this module carry no plural entries.
     *
     * @return bool False, because the module has no plural string
     */
    protected static function shipsPluralEntries(): bool
    {
        return false;
    }
}
