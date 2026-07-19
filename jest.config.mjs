export default {
    moduleNameMapper: {
        "^resources/js/modules/(.*)$": "<rootDir>/resources/js/modules/$1"
    },
    setupFilesAfterEnv: ["<rootDir>/resources/js/tests/setup.js"],
    testEnvironment: "jsdom",
    transform: {}
};
