<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Support;

use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Tree;

use function array_chunk;
use function is_string;

/**
 * Looks up which records of a tree have a pending change. Only an editor sees pending changes, so the
 * preload of records leaves such a record to the record factory, which decides what the editor sees.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class PendingRecords
{
    /**
     * Private constructor, the class only offers static methods.
     */
    private function __construct()
    {
    }

    /**
     * Returns the xrefs of the given records that have a pending change. Everybody who is no editor gets
     * an empty list without a statement.
     *
     * @param Tree         $tree      The tree of the records
     * @param list<string> $xrefs     The xrefs to look up
     * @param int<1, max>  $chunkSize The most xrefs that one statement binds
     *
     * @return list<string> The xrefs of the records with a pending change
     */
    public static function xrefs(Tree $tree, array $xrefs, int $chunkSize): array
    {
        // Nothing to look up means nothing to decide, so the viewer is not even asked.
        if (
            ($xrefs === [])
            || !Auth::isEditor($tree)
        ) {
            return [];
        }

        $pendingXrefs = [];

        foreach (array_chunk($xrefs, $chunkSize) as $chunk) {
            $found = DB::table('change')
                ->where('gedcom_id', '=', $tree->id())
                ->where('status', '=', 'pending')
                ->whereIn('xref', $chunk)
                ->pluck('xref');

            foreach ($found as $xref) {
                // Narrows the untyped query value to text for the static analysis, at no cost.
                if (is_string($xref)) {
                    $pendingXrefs[] = $xref;
                }
            }
        }

        return $pendingXrefs;
    }
}
