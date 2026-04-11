<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Processor;

use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\MediaFile;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;

use function is_string;
use function sprintf;

/**
 * Resolves the highlight image URL for an individual, falling back to a sex-specific
 * silhouette asset when no media file is available and silhouettes are enabled.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-module-base/
 */
class ImageProcessor
{
    /**
     * @param ModuleCustomInterface $module
     * @param Individual            $individual
     */
    public function __construct(
        private readonly ModuleCustomInterface $module,
        private readonly Individual $individual,
    ) {
    }

    /**
     * Returns the URL of the individual's highlight (thumbnail) image for use in chart arcs.
     * Falls back to a sex-specific silhouette SVG when no media file exists and both
     * $returnSilhouettes and the tree's USE_SILHOUETTE preference are true.
     * Returns empty string when the individual is not viewable or no image can be resolved.
     *
     * @param int  $width             Maximum pixel width of the requested image
     * @param int  $height            Maximum pixel height of the requested image
     * @param bool $returnSilhouettes Allow silhouette fallback when true
     *
     * @return string
     */
    public function getHighlightImageUrl(
        int $width = 250,
        int $height = 250,
        bool $returnSilhouettes = true,
    ): string {
        if (
            $this->individual->canShow()
            && ($this->individual->tree()->getPreference('SHOW_HIGHLIGHT_IMAGES') !== '')
        ) {
            $mediaFile = $this->individual->findHighlightedMediaFile();

            if ($mediaFile instanceof MediaFile && ($mediaFile->isExternal() || $mediaFile->fileExists())) {
                return $mediaFile->imageUrl($width, $height, 'contain');
            }

            if (
                $returnSilhouettes
                && ($this->individual->tree()->getPreference('USE_SILHOUETTE') !== '')
            ) {
                // assetUrl() lives on AbstractModule, not on ModuleCustomInterface.
                // Guard needed because the module type is ModuleCustomInterface.
                if (method_exists($this->module, 'assetUrl') === false) {
                    return '';
                }

                $silhouette = $this->module->assetUrl(
                    sprintf(
                        'images/silhouette-%s.svg',
                        $this->individual->sex()
                    )
                );

                return is_string($silhouette) ? $silhouette : '';
            }
        }

        return '';
    }
}
