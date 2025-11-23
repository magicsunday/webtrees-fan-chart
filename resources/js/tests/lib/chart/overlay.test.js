import { describe, expect, jest, test } from "@jest/globals";
import Overlay from "resources/js/modules/lib/chart/overlay";

class StubSelection {
    constructor(tag = "root", parent = null) {
        this.tag = tag;
        this.parent = parent;
        this.children = [];
        this.attrs = {};
        this.styles = {};
        this.textContent = "";
    }

    append(tag) {
        const child = new StubSelection(tag, this);
        this.children.push(child);
        return child;
    }

    attr(name, value) {
        this.attrs[name] = value;
        return this;
    }

    style(name, value) {
        this.styles[name] = value;
        return this;
    }

    select(tag) {
        const normalizedTag = tag.replace(".", "");
        const found = this.children.find((child) => child.tag === normalizedTag);

        return found || new StubSelection(normalizedTag, this);
    }

    remove() {
        if (this.parent) {
            this.parent.children = this.parent.children.filter((child) => child !== this);
        }

        return this;
    }

    text(value) {
        this.textContent = value;
        return this;
    }

    transition() {
        const selection = this;

        return {
            delay(delay) {
                selection.lastDelay = delay;
                return this;
            },
            duration(duration) {
                selection.lastDuration = duration;
                return this;
            },
            style(name, value) {
                selection.styles[name] = value;
                return this;
            },
            on(event, callback) {
                selection.lastEvent = event;

                if (typeof callback === "function") {
                    callback();
                }

                return this;
            },
        };
    }
}

describe("Overlay", () => {
    test("show renders tooltip and runs callback", () => {
        const parent = new StubSelection("div");
        const overlay = new Overlay(parent);
        const callback = jest.fn();

        overlay.show("Hello world", 0, callback);

        const tooltip = overlay.get().children.find((child) => child.tag === "p");

        expect(tooltip).toBeDefined();
        expect(tooltip?.attrs.class).toBe("tooltip");
        expect(tooltip?.textContent).toBe("Hello world");
        expect(overlay.get().styles.opacity).toBe(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test("hide applies opacity transition", () => {
        const parent = new StubSelection("div");
        const overlay = new Overlay(parent);

        overlay.hide(50, 150);

        expect(overlay.get().lastDelay).toBe(50);
        expect(overlay.get().lastDuration).toBe(150);
        expect(overlay.get().styles.opacity).toBeCloseTo(1e-6);
    });
});
