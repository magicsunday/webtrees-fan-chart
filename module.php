<?php
/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees;

// Register our namespace
$loader = new \Composer\Autoload\ClassLoader();
$loader->addPsr4(
    'MagicSunday\\Webtrees\\',
    __DIR__ . '/src'
);
$loader->register();

// Create and return instance of the module
return new AncestralFanChartModule(__DIR__);
