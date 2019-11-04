<?php
declare(strict_types=1);

/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees\FanChart\Traits;

use Fisharebest\Localization\Translation;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleCustomTrait;

/**
 * A utility trait.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
trait UtilityTrait
{
    use ModuleCustomTrait;

    /**
     * @inheritDoc
     */
    public function customModuleAuthorName(): string
    {
        return self::CUSTOM_AUTHOR;
    }

    /**
     * @inheritDoc
     */
    public function customModuleVersion(): string
    {
        return self::CUSTOM_VERSION;
    }

    /**
     * @inheritDoc
     */
    public function customModuleLatestVersionUrl(): string
    {
        return self::CUSTOM_WEBSITE;
    }

    /**
     * @inheritDoc
     */
    public function customModuleSupportUrl(): string
    {
        return self::CUSTOM_WEBSITE;
    }

    /**
     * Additional/updated translations.
     *
     * @param string $language
     *
     * @return string[]
     */
    public function customTranslations(string $language): array
    {
        $languageFile = $this->resourcesFolder() . 'lang/' . $language . '/messages.mo';
        return file_exists($languageFile) ? (new Translation($languageFile))->asArray() : [];
    }

    /**
     * Returns the unescaped HTML string.
     *
     * @param string $value The value to strip the HTML tags from
     *
     * @return null|string
     */
    public function unescapedHtml(string $value = null): ?string
    {
        return ($value === null)
            ? $value
            : html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Returns whether the given text is in RTL style or not.
     *
     * @param string $text The text to check
     *
     * @return bool
     */
    public function isRtl(string $text = null): bool
    {
        return $text ? I18N::scriptDirection(I18N::textScript($text)) === 'rtl' : false;
    }

    /**
     * Get the default colors based on the gender of an individual.
     *
     * @param null|Individual $individual Individual instance
     *
     * @return string HTML color code
     */
    public function getColor(Individual $individual = null): string
    {
        $genderLower = ($individual === null) ? 'u' : strtolower($individual->sex());
        return '#' . $this->theme->parameter('chart-background-' . $genderLower);
    }

    /**
     * Get the theme defined chart font color.
     *
     * @return string HTML color code
     */
    public function getChartFontColor(): string
    {
        return '#' . $this->theme->parameter('chart-font-color');
    }
}
