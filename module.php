<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees;

use Composer\Autoload\ClassLoader;
use MagicSunday\Webtrees\FanChart\Module;

// Register our required namespaces
$loader = new ClassLoader();
$loader->addPsr4('MagicSunday\\Webtrees\\ModuleBase\\', __DIR__ . '/vendor/magicsunday/webtrees-module-base/src');
$loader->addPsr4('MagicSunday\\Webtrees\\FanChart\\', __DIR__ . '/src');
$loader->register();

// Create and return instance of the module
return app(Module::class);
