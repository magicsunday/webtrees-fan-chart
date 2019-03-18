<?php
declare(strict_types=1);

/**
 * See LICENSE.md file for further details.
 */
namespace MagicSunday\Webtrees\FanChart;

use Fisharebest\Webtrees\Auth;
use Fisharebest\Webtrees\Contracts\UserInterface;
use Fisharebest\Webtrees\Exceptions\IndividualAccessDeniedException;
use Fisharebest\Webtrees\Exceptions\IndividualNotFoundException;
use Fisharebest\Webtrees\I18N;
use Fisharebest\Webtrees\Individual;
use Fisharebest\Webtrees\Module\FanChartModule as WebtreesFanChartModule;
use Fisharebest\Webtrees\Module\ModuleCustomInterface;
use Fisharebest\Webtrees\Services\ChartService;
use Fisharebest\Webtrees\Tree;
use MagicSunday\Webtrees\FanChart\Traits\UtilityTrait;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fan chart module class.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
class Module extends WebtreesFanChartModule implements ModuleCustomInterface
{
    use UtilityTrait;

    /**
     * @var string
     */
    public const CUSTOM_AUTHOR = 'Rico Sonntag';

    /**
     * @var string
     */
    public const CUSTOM_VERSION = '2.0';

    /**
     * @var string
     */
    public const CUSTOM_WEBSITE = 'https://github.com/magicsunday/webtrees-fan-chart';

    /**
     * Constructor.
     *
     * @param string $moduleDirectory The module base directory
     */
    public function __construct(string $moduleDirectory)
    {
        $this->moduleDirectory = $moduleDirectory;
    }

    /**
     * @inheritDoc
     *
     * @throws IndividualNotFoundException
     * @throws IndividualAccessDeniedException
     */
    public function getChartAction(
        Request $request,
        Tree $tree,
        UserInterface $user,
        ChartService $chart_service
    ): Response {
        $xref       = $request->get('xref');
        $individual = Individual::getInstance($xref, $tree);

        if ($individual === null) {
            throw new IndividualNotFoundException();
        }

        Auth::checkIndividualAccess($individual);
        Auth::checkComponentAccess($this, 'chart', $tree, $user);

        return $this->viewResponse(
            $this->name() . '::chart',
            [
                'title'       => $this->getPageTitle($individual),
                'moduleName'  => $this->name(),
                'individual'  => $individual,
                'tree'        => $tree,
                'config'      => $this->config,
                'chartParams' => json_encode($this->getChartParameters($individual)),
            ]
        );
    }

    /**
     * Returns the page title.
     *
     * @param Individual $individual The individual used in the curret chart
     *
     * @return string
     */
    private function getPageTitle(Individual $individual): string
    {
        $title = I18N::translate('Fan chart');

        if ($individual && $individual->canShowName()) {
            $title = I18N::translate('Fan chart of %s', $individual->fullName());
        }

        return $title;
    }

    /**
     * Collects and returns the required chart data.
     *
     * @param Individual $individual The individual used to gather the chart data
     *
     * @return string[]
     */
    private function getChartParameters(Individual $individual): array
    {
        return [
            'rtl'                => I18N::direction() === 'rtl',
            'defaultColor'       => $this->getColor(),
            'fontColor'          => $this->getChartFontColor(),
            'fanDegree'          => $this->config->getFanDegree(),
            'generations'        => $this->config->getGenerations(),
            'fontScale'          => $this->config->getFontScale(),
            'hideEmptySegments'  => $this->config->getHideEmptySegments(),
            'showColorGradients' => $this->config->getShowColorGradients(),
            'innerArcs'          => $this->config->getInnerArcs(),
            'updateUrl'          => $this->getUpdateRoute($individual->tree()),
            'individualUrl'      => $this->getIndividualRoute(),
            'data'               => $this->buildJsonTree($individual),
            'labels'             => [
                'zoom' => I18N::translate('Use Ctrl + scroll to zoom in the view'),
                'move' => I18N::translate('Move the view with two fingers'),
            ],
        ];
    }

    /**
     * Update action.
     *
     * @param Request       $request The current HTTP request
     * @param Tree          $tree    The current tree
     * @param UserInterface $user    The current user
     *
     * @return JsonResponse
     *
     * @throws IndividualNotFoundException
     * @throws IndividualAccessDeniedException
     */
    public function getUpdateAction(Request $request, Tree $tree, UserInterface $user): Response
    {
        $xref       = $request->get('xref');
        $individual = Individual::getInstance($xref, $tree);

        Auth::checkIndividualAccess($individual);
        Auth::checkComponentAccess($this, 'chart', $tree, $user);

        return new JsonResponse(
            $this->buildJsonTree($individual)
        );
    }

    /**
     * Get the individual data required for display the chart.
     *
     * @param Individual $individual The start person
     * @param int        $generation The generation the person belongs to
     *
     * @return array
     */
    private function getIndividualData(Individual $individual, int $generation): array
    {
        $fullName        = $this->unescapedHtml($individual->fullName());
        $alternativeName = $this->unescapedHtml($individual->alternateName());

        return [
            'id'              => 0,
            'xref'            => $individual->xref(),
            'generation'      => $generation,
            'name'            => $fullName,
            'alternativeName' => $alternativeName,
            'isAltRtl'        => $this->isRtl($alternativeName),
            'sex'             => $individual->sex(),
            'born'            => $individual->getBirthYear(),
            'died'            => $individual->getDeathYear(),
            'color'           => $this->getColor($individual),
            'colors'          => [[], []],
        ];
    }

    /**
     * Recursively build the data array of the individual ancestors.
     *
     * @param null|Individual $individual The start person
     * @param int             $generation The current generation
     *
     * @return array
     */
    private function buildJsonTree(Individual $individual = null, int $generation = 1): array
    {
        // Maximum generation reached
        if (($individual === null) || ($generation > $this->config->getGenerations())) {
            return [];
        }

        $data   = $this->getIndividualData($individual, $generation);
        $family = $individual->primaryChildFamily();

        if ($family === null) {
            return $data;
        }

        // Recursively call the method for the parents of the individual
        $fatherTree = $this->buildJsonTree($family->husband(), $generation + 1);
        $motherTree = $this->buildJsonTree($family->wife(), $generation + 1);

        // Add array of child nodes
        if (!empty($fatherTree)) {
            $data['children'][] = $fatherTree;
        }

        if (!empty($motherTree)) {
            $data['children'][] = $motherTree;
        }

        return $data;
    }

    /**
     * Get the raw update URL. The "xref" parameter must be the last one as the URL gets appended
     * with the clicked individual id in order to load the required chart data.
     *
     * @param Tree $tree The current tree
     *
     * @return string
     */
    private function getUpdateRoute(Tree $tree): string
    {
        return route('module', [
            'module'      => $this->name(),
            'action'      => 'Update',
            'ged'         => $tree->name(),
            'generations' => $this->config->getGenerations(),
            'xref'        => '',
        ]);
    }
}
