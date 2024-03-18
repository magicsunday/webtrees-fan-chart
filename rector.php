<?php

/**
 * This file is part of the package magicsunday/jsonmapper.
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
use Rector\Php80\Rector\FunctionLike\MixedTypeRector;
use Rector\Php81\Rector\Property\ReadOnlyPropertyRector;
use Rector\Set\ValueObject\LevelSetList;
use Rector\Set\ValueObject\SetList;
use Rector\TypeDeclaration\Rector\ClassMethod\ParamTypeByMethodCallTypeRector;

return static function (RectorConfig $rectorConfig): void {
    $rectorConfig->paths([
        __DIR__ . '/src',
    ]);

    $rectorConfig->skip([
        __DIR__ . '/.build',
        __DIR__ . '/test',
    ]);

    $rectorConfig->phpstanConfig('phpstan.neon');
    $rectorConfig->importNames();
    $rectorConfig->removeUnusedImports();
    $rectorConfig->disableParallel();

    // Define what rule sets will be applied
    $rectorConfig->sets([
        SetList::EARLY_RETURN,
        SetList::TYPE_DECLARATION,
        SetList::CODING_STYLE,
        SetList::CODE_QUALITY,
        SetList::DEAD_CODE,
        LevelSetList::UP_TO_PHP_74,
    ]);

    // Skip some rules
    $rectorConfig->skip([
        CatchExceptionNameMatchingTypeRector::class,
        ClassPropertyAssignToConstructorPromotionRector::class,
        LocallyCalledStaticMethodToNonStaticRector::class,
        MixedTypeRector::class,
        ParamTypeByMethodCallTypeRector::class,
        ReadOnlyPropertyRector::class,
        RemoveUselessParamTagRector::class,
        RemoveUselessReturnTagRector::class,
        RemoveUselessVarTagRector::class,
    ]);
};
