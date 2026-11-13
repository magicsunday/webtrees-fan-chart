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
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\DB;
use Fisharebest\Webtrees\Factories\FamilyFactory;
use Fisharebest\Webtrees\Factories\MediaFactory;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\Gedcom;
use Fisharebest\Webtrees\GedcomRecord;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Media;
use Fisharebest\Webtrees\Registry;
use Fisharebest\Webtrees\Tree;

use function array_chunk;
use function array_unique;
use function array_values;
use function in_array;
use function is_string;
use function preg_match;
use function preg_match_all;

/**
 * Loads the media objects of a group of people with a few chunked statements, before the walk of the
 * chart asks for the highlight image of every person. Without it the walk reads one media object per
 * person, and for a visitor it also runs the privacy check of the media object per person, which reads
 * the links of the media object and every record it is linked to. The statements of a request then
 * grow with the number of people instead of the number of generations.
 *
 * The records go into the record cache of webtrees under the keys that its own record factories read,
 * so the later reads find them and nothing about what a viewer sees changes. A media object with a
 * pending change is left to the factory, which decides what an editor sees of it. For a visitor the
 * visibility of the media objects is decided in bulk by the rule of the core and stored under the key
 * of the visibility cache of the core. A media object that has a restriction notice of its own is left
 * to the core, and so is every viewer who is an editor or a manager.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class MediaPreloader
{
    /**
     * The most values that one preload statement binds. A generation of the ancestor tree doubles with
     * each step, so a lookup of a whole generation in one statement would reach the placeholder ceiling
     * of the database on a deep and complete pedigree.
     */
    public const int CHUNK_SIZE = 250;

    /**
     * The xrefs of the media objects that were already requested in this request, as keys. The keys are
     * only looked up, never read back, because a numeric xref as an array key turns into an integer.
     *
     * @var array<array-key, true>
     */
    private array $requested = [];

    /**
     * Loads the media objects of the given people that the walk reads for the highlight image.
     *
     * @param Tree             $tree   The tree of the people
     * @param list<Individual> $people The people of one generation
     */
    public function preload(Tree $tree, array $people): void
    {
        // The highlight image is not read at all without this setting.
        if ($tree->getPreference('SHOW_HIGHLIGHT_IMAGES') === '') {
            return;
        }

        $xrefs = $this->newMediaXrefs($people);

        if ($xrefs === []) {
            return;
        }

        $media = $this->loadMedia($tree, $xrefs);

        $this->decideVisibility($tree, $media);
    }

    /**
     * Returns the xrefs of the media objects of the people that are not requested yet. A person that the
     * viewer may not see shows no image, so its media objects are not needed.
     *
     * @param list<Individual> $people The people of one generation
     *
     * @return list<string>
     */
    private function newMediaXrefs(array $people): array
    {
        $xrefs = [];

        foreach ($people as $person) {
            if (!$person->canShow()) {
                continue;
            }

            preg_match_all('/\n1 OBJE @(' . Gedcom::REGEX_XREF . ')@/', $person->gedcom(), $match);

            foreach ($match[1] as $xref) {
                if (isset($this->requested[$xref])) {
                    continue;
                }

                $this->requested[$xref] = true;
                $xrefs[]                = $xref;
            }
        }

        return array_values(array_unique($xrefs));
    }

    /**
     * Loads the media objects into the record cache under the key that the media factory reads, and
     * returns them. A media object with a pending change is left out.
     *
     * @param Tree         $tree  The tree of the media objects
     * @param list<string> $xrefs The xrefs of the media objects
     *
     * @return list<Media> The media objects that were loaded
     */
    private function loadMedia(Tree $tree, array $xrefs): array
    {
        $pendingXrefs = PendingRecords::xrefs($tree, $xrefs, self::CHUNK_SIZE);
        $media        = [];

        foreach (array_chunk($xrefs, self::CHUNK_SIZE) as $chunk) {
            $rows = DB::table('media')
                ->where('m_file', '=', $tree->id())
                ->whereIn('m_id', $chunk)
                ->get();

            foreach ($rows as $row) {
                // These checks narrow the untyped query row to text for the static analysis and cost
                // nothing. A row that does not hold text is left to the record factory.
                if (
                    !is_string($row->m_id)
                    || !is_string($row->m_gedcom)
                    || in_array($row->m_id, $pendingXrefs, true)
                ) {
                    continue;
                }

                $media[] = Registry::cache()->array()->remember(
                    MediaFactory::class . $row->m_id . '@' . $tree->id(),
                    static fn (): Media => Registry::mediaFactory()->new($row->m_id, $row->m_gedcom, null, $tree),
                );
            }
        }

        return $media;
    }

    /**
     * Decides in bulk which of the media objects a visitor may see and stores the result under the key
     * of the visibility cache of the core. The core hides a media object that any record it is linked to
     * is hidden from the viewer. A viewer for whom the core does not run that check is left alone.
     *
     * @param Tree        $tree  The tree of the media objects
     * @param list<Media> $media The media objects that were loaded
     */
    private function decideVisibility(Tree $tree, array $media): void
    {
        $accessLevel = Auth::accessLevel($tree);

        if (
            ($accessLevel <= Auth::PRIV_NONE)
            || in_array($tree->getPreference('HIDE_LIVE_PEOPLE'), ['', '0'], true)
            || Auth::isEditor($tree)
        ) {
            return;
        }

        $accountXref       = $tree->getUserPreference(Auth::user(), UserInterface::PREF_TREE_ACCOUNT_XREF);
        $individualPrivacy = $tree->getIndividualPrivacy();

        // The core decides a media object with a restriction notice of its own, one with a rule of its
        // own and the record of the viewer before it looks at the links.
        $decidable = [];

        foreach ($media as $object) {
            if (
                (preg_match('/\n1 RESN (.+)/', $object->gedcom()) !== 1)
                && !isset($individualPrivacy[$object->xref()])
                && ($object->xref() !== $accountXref)
            ) {
                $decidable[] = $object;
            }
        }

        $links = $this->loadLinks($tree, $decidable);

        $this->loadLinkedRecords($tree, $links['linked']);

        $factPrivacy = $tree->getFactPrivacy();

        foreach ($decidable as $object) {
            $visible = !isset($factPrivacy[Media::RECORD_TYPE]) || ($factPrivacy[Media::RECORD_TYPE] >= $accessLevel);

            foreach ($links['byMedia'][$object->xref()] ?? [] as $linkedXref) {
                $record = Registry::gedcomRecordFactory()->make($linkedXref, $tree);

                if (($record instanceof GedcomRecord) && !$record->canShow($accessLevel)) {
                    $visible = false;

                    break;
                }
            }

            Registry::cache()->array()->remember(
                'show-' . $object->xref() . '-' . $tree->id() . '-' . $accessLevel,
                static fn (): bool => $visible,
            );
        }
    }

    /**
     * Reads which records every media object is linked to.
     *
     * @param Tree        $tree  The tree of the media objects
     * @param list<Media> $media The media objects
     *
     * @return array{byMedia: array<array-key, list<string>>, linked: list<string>} The linked xrefs by the
     *                                                                              xref of the media object,
     *                                                                              and all of them once
     */
    private function loadLinks(Tree $tree, array $media): array
    {
        $xrefs = [];

        foreach ($media as $object) {
            $xrefs[] = $object->xref();
        }

        $byMedia = [];
        $linked  = [];

        foreach (array_chunk($xrefs, self::CHUNK_SIZE) as $chunk) {
            $rows = DB::table('link')
                ->where('l_file', '=', $tree->id())
                ->whereIn('l_to', $chunk)
                ->get(['l_from', 'l_to']);

            foreach ($rows as $row) {
                if (
                    !is_string($row->l_from)
                    || !is_string($row->l_to)
                ) {
                    continue;
                }

                $byMedia[$row->l_to][] = $row->l_from;
                $linked[]              = $row->l_from;
            }
        }

        return [
            'byMedia' => $byMedia,
            'linked'  => array_values(array_unique($linked)),
        ];
    }

    /**
     * Loads the people and families that media objects are linked to into the record cache, so that the
     * generic record factory finds them there. Without that it asks for a family first and sends a
     * statement for every person. An xref that is a person and no family is stored as no family.
     *
     * @param Tree         $tree  The tree of the records
     * @param list<string> $xrefs The xrefs of the linked records
     */
    private function loadLinkedRecords(Tree $tree, array $xrefs): void
    {
        $families = [];
        $people   = [];

        foreach (array_chunk($xrefs, self::CHUNK_SIZE) as $chunk) {
            $rows = DB::table('families')
                ->where('f_file', '=', $tree->id())
                ->whereIn('f_id', $chunk)
                ->get();

            foreach ($rows as $row) {
                if (
                    !is_string($row->f_id)
                    || !is_string($row->f_gedcom)
                ) {
                    continue;
                }

                $families[$row->f_id] = true;

                Registry::cache()->array()->remember(
                    FamilyFactory::class . $row->f_id . '@' . $tree->id(),
                    static fn (): Family => Registry::familyFactory()->new($row->f_id, $row->f_gedcom, null, $tree),
                );
            }

            $individuals = DB::table('individuals')
                ->where('i_file', '=', $tree->id())
                ->whereIn('i_id', $chunk)
                ->get()
                ->map(Registry::individualFactory()->mapper($tree));

            foreach ($individuals as $individual) {
                $people[] = $individual->xref();
            }
        }

        foreach ($people as $xref) {
            if (isset($families[$xref])) {
                continue;
            }

            Registry::cache()->array()->remember(
                FamilyFactory::class . $xref . '@' . $tree->id(),
                static fn (): ?Family => null,
            );
        }
    }
}
