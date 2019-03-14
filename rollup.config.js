import node from "rollup-plugin-node-resolve";

export default {
    input: "resources/js/modules/index.js",
    output: {
        name: "rso",
        format: "umd",
        file: "resources/js/fan-chart.js"
    },
    plugins: [node()],
};
