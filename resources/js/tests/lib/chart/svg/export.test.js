import { describe, expect, jest, test } from "@jest/globals";
import Export from "resources/js/modules/lib/chart/svg/export";

describe("Export", () => {
    test("triggerDownload prepares anchor and dispatches click", () => {
        const dispatchEvent = jest.fn();
        const setAttribute = jest.fn();
        const createElementSpy = jest
            .spyOn(document, "createElement")
            .mockReturnValue({ dispatchEvent, setAttribute });

        const exporter = new Export();
        exporter.triggerDownload("data:image/png", "chart.png");

        expect(setAttribute).toHaveBeenCalledWith("download", "chart.png");
        expect(setAttribute).toHaveBeenCalledWith("href", "data:image/png");
        expect(setAttribute).toHaveBeenCalledWith("target", "_blank");
        expect(dispatchEvent).toHaveBeenCalled();

        createElementSpy.mockRestore();
    });
});
