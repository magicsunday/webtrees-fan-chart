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
            "yoda": ["error", "never"],

            // Stylistic
            "@stylistic/semi": ["error", "always"],
            "@stylistic/indent": ["error", 4],
            "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
            "@stylistic/brace-style": ["error", "1tbs"],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
            "@stylistic/comma-spacing": ["error", { before: false, after: true }],
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/no-multi-spaces": "error",
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/space-before-blocks": "error",
            "@stylistic/keyword-spacing": "error",
            "@stylistic/space-infix-ops": "error",
            "@stylistic/padding-line-between-statements": ["error",
                { blankLine: "always", prev: "*", next: "return" },
                { blankLine: "always", prev: "*", next: "if" },
            ],
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
