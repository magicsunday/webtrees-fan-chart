import node from "rollup-plugin-node-resolve";

export default {
    input: "js/modules/index.js",
    output: {
        name: "rso",
        format: "umd",
        file: "js/ancestral-fan-chart.js"
    },
    plugins: [node()],
};
