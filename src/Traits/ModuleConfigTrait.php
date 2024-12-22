<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Traits;

use Fisharebest\Webtrees\FlashMessages;
use Fisharebest\Webtrees\I18N;
use MagicSunday\Webtrees\FanChart\Configuration;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Trait ModuleConfigTrait.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
trait ModuleConfigTrait
{
    use \Fisharebest\Webtrees\Module\ModuleConfigTrait;

    /**
     * @param ServerRequestInterface $request
     *
     * @return ResponseInterface
     */
    public function getAdminAction(ServerRequestInterface $request): ResponseInterface
    {
        $this->layout = 'layouts/administration';

        return $this->viewResponse(
            $this->name() . '::modules/fan-chart/config',
            [
                'configuration' => new Configuration($request, $this),
                'moduleName'    => $this->name(),
                'title'         => $this->title(),
                'description'   => $this->description(),
            ]
        );
    }

    /**
     * @param ServerRequestInterface $request
     *
     * @return ResponseInterface
     */
    public function postAdminAction(ServerRequestInterface $request): ResponseInterface
    {
        $configuration = new Configuration($request, $this);

        $this->setPreference(
            'default_generations',
            (string) $configuration->getGenerations()
        );
        $this->setPreference(
            'default_fanDegree',
            (string) $configuration->getFanDegree()
        );
        $this->setPreference(
            'default_fontScale',
            (string) $configuration->getFontScale()
        );
        $this->setPreference(
            'default_hideEmptySegments',
            (string) $configuration->getHideEmptySegments()
        );
        $this->setPreference(
            'default_innerArcs',
            (string) $configuration->getInnerArcs()
        );
        $this->setPreference(
            'default_showColorGradients',
            (string) $configuration->getShowColorGradients()
        );
        $this->setPreference(
            'default_showParentMarriageDates',
            (string) $configuration->getShowParentMarriageDates()
        );
        $this->setPreference(
            'default_hideSvgExport',
            (string) $configuration->getHideSvgExport()
        );
        $this->setPreference(
            'default_hidePngExport',
            (string) $configuration->getHidePngExport()
        );

        FlashMessages::addMessage(
            I18N::translate(
                'The preferences for the module “%s” have been updated.',
                $this->title()
            ),
            'success'
        );

        return redirect($this->getConfigLink());
    }
}
