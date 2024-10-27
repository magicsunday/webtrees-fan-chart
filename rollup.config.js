import pkg from "./package.json" with {type: "json"};
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import license from "rollup-plugin-license";

export default [
    // fan-chart.js
    {
        input: "resources/js/modules/index.js",
        output: [
            {
                name: "WebtreesFanChart",
                file: "resources/js/fan-chart-" + pkg.version + ".js",
                format: "umd"
            }
        ],
        plugins: [
            resolve(),
            license({
                banner: `
This file is part of the package magicsunday/<%= pkg.name %>.

For the full copyright and license information, please read the
LICENSE file that was distributed with this source code.

Generated: <%= moment().format('YYYY-MM-DD HH:mm:ss') %>
Version: <%= pkg.version %>`
            })
        ]
    },
    {
        input: "resources/js/modules/index.js",
        output: [
            {
                name: "WebtreesFanChart",
                file: "resources/js/fan-chart-" + pkg.version + ".min.js",
                format: "umd"
            }
        ],
        plugins: [
            resolve(),
            terser({
                mangle: true,
                compress: true,
                module: true,
                output: {
                    comments: false
                }
            }),
            license({
                banner: `
This file is part of the package magicsunday/<%= pkg.name %>.

For the full copyright and license information, please read the
LICENSE file that was distributed with this source code.

Generated: <%= moment().format('YYYY-MM-DD HH:mm:ss') %>
Version: <%= pkg.version %>`
            })
        ]
    },

    // fan-chart-storage.js
    {
        input: "resources/js/modules/lib/storage.js",
        output: [
            {
                name: "WebtreesFanChart",
                file: "resources/js/fan-chart-storage.js",
                format: "umd"
            }
        ],
        plugins: [
            resolve()
        ]
    },
    {
        input: "resources/js/modules/lib/storage.js",
        output: [
            {
                name: "WebtreesFanChart",
                file: "resources/js/fan-chart-storage.min.js",
                format: "umd"
            }
        ],
        plugins: [
            resolve(),
            terser({
                mangle: true,
                compress: true,
                module: true,
                output: {
                    comments: false
                }
            })
        ]
    }
];
