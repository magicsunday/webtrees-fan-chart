import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { setInlineMarkup } from "resources/js/modules/inline-markup";

/**
 * Renders the markup into a fresh element and returns the element.
 *
 * @param {string} markup
 *
 * @return {HTMLElement}
 */
function render(markup) {
    const target = document.createElement("h2");

    target.textContent = "previous content";
    setInlineMarkup(target, markup);

    return target;
}

afterEach(() => {
    jest.restoreAllMocks();
    delete window.hostileRan;
});

describe("setInlineMarkup", () => {
    it("keeps the markup that the name of a person is rendered with", () => {
        const markup =
            'Fan chart of <span class="NAME" dir="auto" translate="no">Jane <span class="SURN">Doe</span> ' +
            '<q class="wt-nickname">Jay</q> <span class="starredname">Jo</span></span>';

        expect(render(markup).innerHTML).toBe(markup);
    });

    it("keeps the bdi element of a name", () => {
        expect(render("<bdi>Jane</bdi>").innerHTML).toBe("<bdi>Jane</bdi>");
    });

    it("replaces the previous content", () => {
        expect(render("Plain").textContent).toBe("Plain");
    });

    it("never assigns innerHTML to the target", () => {
        const setter = jest.spyOn(Element.prototype, "innerHTML", "set");

        render('<span class="NAME">Jane</span>');

        expect(setter).not.toHaveBeenCalled();
    });

    it("creates no element from a hostile image and shows no text of it as markup", () => {
        const target = render('<img src=x onerror="window.hostileRan = true">');

        expect(target.querySelector("img")).toBeNull();
        expect(target.children).toHaveLength(0);
        expect(window.hostileRan).toBeUndefined();
    });

    it("keeps the text of an escaped name as text", () => {
        const target = render("&lt;img src=x onerror=alert(1)&gt; &amp; Co");

        expect(target.children).toHaveLength(0);
        expect(target.textContent).toBe("<img src=x onerror=alert(1)> & Co");
    });

    it.each([
        ["a link", '<a href="javascript:alert(1)">x</a>', "x"],
        ["a script", "<script>window.hostileRan = true</script>", "window.hostileRan = true"],
        ["an iframe", '<iframe src="https://example.invalid"></iframe>', ""],
        ["a form", '<form action="https://example.invalid"><input name="a"></form>', ""],
        ["an svg", '<svg onload="window.hostileRan = true"><circle></circle></svg>', ""],
    ])("creates no element for %s", (_label, markup, text) => {
        const target = render(`before ${markup} after`);

        expect(target.children).toHaveLength(0);
        expect(target.textContent).toBe(`before ${text} after`);
    });

    it("keeps the allowed element around the text of a forbidden one", () => {
        const target = render('<span class="NAME"><u>Jane</u></span>');

        expect(target.innerHTML).toBe('<span class="NAME">Jane</span>');
    });

    it.each(["span", "q", "bdi"])(
        "drops every attribute of %s except class, dir and translate",
        (tag) => {
            const target = render(
                `<${tag} class="NAME" onclick="window.hostileRan = true" style="position:fixed" id="x" ` +
                    `data-a="1" dir="auto" translate="no">Jane</${tag}>`,
            );
            const element = target.querySelector(tag);

            expect([...element.attributes].map((attribute) => attribute.name).sort()).toEqual([
                "class",
                "dir",
                "translate",
            ]);
        },
    );

    it.each([
        ["dir", "ltr"],
        ["dir", "rtl"],
        ["translate", "yes"],
    ])("keeps the %s attribute with the allowed value %s", (name, value) => {
        const span = render(`<span ${name}="${value}">Jane</span>`).querySelector("span");

        expect(span.getAttribute(name)).toBe(value);
    });

    it.each([
        ["dir", "javascript:alert(1)"],
        ["translate", "maybe"],
    ])("drops the %s attribute when its value is none of the known ones", (name, value) => {
        const span = render(`<span ${name}="${value}">Jane</span>`).querySelector("span");

        expect(span.hasAttribute(name)).toBe(false);
    });

    it("drops a comment and keeps the text around it", () => {
        const target = render("Jane<!-- hidden --> Doe");

        expect(target.textContent).toBe("Jane Doe");
        expect(target.innerHTML).not.toContain("hidden");
    });

    it("renders an empty string as an empty element", () => {
        expect(render("").childNodes).toHaveLength(0);
    });
});
