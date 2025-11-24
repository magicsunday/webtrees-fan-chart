import { jest } from "@jest/globals";
import ViewportEventService from "resources/js/modules/custom/viewport-event-service";

describe("ViewportEventService", () => {
    let documentRef;
    let windowRef;
    let updateViewBox;
    let center;
    let parentNode;
    let selection;

    beforeEach(() => {
        documentRef = {
            fullscreenElement: null,
            documentElement: { toggleAttribute: jest.fn() },
            addEventListener: jest.fn(),
        };
        windowRef = {
            addEventListener: jest.fn(),
        };
        updateViewBox = jest.fn();
        center        = jest.fn();
        parentNode    = { contains: jest.fn(() => false) };
        selection     = { node: () => parentNode };
    });

    const createService = () => new ViewportEventService({
        getContainer: () => selection,
        onUpdateViewBox: updateViewBox,
        onCenter: center,
        documentRef,
        windowRef,
    });

    it("registers resize and fullscreen listeners", () => {
        const service = createService();

        service.register();

        expect(documentRef.addEventListener).toHaveBeenCalledWith("fullscreenchange", expect.any(Function));
        expect(windowRef.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    });

    it("updates the view box when fullscreen targets the chart", () => {
        const service = createService();

        service.register();

        const fullscreenHandler = documentRef.addEventListener.mock.calls[0][1];

        documentRef.fullscreenElement = { contains: jest.fn(() => true) };
        fullscreenHandler();

        expect(documentRef.documentElement.toggleAttribute).toHaveBeenCalledWith("fullscreen", true);
        expect(updateViewBox).toHaveBeenCalledTimes(1);

        documentRef.fullscreenElement = null;
        fullscreenHandler();

        expect(documentRef.documentElement.toggleAttribute).toHaveBeenCalledWith("fullscreen", false);
        expect(updateViewBox).toHaveBeenCalledTimes(2);
    });

    it("ignores fullscreen changes for other elements", () => {
        const service = createService();

        service.register();

        const fullscreenHandler = documentRef.addEventListener.mock.calls[0][1];

        documentRef.fullscreenElement = { contains: jest.fn(() => false) };
        parentNode.contains.mockReturnValue(false);
        fullscreenHandler();

        expect(documentRef.documentElement.toggleAttribute).toHaveBeenCalledWith("fullscreen", false);
        expect(updateViewBox).not.toHaveBeenCalled();
    });

    it("refreshes the view box on resize", () => {
        const service = createService();

        service.register();

        const resizeHandler = windowRef.addEventListener.mock.calls[0][1];

        resizeHandler();

        expect(updateViewBox).toHaveBeenCalledTimes(1);
    });

    it("delegates resize and center actions to callbacks", () => {
        const service = createService();

        service.resize();
        service.center();

        expect(updateViewBox).toHaveBeenCalledTimes(1);
        expect(center).toHaveBeenCalledTimes(1);
    });

    it("ignores fullscreen updates without a container", () => {
        selection = null;
        const service = createService();

        service.register();

        const fullscreenHandler = documentRef.addEventListener.mock.calls[0][1];

        fullscreenHandler();

        expect(updateViewBox).not.toHaveBeenCalled();
        expect(documentRef.documentElement.toggleAttribute).not.toHaveBeenCalled();
    });
});
