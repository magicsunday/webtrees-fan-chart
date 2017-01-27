<?php
/**
 * Webtrees module.
 *
 * PHP version 5
 *
 * @category   Webtrees
 * @package    Module
 * @subpackage AncestralFanChart
 * @author     Rico Sonntag <mail@ricosonntag.de>
 * @license    TBD
 * @link       https://github.com/magicsunday/ancestral-fan-chart/
 */

namespace RSO\WebtreesModule\AncestralFanChart;

use Composer\Autoload\ClassLoader;
use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Menu;
use Fisharebest\Webtrees\Module;
use Fisharebest\Webtrees\Module\AbstractModule;
use Fisharebest\Webtrees\Module\ModuleChartInterface;

use RSO\WebtreesModule\AncestralFanChart\Controller\Chart;

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
            'menu-chart-ancestral-fan-chart',
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
     * @param string $mod_action
     *
     * @return void
     */
    public function modAction($mod_action)
    {
        global $controller;
        global $WT_TREE;

        $urlPath = $this->getModuleUrlPath();

        $controller = new Controller\Chart();
        $controller
            ->restrictAccess(Module::isActiveChart($WT_TREE, 'ancestral-fan-chart'))
            ->pageHeader()
            ->addExternalJavascript($urlPath . '/js/packages/d3-3.5.17/d3.min.js')
            ->addExternalJavascript($urlPath . '/js/ancestral-fan-chart.js');

        echo '<link rel="stylesheet" type="text/css" href="'
            . $urlPath . '/css/ancestral-fan-chart.css">';

        echo $controller->render();
    }
}

return new AncestralFanChartModule(__DIR__);
