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
 * The module is layered bottom-up: `Model` and `Configuration` are leaves,
 * `Traits` may reach `Configuration`, `Facade` may reach `Configuration` and
 * `Model`, and `Module` is the composition root nothing else depends on. The
 * rules below pin exactly that, so a dependency that inverts the layering reds
 * the build instead of quietly settling in.
 *
 * Note on the builder: several selectors passed to `classes()` are OR-ed, so a
 * "everything except X" set is expressed with the dedicated `excluding()` step,
 * never with a negated selector inside `classes()`.
 *
 * Scope limit: the `Traits` layer cannot be the SUBJECT of a rule. phpat resolves
 * a subject through PHPStan's `InClassNode`, which never fires for a trait on its
 * own, so such a rule matches nothing and passes green regardless — it would imply
 * coverage that does not exist. The traits stay pinned in the incoming direction
 * (the leaf rules below forbid the other layers from depending on them); only
 * their outgoing dependencies are unenforceable here.
 *
 * @internal
 */
final class ArchitectureTest
{
    /**
     * The module's root namespace.
     */
    private const string NAMESPACE_ROOT = 'MagicSunday\Webtrees\FanChart';

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

    /**
     * The chart node models carry data only — they must not reach back into the
     * configuration, the facade, the traits or the module.
     *
     * @return Rule
     */
    #[TestRule]
    public function modelIsALeaf(): Rule
    {
        return PHPat::rule()
            ->classes(Selector::inNamespace(self::NAMESPACE_ROOT . '\\Model'))
            ->shouldNot()->dependOn()
            ->classes(Selector::inNamespace(self::NAMESPACE_ROOT))
            ->excluding(Selector::inNamespace(self::NAMESPACE_ROOT . '\\Model'))
            ->because('Model holds chart data; it is the bottom layer.');
    }

    /**
     * The resolved chart configuration is a leaf as well: it reads module
     * settings, it does not consume any other part of the module.
     *
     * @return Rule
     */
    #[TestRule]
    public function configurationIsALeaf(): Rule
    {
        return PHPat::rule()
            ->classes(Selector::classname(self::NAMESPACE_ROOT . '\\Configuration'))
            ->shouldNot()->dependOn()
            ->classes(Selector::inNamespace(self::NAMESPACE_ROOT))
            ->excluding(Selector::classname(self::NAMESPACE_ROOT . '\\Configuration'))
            ->because('Configuration is a settings holder, not a consumer of the module.');
    }

    /**
     * The data facade builds the chart models from the resolved configuration.
     * It must not reach the module traits or the module class.
     *
     * @return Rule
     */
    #[TestRule]
    public function facadeDependsOnlyOnConfigurationAndModel(): Rule
    {
        return PHPat::rule()
            ->classes(Selector::inNamespace(self::NAMESPACE_ROOT . '\\Facade'))
            ->shouldNot()->dependOn()
            ->classes(Selector::inNamespace(self::NAMESPACE_ROOT))
            ->excluding(
                Selector::inNamespace(self::NAMESPACE_ROOT . '\\Facade'),
                Selector::inNamespace(self::NAMESPACE_ROOT . '\\Model'),
                Selector::classname(self::NAMESPACE_ROOT . '\\Configuration')
            )
            ->because('The facade turns Configuration plus webtrees data into Model objects.');
    }

    /**
     * The module class is the composition root — the webtrees entry point that
     * wires the rest together. No production class may depend on it. The test
     * namespace is excluded: a test for the module class necessarily names it.
     *
     * @return Rule
     */
    #[TestRule]
    public function nothingDependsOnTheModule(): Rule
    {
        return PHPat::rule()
            ->classes(Selector::inNamespace(self::NAMESPACE_ROOT))
            ->excluding(
                Selector::classname(self::NAMESPACE_ROOT . '\\Module'),
                Selector::inNamespace(self::NAMESPACE_ROOT . '\\Test')
            )
            ->shouldNot()->dependOn()
            ->classes(Selector::classname(self::NAMESPACE_ROOT . '\\Module'))
            ->because('Module is the composition root; dependencies point away from it.');
    }
}
