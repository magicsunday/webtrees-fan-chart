import { describe, expect, test, beforeEach } from "@jest/globals";
import { Storage } from "resources/js/modules/lib/storage";

describe("Storage", () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = "";
    });

    test("register restores stored value and listens for updates", () => {
        localStorage.setItem("form", JSON.stringify({ field: "saved" }));

        const input = document.createElement("input");
        input.id = "field";
        input.name = "field";
        document.body.appendChild(input);

        const storage = new Storage("form");
        storage.register("field");

        expect(input.value).toBe("saved");

        input.value = "updated";
        input.dispatchEvent(new Event("input", { bubbles: true }));

        const stored = JSON.parse(localStorage.getItem("form"));
        expect(stored.field).toBe("updated");
    });

    test("register stores checkbox state", () => {
        const checkbox = document.createElement("input");
        checkbox.id = "notify";
        checkbox.name = "notify";
        checkbox.type = "checkbox";
        document.body.appendChild(checkbox);

        const storage = new Storage("options");
        storage.register("notify");

        let stored = JSON.parse(localStorage.getItem("options"));
        expect(stored.notify).toBe(false);

        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("input", { bubbles: true }));

        stored = JSON.parse(localStorage.getItem("options"));
        expect(stored.notify).toBe(true);
    });

    test("register restores radio selection by value", () => {
        localStorage.setItem("displayMode", JSON.stringify({ displayMode: "names" }));

        const radioBoth = document.createElement("input");
        radioBoth.id = "displayMode-both";
        radioBoth.name = "displayMode";
        radioBoth.type = "radio";
        radioBoth.value = "both";

        const radioNames = document.createElement("input");
        radioNames.id = "displayMode-names";
        radioNames.name = "displayMode";
        radioNames.type = "radio";
        radioNames.value = "names";

        document.body.appendChild(radioBoth);
        document.body.appendChild(radioNames);

        const storage = new Storage("displayMode");
        storage.register("displayMode");

        expect(radioNames.checked).toBe(true);
        expect(radioBoth.checked).toBe(false);

        radioBoth.checked = true;
        radioBoth.dispatchEvent(new Event("input", { bubbles: true }));

        const stored = JSON.parse(localStorage.getItem("displayMode"));
        expect(stored.displayMode).toBe("both");
    });
});
