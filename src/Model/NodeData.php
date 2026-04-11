<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Model;

use Fisharebest\Webtrees\Individual;
use JsonSerializable;

/**
 * This class holds the data required to render and display the tree.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class NodeData implements JsonSerializable
{
    /**
     * The unique ID of the individual.
     */
    private int $id = 0;

    /**
     * The XREF of the individual.
     */
    private string $xref = '';

    /**
     * The URL to this individual in webtrees.
     */
    private string $url = '';

    /**
     * The URL used to update the clicked entry in the tree with this individual.
     */
    private string $updateUrl = '';

    /**
     * The generation the individual belongs to.
     */
    private int $generation = 0;

    /**
     * The full name of the individual.
     */
    private string $name = '';

    /**
     * TRUE if the name is written right to left.
     */
    private bool $isNameRtl = false;

    /**
     * The list of first names.
     *
     * @var string[]
     */
    private array $firstNames = [];

    /**
     * The list of last names.
     *
     * @var string[]
     */
    private array $lastNames = [];

    /**
     * The extracted preferred name.
     */
    private string $preferredName = '';

    /**
     * The alternative name.
     */
    private string $alternativeName = '';

    /**
     * TRUE if the alternative name is written right to left.
     */
    private bool $isAltRtl = false;

    /**
     * The URL of the individuals highlight image.
     */
    private string $thumbnail = '';

    /**
     * The sex of the individual.
     */
    private string $sex = 'U';

    /**
     * The formatted birthdate without HTML tags.
     */
    private string $birth = '';

    /**
     * The formatted death date without HTML tags.
     */
    private string $death = '';

    /**
     * The formatted marriage date without HTML tags.
     */
    private string $marriageDate = '';

    /**
     * The formatted marriage date of the parents without HTML tags.
     */
    private string $marriageDateOfParents = '';

    /**
     * The timespan label.
     */
    private string $timespan = '';

    /**
     * Full compact birth date for tooltip display.
     */
    private string $birthDateFull = '';

    /**
     * Full compact death date for tooltip display.
     */
    private string $deathDateFull = '';

    /**
     * Full compact marriage date for tooltip display.
     */
    private string $marriageDateFull = '';

    /**
     * The formatted birth place.
     */
    private string $birthPlace = '';

    /**
     * The formatted death place.
     */
    private string $deathPlace = '';

    /**
     * The formatted marriage place.
     */
    private string $marriagePlace = '';

    /**
     * The underlying individual instance. Only used internally.
     */
    private ?Individual $individual = null;

    /**
     * @return int
     */
    public function getId(): int
    {
        return $this->id;
    }

    /**
     * @param int $id
     *
     * @return NodeData
     */
    public function setId(int $id): NodeData
    {
        $this->id = $id;

        return $this;
    }

    /**
     * @param string $xref
     *
     * @return NodeData
     */
    public function setXref(string $xref): NodeData
    {
        $this->xref = $xref;

        return $this;
    }

    /**
     * @param string $url
     *
     * @return NodeData
     */
    public function setUrl(string $url): NodeData
    {
        $this->url = $url;

        return $this;
    }

    /**
     * @param string $updateUrl
     *
     * @return NodeData
     */
    public function setUpdateUrl(string $updateUrl): NodeData
    {
        $this->updateUrl = $updateUrl;

        return $this;
    }

    /**
     * @param int $generation
     *
     * @return NodeData
     */
    public function setGeneration(int $generation): NodeData
    {
        $this->generation = $generation;

        return $this;
    }

    /**
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }

    /**
     * @param string $name
     *
     * @return NodeData
     */
    public function setName(string $name): NodeData
    {
        $this->name = $name;

        return $this;
    }

    /**
     * @param bool $isNameRtl
     *
     * @return NodeData
     */
    public function setIsNameRtl(bool $isNameRtl): NodeData
    {
        $this->isNameRtl = $isNameRtl;

        return $this;
    }

    /**
     * @param string[] $firstNames
     *
     * @return NodeData
     */
    public function setFirstNames(array $firstNames): NodeData
    {
        $this->firstNames = $firstNames;

        return $this;
    }

    /**
     * @param string[] $lastNames
     *
     * @return NodeData
     */
    public function setLastNames(array $lastNames): NodeData
    {
        $this->lastNames = $lastNames;

        return $this;
    }

    /**
     * @param string $preferredName
     *
     * @return NodeData
     */
    public function setPreferredName(string $preferredName): NodeData
    {
        $this->preferredName = $preferredName;

        return $this;
    }

    /**
     * @param string $alternativeName
     *
     * @return NodeData
     */
    public function setAlternativeName(string $alternativeName): NodeData
    {
        $this->alternativeName = $alternativeName;

        return $this;
    }

    /**
     * @param bool $isAltRtl
     *
     * @return NodeData
     */
    public function setIsAltRtl(bool $isAltRtl): NodeData
    {
        $this->isAltRtl = $isAltRtl;

        return $this;
    }

    /**
     * @param string $thumbnail
     *
     * @return NodeData
     */
    public function setThumbnail(string $thumbnail): NodeData
    {
        $this->thumbnail = $thumbnail;

        return $this;
    }

    /**
     * @param string $sex
     *
     * @return NodeData
     */
    public function setSex(string $sex): NodeData
    {
        $this->sex = $sex;

        return $this;
    }

    /**
     * @param string $birth
     *
     * @return NodeData
     */
    public function setBirth(string $birth): NodeData
    {
        $this->birth = $birth;

        return $this;
    }

    /**
     * @param string $death
     *
     * @return NodeData
     */
    public function setDeath(string $death): NodeData
    {
        $this->death = $death;

        return $this;
    }

    /**
     * @param string $marriageDate
     *
     * @return NodeData
     */
    public function setMarriageDate(string $marriageDate): NodeData
    {
        $this->marriageDate = $marriageDate;

        return $this;
    }

    /**
     * @param string $marriageDateOfParents
     *
     * @return NodeData
     */
    public function setMarriageDateOfParents(string $marriageDateOfParents): NodeData
    {
        $this->marriageDateOfParents = $marriageDateOfParents;

        return $this;
    }

    /**
     * @param string $timespan
     *
     * @return NodeData
     */
    public function setTimespan(string $timespan): NodeData
    {
        $this->timespan = $timespan;

        return $this;
    }

    /**
     * @param string $birthDateFull
     *
     * @return NodeData
     */
    public function setBirthDateFull(string $birthDateFull): NodeData
    {
        $this->birthDateFull = $birthDateFull;

        return $this;
    }

    /**
     * @param string $deathDateFull
     *
     * @return NodeData
     */
    public function setDeathDateFull(string $deathDateFull): NodeData
    {
        $this->deathDateFull = $deathDateFull;

        return $this;
    }

    /**
     * @param string $marriageDateFull
     *
     * @return NodeData
     */
    public function setMarriageDateFull(string $marriageDateFull): NodeData
    {
        $this->marriageDateFull = $marriageDateFull;

        return $this;
    }

    /**
     * @param string $birthPlace
     *
     * @return NodeData
     */
    public function setBirthPlace(string $birthPlace): NodeData
    {
        $this->birthPlace = $birthPlace;

        return $this;
    }

    /**
     * @param string $deathPlace
     *
     * @return NodeData
     */
    public function setDeathPlace(string $deathPlace): NodeData
    {
        $this->deathPlace = $deathPlace;

        return $this;
    }

    /**
     * @param string $marriagePlace
     *
     * @return NodeData
     */
    public function setMarriagePlace(string $marriagePlace): NodeData
    {
        $this->marriagePlace = $marriagePlace;

        return $this;
    }

    /**
     * @return Individual|null
     */
    public function getIndividual(): ?Individual
    {
        return $this->individual;
    }

    /**
     * @param Individual|null $individual
     *
     * @return NodeData
     */
    public function setIndividual(?Individual $individual): NodeData
    {
        $this->individual = $individual;

        return $this;
    }

    /**
     * Returns the relevant data as an array.
     *
     * @return array<string, int|bool|string|string[]>
     */
    public function jsonSerialize(): array
    {
        return [
            'id'                    => $this->id,
            'xref'                  => $this->xref,
            'url'                   => $this->url,
            'updateUrl'             => $this->updateUrl,
            'generation'            => $this->generation,
            'name'                  => $this->name,
            'isNameRtl'             => $this->isNameRtl,
            'firstNames'            => $this->firstNames,
            'lastNames'             => $this->lastNames,
            'preferredName'         => $this->preferredName,
            'alternativeName'       => $this->alternativeName,
            'isAltRtl'              => $this->isAltRtl,
            'thumbnail'             => $this->thumbnail,
            'sex'                   => $this->sex,
            'birth'                 => $this->birth,
            'death'                 => $this->death,
            'marriageDate'          => $this->marriageDate,
            'marriageDateOfParents' => $this->marriageDateOfParents,
            'timespan'              => $this->timespan,
            'birthDateFull'         => $this->birthDateFull,
            'deathDateFull'         => $this->deathDateFull,
            'marriageDateFull'      => $this->marriageDateFull,
            'birthPlace'            => $this->birthPlace,
            'deathPlace'            => $this->deathPlace,
            'marriagePlace'         => $this->marriagePlace,
        ];
    }
}
