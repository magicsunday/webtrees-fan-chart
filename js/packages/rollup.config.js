import node from "rollup-plugin-node-resolve";

export default {
    input: "index.js",
    output: {
        name: "d3",
        format: "umd",
        file: "d3.v4.custom.js"
    },
    plugins: [node()],
};
