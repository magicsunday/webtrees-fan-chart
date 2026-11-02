<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use ArrayObject;
use Fisharebest\Webtrees\Date;
use Fisharebest\Webtrees\Fact;
use Fisharebest\Webtrees\Family;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Place;
use Fisharebest\Webtrees\Tree;
use Illuminate\Support\Collection;
use PHPUnit\Framework\MockObject\Stub;

use function is_string;

/**
 * Provides stand-ins for the people that the tests of the chart data and of the request path build.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
trait IndividualFixtureTrait
{
    /**
     * Builds a fake name set matching webtrees output structure.
     *
     * @return list<array<string, string|bool|array<string>>>
     */
    private function buildNameSet(string $firstName, string $lastName): array
    {
        return [
            [
                'type'                    => 'NAME',
                'fullNN'                  => $firstName . ' <span class="NAME"><span class="SURN">' . $lastName . '</span></span>',
                'full'                    => $firstName . ' <span class="NAME"><span class="SURN">' . $lastName . '</span></span>',
                'sort'                    => $lastName . ', ' . $firstName,
                'list'                    => $firstName . ' ' . $lastName,
                'surname'                 => $lastName,
                'addname'                 => '',
                'prefix'                  => '',
                'surn'                    => $lastName,
                'givn'                    => $firstName,
                'initials'                => $firstName[0] . ' ' . $lastName[0],
                'spfx'                    => '',
                'nsfx'                    => '',
                'nickname'                => '',
                'display_as'              => 'default',
                'type_label'              => 'Name',
                'surname_prefix'          => '',
                'show'                    => true,
                'script'                  => 'Latn',
                'parts'                   => [],
                'prim'                    => 'Y',
                'type_id'                 => '0',
                'fullNNalternativeRender' => $firstName . ' <span class="SURN">' . $lastName . '</span>',
            ],
        ];
    }

    /**
     * Creates an individual stub with a visible name, the given dates and no
     * parents. The optional family is the individual's only spouse family.
     *
     * @param array<string, Fact>|null      $factsByTag The fact of each tag, or null for a person without a facts stub
     * @param ArrayObject<int, string>|null $factReads  Receives the tag of every read of the facts of the person
     * @param bool                          $isDead     Whether the person is marked as dead
     * @param bool                          $visible    Whether the viewer may see the person
     *
     * @return Individual&Stub
     */
    private function createPerson(
        Tree $tree,
        string $xref,
        string $sex,
        string $birth,
        string $death,
        ?Family $spouseFamily = null,
        string $birthPlace = '',
        string $deathPlace = '',
        ?Family $parentFamily = null,
        ?array $factsByTag = null,
        ?ArrayObject $factReads = null,
        bool $isDead = false,
        bool $visible = true,
    ): Individual {
        $person = self::createStub(Individual::class);
        $person->method('xref')->willReturn($xref);
        $person->method('url')->willReturn('/individual/' . $xref);
        $person->method('sex')->willReturn($sex);
        $person->method('fullName')->willReturn('Person ' . $xref);
        $person->method('canShow')->willReturn($visible);
        $person->method('canShowName')->willReturn($visible);
        $person->method('getAllNames')->willReturn($this->buildNameSet('Person', $xref));
        $person->method('getPrimaryName')->willReturn(0);
        $person->method('getSecondaryName')->willReturn(0);
        $person->method('getBirthDate')->willReturn($this->createDate($birth));
        $person->method('getDeathDate')->willReturn($this->createDate($death));
        $person->method('isDead')->willReturn($isDead);
        $person->method('tree')->willReturn($tree);

        if ($birthPlace !== '') {
            $person->method('getBirthPlace')->willReturn(new Place($birthPlace, $tree));
        }

        if ($deathPlace !== '') {
            $person->method('getDeathPlace')->willReturn(new Place($deathPlace, $tree));
        }

        $person->method('spouseFamilies')->willReturn(
            ($spouseFamily instanceof Family) ? new Collection([$spouseFamily]) : new Collection()
        );
        $person->method('childFamilies')->willReturn(
            ($parentFamily instanceof Family) ? new Collection([$parentFamily]) : new Collection()
        );
        $person->method('findHighlightedMediaFile')->willReturn(null);

        if ($factsByTag !== null) {
            $person->method('facts')->willReturnCallback(
                static function (array $filter = []) use ($factsByTag, $factReads): Collection {
                    $first = $filter[0] ?? '';
                    $tag   = is_string($first) ? $first : '';

                    $factReads?->append($tag);

                    return new Collection(isset($factsByTag[$tag]) ? [$factsByTag[$tag]] : []);
                }
            );
        }

        return $person;
    }

    /**
     * Creates a date instance with predefined values for testing.
     */
    private function createDate(string $display): Date
    {
        return new Date($display);
    }
}
