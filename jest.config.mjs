export default {
    moduleNameMapper: {
        "^resources/js/modules/(.*)$": "<rootDir>/resources/js/modules/$1"
    },
    globalSetup: "<rootDir>/resources/js/tests/globalSetup.js",
    setupFilesAfterEnv: ["<rootDir>/resources/js/tests/setup.js"],
    testEnvironment: "jsdom",
    transform: {}
};
