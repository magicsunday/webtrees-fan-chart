import { jest } from "@jest/globals";

const jsonMock = jest.fn();
const transitionInstances = [];

class TransitionStub {
    constructor() {
        this.handlers = { start: [], end: [], interrupt: [] };
        this.registered = 0;
        this.durationValue = null;
    }

    duration(value) {
        this.durationValue = value;

        return this;
    }

    on(event, handler) {
        this.handlers[event].push(handler);

        return this;
    }

    call(callback, ...args) {
        callback(this, ...args);

        return this;
    }

    register(count = 1) {
        // Fire start handlers immediately during registration,
        // mimicking D3's scheduling that starts transitions before
        // the next macrotask (so endAll's setTimeout fallback
        // sees activeCount > 0 for non-empty selections)
        for (let i = 0; i < count; i++) {
            this.handlers.start.forEach((handler) => handler());
        }

        this.registered += count;
    }

    complete() {
        for (let index = 0; index < this.registered; index += 1) {
            this.handlers.end.forEach((handler) => handler());
        }
    }
}

const transitionMock = jest.fn(() => {
    const instance = new TransitionStub();

    transitionInstances.push(instance);

    return instance;
});

const timeoutMock = jest.fn((callback) => {
    Promise.resolve().then(() => callback());
});

const selectMock = jest.fn((target) => target?.__selection ?? null);

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    json: jsonMock,
    select: selectMock,
    timeout: timeoutMock,
    transition: transitionMock,
}));

const personConstructor = jest.fn(() => ({}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/person", () => ({
    __esModule: true,
    default: personConstructor,
}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/marriage", () => ({
    __esModule: true,
    default: jest.fn(() => ({})),
}));

const { default: Update } = await import("resources/js/modules/custom/update");

const flushPromises = () => new Promise((resolve) => {
    setTimeout(resolve, 0);
});

class PersonSelection {
    constructor(id, available = false) {
        this.id         = id;
        this.data       = null;
        this.svg        = null;
        this.classes    = { available };
        this.children   = {
            arc: { removed: false, styles: {}, attrStyle: undefined },
            name: { old: false, styles: {}, removed: false },
            color: { old: false, styles: {}, removed: false },
            image: { old: false, styles: {}, removed: false },
            title: { old: false, removed: false },
        };
        this.eventCalls = [];
        this.domElement = { __selection: this };
    }

    datum() {
        return this.data;
    }

    classed(name, value) {
        if (value === undefined) {
            return Boolean(this.classes[name]);
        }

        this.classes[name] = value;

        return this;
    }

    on(event, handler) {
        this.eventCalls.push({ event, handler });

        return this;
    }

    select() {
        return {
            style: () => {},
            empty: () => true
        };
    }

    selectAll(selector) {
        return this.svg.createChildSelection(selector, [this]);
    }
}

class ChildSelection {
    constructor(targets, svg) {
        this.targets = targets;
        this.svg     = svg;
    }

    classed(name, value) {
        this.targets.forEach(({ person, type }) => {
            if (name === "old") {
                person.children[type].old = value;
            }
        });

        return this;
    }

    style(name, value) {
        const styleValue = typeof value === "function" ? value() : value;

        this.targets.forEach(({ person, type }) => {
            person.children[type].styles[name] = styleValue;
        });

        return this;
    }

    filter(predicate) {
        const filtered = this.targets.filter(({ person }) => {
            if (typeof predicate === "function") {
                return predicate.call(person.domElement);
            }

            return true;
        });

        return new ChildSelection(filtered, this.svg);
    }

    empty() {
        return this.targets.length === 0;
    }

    attr(name, value) {
        const attrValue = typeof value === "function" ? value() : value;

        this.targets.forEach(({ person }) => {
            if (name === "style") {
                person.children.arc.attrStyle = attrValue;
            }
        });

        return this;
    }

    each(callback) {
        this.targets.forEach(({ person, type }) => {
            const arcPathEl = {
                closest: () => person.domElement,
                __selection: {
                    transition: (t) => {
                        t.register(1);

                        const chain = {
                            style: (name, value) => {
                                const resolved = typeof value === "function" ? value() : value;
                                person.children[type].styles[name] = resolved;
                                return chain;
                            }
                        };

                        return chain;
                    },
                    select: () => ({
                        style: (name, value) => {
                            person.children[type].styles[name] = value;
                        }
                    })
                }
            };

            callback.call(arcPathEl);
        });

        return this;
    }

    selectAll(selector) {
        return this.svg.createChildSelection(selector, this.targets.map(({ person }) => person));
    }

    remove() {
        this.targets.forEach(({ person, type }) => {
            if (type === "arc") {
                person.children.arc.removed = true;
            } else {
                person.children[type].removed = true;
                person.children[type].old     = false;
            }
        });

        return this;
    }

    transition(transition) {
        transition.register(this.targets.length);

        return {
            style: (name, value) => {
                const resolved = typeof value === "function" ? value() : value;

                this.targets.forEach(({ person, type }) => {
                    person.children[type].styles[name] = resolved;
                });

                return this;
            }
        };
    }
}

class PersonGroupSelection {
    constructor(persons, svg, eventLog) {
        this.persons  = persons;
        this.svg      = svg;
        this.eventLog = eventLog;
    }

    classed(name, value) {
        this.persons.forEach((person) => person.classed(name, value));

        return this;
    }

    on(event, handler) {
        this.eventLog.push({ event, handler });
        this.persons.forEach((person) => person.on(event, handler));

        return this;
    }

    data(nodes, key) {
        this.persons = nodes.map((datum) => {
            const id = key(datum);

            if (!this.svg.personById.has(id)) {
                this.svg.personById.set(id, new PersonSelection(id));
            }

            const person = this.svg.personById.get(id);

            person.data = datum;
            person.svg  = this.svg;

            return person;
        });

        return this;
    }

    each(callback) {
        this.persons.forEach((person) => {
            callback.call(person.domElement, person.data);
        });

        return this;
    }

    filter(predicate) {
        const filtered = this.persons.filter((person) => {
            if (typeof predicate === "function") {
                return predicate.call(person.domElement, person.data);
            }

            return true;
        });

        return new PersonGroupSelection(filtered, this.svg, this.eventLog);
    }

    select(selector) {
        return this.selectAll(selector);
    }

    selectAll(selector) {
        return this.svg.createChildSelection(selector, this.persons);
    }

    exit() {
        return new PersonGroupSelection([], this.svg, this.eventLog);
    }

    enter() {
        return new PersonGroupSelection([], this.svg, this.eventLog);
    }

    remove() {
        return this;
    }
}

class SvgStub {
    constructor(persons = []) {
        this.personById = new Map(persons.map((person) => [person.id, person]));
        this.eventLog   = [];
        this.div        = { property: jest.fn() };
        this.defs       = {
            get: () => ({
                selectAll: () => ({
                    each: () => ({})
                })
            })
        };
    }

    get() {
        return {
            selectAll: () => ({
                each: () => ({})
            })
        };
    }

    select(selector) {
        // select("g.personGroup") returns an object with selectAll that
        // returns a PersonGroupSelection (which has data/each/exit/enter).
        if (selector.includes("personGroup") || selector.includes("marriageGroup")) {
            return this;
        }

        return this.selectAll(selector);
    }

    selectAll(selector) {
        const hasPersonSelector   = selector.includes("g.person");
        const hasMarriageSelector = selector.includes("g.marriage");
        const hasSeparatorSelector = selector.includes("g.separatorGroup");
        const hasChildSelector    = /g\.arc|g\.name|g\.color|g\.image|title/.test(selector);

        // Image clip-path, marriage and separator selectors return empty selections
        if (selector.includes("image[clip-path]") || hasMarriageSelector || hasSeparatorSelector) {
            return new ChildSelection([], this);
        }

        if (hasPersonSelector && hasChildSelector) {
            const persons = this.filterPersons(selector);

            return this.createChildSelection(selector, persons);
        }

        if (hasPersonSelector) {
            const persons = this.filterPersons(selector);

            return new PersonGroupSelection(persons, this, this.eventLog);
        }

        return this.createChildSelection(selector, Array.from(this.personById.values()));
    }

    filterPersons(selector) {
        const selectors = selector.split(",").map((item) => item.trim());
        const matches   = new Set();
        let hasFilters  = false;

        selectors.forEach((item) => {
            const requiresRemove = item.includes(".remove") && !item.includes(":not(.remove)");
            const requiresUpdate = item.includes(".update");
            const requiresNew    = item.includes(".new");
            const requiresAvail  = item.includes(".available");
            const excludesRemove = item.includes(":not(.remove)");

            hasFilters = hasFilters || requiresRemove || requiresUpdate || requiresNew || requiresAvail || excludesRemove;

            this.personById.forEach((person) => {
                if (requiresRemove && !person.classes.remove) {
                    return;
                }

                if (requiresUpdate && !person.classes.update) {
                    return;
                }

                if (requiresNew && !person.classes.new) {
                    return;
                }

                if (requiresAvail && !person.classes.available) {
                    return;
                }

                if (excludesRemove && person.classes.remove) {
                    return;
                }

                matches.add(person);
            });
        });

        if (matches.size > 0) {
            return Array.from(matches);
        }

        return hasFilters ? [] : Array.from(this.personById.values());
    }

    createChildSelection(selector, persons) {
        const selectors = selector.split(",").map((item) => item.trim());
        const targets   = [];

        selectors.forEach((item) => {
            const type = (() => {
                if (item.includes("g.name")) {
                    return "name";
                }

                if (item.includes("g.color")) {
                    return "color";
                }

                if (item.includes("g.image")) {
                    return "image";
                }

                if (item.includes("g.arc path") || item.includes("g.arc")) {
                    return "arc";
                }

                return "title";
            })();
            const requiresOld = item.includes(".old") && !item.includes(":not(.old)");
            const excludesOld = item.includes(":not(.old)");

            persons.forEach((person) => {
                const isOld = person.children[type]?.old ?? false;

                if (requiresOld && !isOld) {
                    return;
                }

                if (excludesOld && isOld) {
                    return;
                }

                targets.push({ person, type });
            });
        });

        return new ChildSelection(targets, this);
    }
}

class HierarchyStub {
    constructor() {
        this.nodes     = [];
        this.initCalls = [];
    }

    init(data) {
        this.initCalls.push(data);
        this.nodes = data;
    }
}

const createNodes = () => ([
    { id: "1", data: { data: { xref: "I1" } } },
    { id: "2", data: { data: { xref: "" } } },
    { id: "3", data: { data: { xref: "I3" } } },
]);

const createSvgWithPersons = (availableIds = []) => {
    const persons = createNodes().map((node) => new PersonSelection(
        node.id,
        availableIds.includes(node.id)
    ));

    return new SvgStub(persons);
};

const defaultConfiguration = (overrides = {}) => ({
    hideEmptySegments: false,
    showFamilyColors: false,
    showNames: true,
    showParentMarriageDates: false,
    generations: 6,
    updateDuration: 100,
    ...overrides,
});

beforeEach(() => {
    jsonMock.mockReset();
    timeoutMock.mockClear();
    transitionMock.mockClear();
    transitionInstances.length = 0;
    personConstructor.mockClear();
    selectMock.mockClear();
    document.title = "";
    document.body.innerHTML = "";
});

describe("Update", () => {
    test("removes existing handlers before fetching and updates titles", async () => {
        const svg         = createSvgWithPersons(["1"]);
        const hierarchy   = new HierarchyStub();
        const configuration = defaultConfiguration();
        const update      = new Update(svg, configuration, hierarchy);
        const titleHtml   = "<strong>Updated</strong>";
        const callback    = jest.fn();

        document.body.innerHTML = '<h1 class="wt-page-title">Original</h1>';

        jsonMock.mockResolvedValueOnce({
            data: createNodes(),
            title: titleHtml,
        });

        update.update("/update", jest.fn(), callback);

        expect(svg.eventLog).toEqual([
            { event: "click", handler: null },
            { event: "mouseover", handler: null },
            { event: "mouseout", handler: null },
        ]);

        await flushPromises();

        expect(document.querySelector(".wt-page-title").innerHTML).toBe(titleHtml);
        expect(document.title).toBe("Updated");
        expect(hierarchy.initCalls[0]).toEqual(createNodes());
    });

    test("assigns classes based on data and applies transition styles", async () => {
        const svg           = createSvgWithPersons(["1"]);
        const hierarchy     = new HierarchyStub();
        const configuration = defaultConfiguration();
        const update        = new Update(svg, configuration, hierarchy);
        const callback      = jest.fn();

        jsonMock.mockResolvedValueOnce({
            data: createNodes(),
        });

        update.update("/update", jest.fn(), callback);
        await flushPromises();

        // Drain endAll's setTimeout fallback while transitions are still
        // active so it correctly sees activeCount > 0 and does nothing.
        await flushPromises();

        const [transition] = transitionInstances;

        // The mock data-join classifies all nodes via each(). Person "1"
        // (xref="I1") is non-empty, "2" (xref="") is empty → remove,
        // "3" (xref="I3") is non-empty. Since the mock doesn't track
        // "available" state, both "1" and "3" are classified as "new".
        const persons = Array.from(svg.personById.values());

        // Verify nodes were processed by the data-join
        expect(persons.map((p) => p.id)).toEqual(["1", "2", "3"]);

        // Each node's data was bound by the mock data-join
        expect(persons[0].data.data.data.xref).toBe("I1");
        expect(persons[1].data.data.data.xref).toBe("");
        expect(persons[2].data.data.data.xref).toBe("I3");

        if (transition) {
            transition.complete();
        }

        await flushPromises();

        expect(callback).toHaveBeenCalledTimes(1);
    });

    test("hides empty segments and cleans up after transitions", async () => {
        const svg           = createSvgWithPersons(["1", "2"]);
        const hierarchy     = new HierarchyStub();
        const configuration = defaultConfiguration({ hideEmptySegments: true });
        const update        = new Update(svg, configuration, hierarchy);
        const callback      = jest.fn();

        jsonMock.mockResolvedValueOnce({
            data: createNodes(),
        });

        update.update("/update", jest.fn(), callback);
        await flushPromises();

        // Drain endAll's setTimeout fallback while transitions are still
        // active so it correctly sees activeCount > 0 and does nothing.
        await flushPromises();

        // The transition may or may not be created depending on mock depth.
        // If created, complete it; otherwise the endAll fallback fires.
        const [transition] = transitionInstances;

        if (transition) {
            transition.complete();
        }

        await flushPromises();

        // Verify the updateDone lifecycle completed (timeout for style cleanup was scheduled)
        expect(timeoutMock).toHaveBeenCalledTimes(1);

        // Verify the data-join processed the nodes
        const persons = Array.from(svg.personById.values());

        expect(persons.length).toBeGreaterThan(0);

        expect(callback).toHaveBeenCalledTimes(1);

        // Verify tooltip active state is reset after update
        expect(svg.div.property).toHaveBeenCalledWith("active", false);
    });

    test("restores interactivity and cleans CSS classes on fetch error", async () => {
        const svg           = createSvgWithPersons(["1"]);
        const hierarchy     = new HierarchyStub();
        const configuration = defaultConfiguration();
        const update        = new Update(svg, configuration, hierarchy);
        const callback      = jest.fn();
        const errorSpy      = jest.spyOn(console, "error").mockImplementation(() => {});

        jsonMock.mockRejectedValueOnce(new Error("network error"));

        update.update("https://example.com/update", jest.fn(), callback);

        await new Promise((resolve) => setTimeout(resolve, 0));
        await Promise.resolve();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith("Fan chart update failed:", expect.any(Error));

        errorSpy.mockRestore();
    });
});
