<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

use Rector\CodeQuality\Rector\ClassMethod\LocallyCalledStaticMethodToNonStaticRector;
use Rector\CodingStyle\Rector\Catch_\CatchExceptionNameMatchingTypeRector;
use Rector\Config\RectorConfig;
use Rector\DeadCode\Rector\ClassMethod\RemoveUselessParamTagRector;
use Rector\DeadCode\Rector\ClassMethod\RemoveUselessReturnTagRector;
use Rector\DeadCode\Rector\Property\RemoveUselessVarTagRector;
use Rector\Php80\Rector\Class_\ClassPropertyAssignToConstructorPromotionRector;
use Rector\Php81\Rector\Property\ReadOnlyPropertyRector;
use Rector\Set\ValueObject\LevelSetList;
use Rector\Set\ValueObject\SetList;
use Rector\TypeDeclaration\Rector\ClassMethod\ParamTypeByMethodCallTypeRector;

return static function (RectorConfig $rectorConfig): void {
    $rectorConfig->paths([
        __DIR__ . '/src/',
        // Exclude tests-directory as this may change test cases too
        // __DIR__ . '/tests/',
    ]);

    if (
        !is_dir($concurrentDirectory = __DIR__ . '/.build/cache/.rector.cache')
        && !mkdir($concurrentDirectory, 0775, true)
        && !is_dir($concurrentDirectory)
    ) {
        throw new \RuntimeException(
            sprintf(
                'Directory "%s" was not created',
                $concurrentDirectory
            )
        );
    }

    if (
        !is_dir($concurrentDirectory = __DIR__ . '/.build/cache/.rector.container.cache')
        && !mkdir($concurrentDirectory, 0775, true)
        && !is_dir($concurrentDirectory)
    ) {
        throw new \RuntimeException(
            sprintf(
                'Directory "%s" was not created',
                $concurrentDirectory
            )
        );
    }

    $rectorConfig->phpstanConfig(__DIR__ . '/phpstan.neon');
    $rectorConfig->importNames();
    $rectorConfig->removeUnusedImports();
    $rectorConfig->disableParallel();
    $rectorConfig->cacheDirectory(__DIR__ . '/.build/cache/.rector.cache');
    $rectorConfig->containerCacheDirectory(__DIR__ . '/.build/cache/.rector.container.cache');

    // Define what rule sets will be applied
    $rectorConfig->sets([
        SetList::CODE_QUALITY,
        SetList::CODING_STYLE,
        SetList::DEAD_CODE,
        SetList::EARLY_RETURN,
        SetList::INSTANCEOF,
        SetList::PRIVATIZATION,
        SetList::STRICT_BOOLEANS,
        SetList::TYPE_DECLARATION,
        LevelSetList::UP_TO_PHP_83,
    ]);

    // Skip some rules
    $rectorConfig->skip([
        CatchExceptionNameMatchingTypeRector::class,
        ClassPropertyAssignToConstructorPromotionRector::class,
        LocallyCalledStaticMethodToNonStaticRector::class,
        ParamTypeByMethodCallTypeRector::class,
        ReadOnlyPropertyRector::class,
        RemoveUselessParamTagRector::class,
        RemoveUselessReturnTagRector::class,
        RemoveUselessVarTagRector::class,
    ]);
};
