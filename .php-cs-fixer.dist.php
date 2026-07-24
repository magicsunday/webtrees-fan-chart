<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    die('This script supports command line usage only. Please check your command.');
}

$header = <<<EOF
This file is part of the package magicsunday/webtrees-fan-chart.

For the full copyright and license information, please read the
LICENSE file that was distributed with this source code.
EOF;

$factory = require __DIR__ . '/.build/vendor/magicsunday/coding-standard/php-cs-fixer/base.php';

return $factory($header)
    ->setCacheFile(__DIR__ . '/.build/cache/.php-cs-fixer.cache')
    ->setFinder(
        PhpCsFixer\Finder::create()
            ->exclude([
                '.build',
                'node_modules',
            ])
            ->in([
                __DIR__ . '/src/',
                __DIR__ . '/tests/',
                __DIR__ . '/resources/views/',
            ])
            ->name('*.php')
            ->name('*.phtml')
    );
