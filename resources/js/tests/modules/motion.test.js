import { jest } from "@jest/globals";

const { motionDuration } = await import("resources/js/modules/motion");

/**
 * Stubs the media query of the browser.
 *
 * @param {boolean} reduce Whether the user prefers reduced motion
 */
function preferReducedMotion(reduce) {
    window.matchMedia = jest.fn((query) => ({
        matches: reduce && query === "(prefers-reduced-motion: reduce)",
    }));
}

describe("motionDuration", () => {
    afterEach(() => {
        delete window.matchMedia;
    });

    test("keeps the duration when the user has no preference", () => {
        preferReducedMotion(false);

        expect(motionDuration(1250)).toBe(1250);
    });

    test("is zero when the user prefers reduced motion", () => {
        preferReducedMotion(true);

        expect(motionDuration(1250)).toBe(0);
    });

    test("keeps the duration in a browser without media queries", () => {
        delete window.matchMedia;

        expect(motionDuration(750)).toBe(750);
    });
});
