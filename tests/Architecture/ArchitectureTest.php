<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Architecture;

use PHPat\Selector\Selector;
use PHPat\Test\Attributes\TestRule;
use PHPat\Test\Builder\Rule;
use PHPat\Test\PHPat;

/**
 * Architecture rules enforced by PHPat (runs as part of PHPStan).
 *
 * The layer-DEPENDENCY directions (Model/Configuration are leaves, the facade
 * reaches only Configuration and Model, nothing depends on the composition root)
 * are now enforced centrally by the shared Deptrac ruleset (`deptrac.yaml` imports
 * `magicsunday/coding-standard`'s canonical layers). What remains here is the one
 * structural invariant Deptrac's layer model cannot express.
 *
 * @internal
 */
final class ArchitectureTest
{
    /**
     * Every abstract class carries the `Abstract` name prefix. The pattern is
     * matched against the fully qualified name, so `[^\\]*$` pins it to the
     * short class name rather than any namespace segment.
     *
     * @return Rule
     */
    #[TestRule]
    public function abstractClassesAreAbstractPrefixed(): Rule
    {
        return PHPat::rule()
            ->classes(Selector::isAbstract())
            ->should()->beNamed('/\\\\Abstract[^\\\\]*$/', true)
            ->because('House rule: abstract classes are named Abstract<Name>.');
    }
}
