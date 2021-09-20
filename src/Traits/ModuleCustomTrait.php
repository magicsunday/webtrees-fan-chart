<?php

/**
 * See LICENSE.md file for further details.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Traits;

use Fig\Http\Message\StatusCodeInterface;
use Fisharebest\Localization\Translation;
use Fisharebest\Webtrees\Registry;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

/**
 * Trait ModuleCustomTrait.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
trait ModuleCustomTrait
{
    use \Fisharebest\Webtrees\Module\ModuleCustomTrait;

    public function customModuleAuthorName(): string
    {
        return self::CUSTOM_AUTHOR;
    }

    public function customModuleVersion(): string
    {
        return self::CUSTOM_VERSION;
    }

    public function customModuleLatestVersionUrl(): string
    {
        return self::CUSTOM_LATEST_VERSION;
    }

//    protected function extractVersion(string $content): string
//    {
//        return json_decode($content, true)['tag_name'] ?? '';
//    }

    /**
     * Fetch the latest version of this module.
     *
     * @return string
     */
    public function customModuleLatestVersion(): string
    {
        // No update URL provided.
        if ($this->customModuleLatestVersionUrl() === '') {
            return $this->customModuleVersion();
        }

        return Registry::cache()->file()->remember($this->name() . '-latest-version', function () {
            try {
                $client = new Client([
                    'timeout' => 3,
                ]);

                $response = $client->get($this->customModuleLatestVersionUrl());

                if ($response->getStatusCode() === StatusCodeInterface::STATUS_OK) {
                    $json    = json_decode($response->getBody()->getContents(), true, 512, JSON_THROW_ON_ERROR);
                    $version = $json['tag_name'];

                    // Does the response look like a version?
                    if (preg_match('/^\d+\.\d+\.\d+/', $json['tag_name'])) {
                        return $version;
                    }
                }
            } catch (RequestException $ex) {
                // Can't connect to the server?
            }

            return $this->customModuleVersion();
        }, 86400);
    }

    public function customModuleSupportUrl(): string
    {
        return self::CUSTOM_SUPPORT_URL;
    }

    public function customTranslations(string $language): array
    {
        $languageFile = $this->resourcesFolder() . 'lang/' . $language . '/messages.mo';

        return file_exists($languageFile) ? (new Translation($languageFile))->asArray() : [];
    }
}
