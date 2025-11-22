import { jest } from "@jest/globals";

Object.defineProperty(window, "getComputedStyle", {
    configurable: true,
    value: jest.fn(() => ({
        getPropertyValue: jest.fn(() => ""),
        fontSize: "16px"
    }))
});

const orientationMock = {
    angle: 0,
    lock: jest.fn().mockResolvedValue(undefined),
    type: "landscape-primary",
    unlock: jest.fn().mockResolvedValue(undefined)
};

Object.defineProperty(window.screen, "orientation", {
    configurable: true,
    value: orientationMock
});

let fullscreenElement = null;

Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get() {
        return fullscreenElement;
    },
    set(value) {
        fullscreenElement = value;
    }
});
