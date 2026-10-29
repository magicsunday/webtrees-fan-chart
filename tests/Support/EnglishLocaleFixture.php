<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Fisharebest\Localization\Locale;
use Fisharebest\Localization\Translator;
use Fisharebest\Webtrees\I18N;
use ReflectionProperty;

/**
 * Installs an English locale and translator, so translated texts are
 * deterministic.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class EnglishLocaleFixture
{
    /**
     * Installs the English locale and a translator that knows the given messages.
     *
     * @param array<string, string> $messages The translations by source text
     */
    public static function install(array $messages = []): void
    {
        $locale     = Locale::create('en');
        $translator = new Translator($messages, $locale->pluralRule());

        $localeProperty = new ReflectionProperty(I18N::class, 'locale');
        $localeProperty->setValue(null, $locale);

        $translatorProperty = new ReflectionProperty(I18N::class, 'translator');
        $translatorProperty->setValue(null, $translator);
    }
}
