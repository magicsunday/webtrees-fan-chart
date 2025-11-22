<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Module;

use Fig\Http\Message\StatusCodeInterface;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Registry;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * Class VersionInformation.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-module-base/
 */
class VersionInformation
{
    /**
     * The module.
     *
     * @var ModuleCustomInterface
     */
    private ModuleCustomInterface $module;

    /**
     * Constructor.
     *
     * @param ModuleCustomInterface $module The module
     */
    public function __construct(ModuleCustomInterface $module)
    {
        $this->module = $module;
    }

    /**
     * This method an extended version of ModuleCustomTrait::customModuleLatestVersion,
     * allowing to automatically use the latest GitHub release version.
     *
     * @return string The latest version number
     *
     * @see \Fisharebest\Webtrees\Module\ModuleCustomTrait::customModuleLatestVersion
     */
    public function fetchLatestVersion(): string
    {
        // No update URL provided
        if ($this->module->customModuleLatestVersionUrl() === '') {
            return $this->module->customModuleVersion();
        }

        return Registry::cache()->file()->remember(
            $this->module->name() . '-latest-version',
            function (): string {
                try {
                    $client = new Client([
                        'timeout' => 3,
                    ]);

                    $response = $client->get($this->module->customModuleLatestVersionUrl());

                    if ($response->getStatusCode() === StatusCodeInterface::STATUS_OK) {
                        $json = json_decode(
                            $response->getBody()->getContents(),
                            true,
                            512,
                            JSON_THROW_ON_ERROR
                        );

                        if (is_array($json)) {
                            /** @var string $version */
                            $version = $json['tag_name'] ?? '';

                            // Does the response look like a version?
                            if (preg_match('/^\d+\.\d+\.\d+/', $version) === 1) {
                                return $version;
                            }
                        }
                    }
                } catch (GuzzleException) {
                    // Can't connect to the server?
                }

                return $this->module->customModuleVersion();
            },
            86400
        );
    }
}
