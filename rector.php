<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

use Rector\Config\RectorConfig;

return static function (RectorConfig $rectorConfig): void {
    $rectorConfig->paths([
        __DIR__ . '/src/',
        __DIR__ . '/tests/',
        __DIR__ . '/resources/views/',
    ]);

    $rectorConfig->fileExtensions(['php', 'phtml']);
    $rectorConfig->phpstanConfig(__DIR__ . '/phpstan.neon');

    (require __DIR__ . '/.build/vendor/magicsunday/coding-standard/rector/base.php')($rectorConfig, 80300);
};
