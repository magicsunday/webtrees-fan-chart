<?php

/**
 * This file is part of the package magicsunday/webtrees-fan-chart.
 *
 * For the full copyright and license information, please read the
 * LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MagicSunday\Webtrees\FanChart\Test\Support;

use Aura\Router\Map;
use Aura\Router\Route;
use Fisharebest\Webtrees\Contracts\ContainerInterface;
use Fisharebest\Webtrees\Contracts\RouteFactoryInterface;
use Fisharebest\Webtrees\Registry;
use OutOfBoundsException;

use function http_build_query;

/**
 * Registers a route factory that renders a route as its name and query, and a container that
 * hands out the services that a test asks for.
 *
 * @author  Rico Sonntag <mail@ricosonntag.de>
 * @license https://opensource.org/licenses/GPL-3.0 GNU General Public License v3.0
 * @link    https://github.com/magicsunday/webtrees-fan-chart/
 */
final class RoutingFixture
{
    /**
     * Prevents instances, the fixture only registers services.
     */
    private function __construct()
    {
    }

    /**
     * Registers the route factory and a container with it and the given services.
     *
     * @param array<string, object> $services Further services by the id that the code asks the container for
     */
    public static function register(array $services = []): void
    {
        $routeFactory = new class implements RouteFactoryInterface {
            public function route(string $route_name, array $parameters = []): string
            {
                return '/route/' . $route_name . '?' . http_build_query($parameters);
            }

            public function routeMap(): Map
            {
                return new Map(new Route());
            }
        };

        $container = new readonly class([RouteFactoryInterface::class => $routeFactory, ...$services]) implements ContainerInterface {
            /**
             * @param array<string, object> $services The services by id
             */
            public function __construct(private array $services)
            {
            }

            public function get(string $id): object
            {
                return $this->services[$id] ?? throw new OutOfBoundsException('The container has no service ' . $id);
            }

            public function has(string $id): bool
            {
                return isset($this->services[$id]);
            }

            public function set(string $id, object $object): static
            {
                return $this;
            }
        };

        Registry::routeFactory($routeFactory);
        Registry::container($container);
    }
}
