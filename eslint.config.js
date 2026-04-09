import stylisticJs from "@stylistic/eslint-plugin";
import globals from "globals";

export default [
    {
        files: ["resources/js/modules/**/*.js"],
        plugins: {
            "@stylistic": stylisticJs,
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            // Code quality
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-undef": "error",
            "eqeqeq": ["error", "always"],
            "no-var": "error",
            "prefer-const": "warn",

            // Stylistic
            "@stylistic/semi": ["error", "always"],
            "@stylistic/indent": ["error", 4],
            "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
            "@stylistic/brace-style": ["error", "1tbs", { allowSingleLine: true }],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/space-before-blocks": "error",
            "@stylistic/keyword-spacing": "error",
            "@stylistic/space-infix-ops": "error",
        },
    },
    {
        files: ["resources/js/tests/**/*.js"],
        languageOptions: {
            globals: {
                ...globals.jest,
            },
        },
    },
];
