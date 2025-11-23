<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Tests\Processor;

use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\MediaFile;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Tree;
use MagicSunday\Webtrees\FanChart\Processor\ImageProcessor;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(ImageProcessor::class)]
final class ImageProcessorTest extends TestCase
{
    public function testReturnsHighlightImageWhenAvailable(): void
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

    public function testReturnsSilhouetteWhenEnabledAndNoMediaFound(): void
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

    public function testReturnsEmptyStringWhenImageNotAllowed(): void
    {
        $tree = $this->createConfiguredTree('', '');

        $individual = $this->createMock(Individual::class);
        $individual->method('canShow')->willReturn(false);
        $individual->method('tree')->willReturn($tree);

        $module    = $this->createModuleStub('');
        $processor = new ImageProcessor($module, $individual);

        self::assertSame('', $processor->getHighlightImageUrl());
    }

    private function createConfiguredTree(string $highlightPreference, string $silhouettePreference): Tree
    {
        $tree = $this->createMock(Tree::class);
        $tree->method('getPreference')->willReturnCallback(
            static function (string $name) use ($highlightPreference, $silhouettePreference): string {
                return $name === 'SHOW_HIGHLIGHT_IMAGES' ? $highlightPreference : $silhouettePreference;
            }
        );

        return $tree;
    }

    private function createModuleStub(string $assetUrl): ModuleCustomInterface
    {
        return new class($assetUrl) implements ModuleCustomInterface {
            public function __construct(private readonly string $asset)
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
