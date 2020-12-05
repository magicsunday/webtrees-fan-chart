import resolve from '@rollup/plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

export default [
    {
        input: "resources/js/modules/index.js",
        output: [
            {
                name: "WebtreesFanChart",
                file: "resources/js/fan-chart.js",
                format: "umd"
            }
        ],
        plugins: [
            resolve()
        ]
    },
    {
        input: "resources/js/modules/index.js",
        output: [
            {
                name: "WebtreesFanChart",
                file: "resources/js/fan-chart.min.js",
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
