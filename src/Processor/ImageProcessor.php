<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Processor;

use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;

/**
 * Class ImageProcessor.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-module-base/
 */
class ImageProcessor
{
    /**
     * The module.
     *
     * @var ModuleCustomInterface
     */
    private ModuleCustomInterface $module;

    /**
     * The individual.
     *
     * @var Individual
     */
    private Individual $individual;

    /**
     * Constructor.
     *
     * @param ModuleCustomInterface $module     The module
     * @param Individual            $individual The individual to process
     */
    public function __construct(ModuleCustomInterface $module, Individual $individual)
    {
        $this->module = $module;
        $this->individual = $individual;
    }

    /**
     * Returns the URL of a person's highlight image.
     *
     * @param int  $width             The request maximum width of the image
     * @param int  $height            The request maximum height of the image
     * @param bool $returnSilhouettes Set to TRUE to return silhouette images if this is
     *                                also enabled in the configuration
     *
     * @return string
     */
    public function getHighlightImageUrl(
        int $width = 250,
        int $height = 250,
        bool $returnSilhouettes = true
    ): string {
        if (
            $this->individual->canShow()
            && ($this->individual->tree()->getPreference('SHOW_HIGHLIGHT_IMAGES') !== '')
        ) {
            $mediaFile = $this->individual->findHighlightedMediaFile();

            if ($mediaFile !== null) {
                return $mediaFile->imageUrl($width, $height, 'contain');
            }

            if (
                $returnSilhouettes
                && ($this->individual->tree()->getPreference('USE_SILHOUETTE') !== '')
            ) {
                return $this->module->assetUrl(
                    sprintf(
                        'images/silhouette-%s.svg',
                        $this->individual->sex()
                    )
                );
            }
        }

        return '';
    }
}
