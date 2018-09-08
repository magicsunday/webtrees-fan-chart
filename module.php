<?php
/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees\AncestralFanChart;

// Register our namespace
$loader = new \Composer\Autoload\ClassLoader();
$loader->addPsr4(
    'MagicSunday\\Webtrees\\AncestralFanChart\\',
    __DIR__ . '/src'
);
$loader->register();

// Create and return instance of the module
return new Module(__DIR__);
