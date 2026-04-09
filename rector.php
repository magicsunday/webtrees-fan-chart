<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

use Rector\CodingStyle\Rector\Catch_\CatchExceptionNameMatchingTypeRector;
use Rector\Config\RectorConfig;
use Rector\DeadCode\Rector\ClassMethod\RemoveUselessParamTagRector;
use Rector\DeadCode\Rector\ClassMethod\RemoveUselessReturnTagRector;
use Rector\DeadCode\Rector\Stmt\RemoveUnreachableStatementRector;
use Rector\Set\ValueObject\LevelSetList;
use Rector\Set\ValueObject\SetList;

return static function (RectorConfig $rectorConfig): void {
    $rectorConfig->paths([
        __DIR__ . '/src/',
        __DIR__ . '/tests/',
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
    $rectorConfig->phpVersion(80300);

    // Define what rule sets will be applied
    $rectorConfig->sets([
        SetList::CODE_QUALITY,
        SetList::CODING_STYLE,
        SetList::DEAD_CODE,
        SetList::EARLY_RETURN,
        SetList::INSTANCEOF,
        SetList::PRIVATIZATION,
        SetList::TYPE_DECLARATION,
        SetList::TYPE_DECLARATION_DOCBLOCKS,
        LevelSetList::UP_TO_PHP_83,
    ]);

    // Skip some rules
    $rectorConfig->skip([
        CatchExceptionNameMatchingTypeRector::class,
        RemoveUnreachableStatementRector::class,
        RemoveUselessParamTagRector::class,
        RemoveUselessReturnTagRector::class,
        \Rector\Php80\Rector\Class_\ClassPropertyAssignToConstructorPromotionRector::class,
        \Rector\Privatization\Rector\Property\PrivatizeFinalClassPropertyRector::class,
        \Rector\Php81\Rector\Property\ReadOnlyPropertyRector::class,
    ]);
};
