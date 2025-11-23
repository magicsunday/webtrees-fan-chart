<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Processor;

use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\MediaFile;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Tree;
use MagicSunday\Webtrees\FanChart\Processor\ImageProcessor;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

#[CoversClass(ImageProcessor::class)]
/**
 * Verifies highlight image resolution based on permissions and configuration.
 */
final class ImageProcessorTest extends TestCase
{
    /**
     * Ensures highlight images are returned when available and visible.
     */
    #[Test]
    public function returnsHighlightImageWhenAvailable(): void
    {
        $mediaFile = $this->createMock(MediaFile::class);
        $mediaFile->method('imageUrl')->with(100, 100, 'contain')->willReturn('/highlight.png');

        $tree = $this->createConfiguredTree('1', '1');

        $individual = $this->createMock(Individual::class);
        $individual->method('canShow')->willReturn(true);
        $individual->method('tree')->willReturn($tree);
        $individual->method('findHighlightedMediaFile')->willReturn($mediaFile);

        $module    = $this->createModuleStub('/highlight.png');
        $processor = new ImageProcessor($module, $individual);

        self::assertSame('/highlight.png', $processor->getHighlightImageUrl(100, 100));
    }

    /**
     * Ensures silhouettes are used when highlight images are enabled but missing.
     */
    #[Test]
    public function returnsSilhouetteWhenEnabledAndNoMediaFound(): void
    {
        $tree = $this->createConfiguredTree('1', '1');

        $individual = $this->createMock(Individual::class);
        $individual->method('canShow')->willReturn(true);
        $individual->method('tree')->willReturn($tree);
        $individual->method('findHighlightedMediaFile')->willReturn(null);
        $individual->method('sex')->willReturn('M');

        $module = $this->createModuleStub('/silhouette.svg');

        $processor = new ImageProcessor($module, $individual);

        self::assertSame('/silhouette.svg', $processor->getHighlightImageUrl(100, 100));
    }

    /**
     * Ensures the processor returns an empty string when images are not permitted.
     */
    #[Test]
    public function returnsEmptyStringWhenImageNotAllowed(): void
    {
        $tree = $this->createConfiguredTree('', '');

        $individual = $this->createMock(Individual::class);
        $individual->method('canShow')->willReturn(false);
        $individual->method('tree')->willReturn($tree);

        $module    = $this->createModuleStub('');
        $processor = new ImageProcessor($module, $individual);

        self::assertSame('', $processor->getHighlightImageUrl());
    }

    /**
     * Creates a tree mock with configured image preferences.
     */
    private function createConfiguredTree(string $highlightPreference, string $silhouettePreference): Tree
    {
        $tree = $this->createMock(Tree::class);
        $tree->method('getPreference')->willReturnCallback(
            static fn (string $name): string => $name === 'SHOW_HIGHLIGHT_IMAGES' ? $highlightPreference : $silhouettePreference
        );

        return $tree;
    }

    /**
     * Creates a lightweight module stub returning the provided asset URL.
     */
    private function createModuleStub(string $assetUrl): ModuleCustomInterface
    {
        return new readonly class($assetUrl) implements ModuleCustomInterface {
            public function __construct(private string $asset)
            {
            }

            public function assetUrl(string $asset): string
            {
                return $this->asset;
            }

            public function customModuleAuthorName(): string
            {
                return 'test';
            }

            public function customModuleVersion(): string
            {
                return '0.0.0';
            }

            public function customModuleLatestVersionUrl(): string
            {
                return '';
            }

            public function customModuleLatestVersion(): string
            {
                return '0.0.0';
            }

            public function customModuleSupportUrl(): string
            {
                return '';
            }

            public function customTranslations(string $language): array
            {
                return [];
            }

            public function boot(): void
            {
            }

            public function setName(string $name): void
            {
            }

            public function name(): string
            {
                return 'test';
            }

            public function setEnabled(bool $enabled): self
            {
                return $this;
            }

            public function isEnabled(): bool
            {
                return true;
            }

            public function isEnabledByDefault(): bool
            {
                return true;
            }

            public function title(): string
            {
                return 'test';
            }

            public function description(): string
            {
                return 'test';
            }

            public function accessLevel(Tree $tree, string $interface): int
            {
                return 0;
            }

            public function getPreference(string $setting_name, string $default = ''): string
            {
                return $default;
            }

            public function setPreference(string $setting_name, string $setting_value): void
            {
            }

            public function resourcesFolder(): string
            {
                return '/tmp';
            }
        };
    }
}
