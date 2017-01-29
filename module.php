<?php
/**
 * Webtrees module.
 *
 * Copyright (C) 2017  Rico Sonntag
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301  USA
 *
 * @category   Webtrees
 * @package    Module
 * @subpackage AncestralFanChart
 * @author     Rico Sonntag <mail@ricosonntag.de>
 * @link       https://github.com/magicsunday/ancestral-fan-chart/
 * @license    http://opensource.org/licenses/gpl-license.php GNU Public License
 */

namespace RSO\WebtreesModule\AncestralFanChart;

use RSO\WebtreesModule\AncestralFanChart\Controller\Chart;
use Composer\Autoload\ClassLoader;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Menu;
use Fisharebest\Webtrees\Module;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Module\ModuleChartInterface;

/**
 * Ancestral fan chart module class.
 *
 * @category   Webtrees
 * @package    Module
 * @subpackage AncestralFanChart
 * @author     Rico Sonntag <mail@ricosonntag.de>
 * @license    TBD
 * @link       https://github.com/magicsunday/ancestral-fan-chart/
 */
class AncestralFanChartModule extends AbstractModule implements ModuleChartInterface
{
    /**
     * Create a new module.
     *
     * @param string $directory Where is this module installed
     */
    public function __construct($directory)
    {
        parent::__construct($directory);

        // Register the namespace
        $loader = new ClassLoader();
        $loader->addPsr4(
            'RSO\\WebtreesModule\\AncestralFanChart\\',
            WT_MODULES_DIR . $this->getName() . '/src'
        );
        $loader->register();
    }

    /**
     * How should this module be labelled on tabs, menus, etc.?
     *
     * @return string
     */
    public function getTitle()
    {
        return I18N::translate('Ancestral fan chart');
    }

    /**
     * A sentence describing what this module does.
     *
     * @return string
     */
    public function getDescription()
    {
        return I18N::translate('A fan chart of an individual’s ancestors.');
    }

    /**
     * What is the default access level for this module?
     *
     * Some modules are aimed at admins or managers, and are not generally shown to users.
     *
     * @return int
     */
    public function defaultAccessLevel()
    {
        return Auth::PRIV_PRIVATE;
    }

    /**
     * Return a menu item for this chart.
     *
     * @param Individual $individual Current individual instance
     *
     * @return Menu
     */
    public function getChartMenu(Individual $individual)
    {
        $link = 'module.php?mod=' . $this->getName()
            . '&amp;rootid=' . $individual->getXref()
            . '&amp;ged=' . $individual->getTree()->getNameUrl();

        return new Menu(
            $this->getTitle(),
            $link,
            'menu-chart-fanchart',
            array(
                'rel' => 'nofollow',
            )
        );
    }

    /**
     * Return a menu item for this chart - for use in individual boxes.
     *
     * @param Individual $individual Current individual instance
     *
     * @return Menu
     */
    public function getBoxChartMenu(Individual $individual)
    {
        return $this->getChartMenu($individual);
    }

    /**
     * Get the modules static url path.
     *
     * @return string
     */
    protected function getModuleUrlPath()
    {
        return WT_STATIC_URL . WT_MODULES_DIR . $this->getName();
    }

    /**
     * This is a general purpose hook, allowing modules to respond to routes
     * of the form module.php?mod=FOO&mod_action=BAR
     *
     * @param string $modAction Module action
     *
     * @return void
     */
    public function modAction($modAction)
    {
        global $controller;
        global $WT_TREE;

        $urlPath = $this->getModuleUrlPath();

        $controller = new Controller\Chart();
        $controller
            ->restrictAccess(Module::isActiveChart($WT_TREE, 'ancestral-fan-chart'))
            ->pageHeader()
            ->addExternalJavascript(WT_AUTOCOMPLETE_JS_URL)
            ->addExternalJavascript($urlPath . '/js/packages/d3-3.5.17/d3.min.js')
            ->addExternalJavascript($urlPath . '/js/ancestral-fan-chart.js');

        echo '<link rel="stylesheet" type="text/css" href="'
            . $urlPath . '/css/ancestral-fan-chart.css">';

        echo $controller->render();
    }
}

return new AncestralFanChartModule(__DIR__);
