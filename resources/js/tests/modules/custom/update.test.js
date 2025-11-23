import { jest } from "@jest/globals";

const jsonMock = jest.fn();
const timerStops = [];
const transitionInstances = [];

class TransitionStub {
    constructor() {
        this.handlers = { start: [], end: [] };
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
        this.registered += count;
    }

    complete() {
        for (let index = 0; index < this.registered; index += 1) {
            this.handlers.start.forEach((handler) => handler());
        }

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

const timerMock = jest.fn((callback) => {
    const stop  = jest.fn();
    const timer = { stop };

    timerStops.push(stop);

    Promise.resolve().then(() => callback());

    return timer;
});

const selectMock = jest.fn((target) => target?.__selection ?? null);

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    json: jsonMock,
    select: selectMock,
    timer: timerMock,
    transition: transitionMock,
}));

const personConstructor = jest.fn(() => ({}));

await jest.unstable_mockModule("resources/js/modules/custom/svg/person", () => ({
    __esModule: true,
    default: personConstructor,
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
            title: { old: false, removed: false },
        };
        this.eventCalls = [];
        this.domElement = { __selection: this };
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

    attr(name, value) {
        const attrValue = typeof value === "function" ? value() : value;

        this.targets.forEach(({ person }) => {
            if (name === "style") {
                person.children.arc.attrStyle = attrValue;
            }
        });

        return this;
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

    selectAll(selector) {
        return this.svg.createChildSelection(selector, this.persons);
    }
}

class SvgStub {
    constructor(persons = []) {
        this.personById = new Map(persons.map((person) => [person.id, person]));
        this.eventLog   = [];
    }

    selectAll(selector) {
        const hasPersonSelector = selector.includes("g.person");
        const hasChildSelector  = /g\.arc|g\.name|g\.color|title/.test(selector);

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
    updateDuration: 100,
    ...overrides,
});

const createArcFactory = () => ({
    createPrimaryArc: jest.fn(() => ({})),
    createOverlayArc: jest.fn(() => ({})),
});

const createGeometry = () => ({
    createLayout: jest.fn(() => ({
        startAngle: 0,
        endAngle: 0,
        innerRadius: 0,
        outerRadius: 0,
        centerRadius: 0,
    })),
});

beforeEach(() => {
    jsonMock.mockReset();
    timerMock.mockClear();
    transitionMock.mockClear();
    transitionInstances.length = 0;
    timerStops.length = 0;
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
        const geometry    = createGeometry();
        const update      = new Update(svg, configuration, hierarchy, createArcFactory(), geometry);
        const titleHtml   = "<strong>Updated</strong>";
        const callback    = jest.fn();

        document.body.innerHTML = '<h1 class="wt-page-title">Original</h1>';

        jsonMock.mockResolvedValueOnce({
            data: createNodes(),
            title: titleHtml,
        });

        update.update("/update", callback);

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
        const geometry      = createGeometry();
        const update        = new Update(svg, configuration, hierarchy, createArcFactory(), geometry);
        const callback      = jest.fn();

        jsonMock.mockResolvedValueOnce({
            data: createNodes(),
        });

        update.update("/update", callback);
        await flushPromises();

        const [transition] = transitionInstances;

        expect(Array.from(svg.personById.values()).map((person) => ({
            id: person.id,
            classes: person.classes,
        }))).toEqual([
            { id: "1", classes: { available: true, hover: false, remove: false, update: true, new: false } },
            { id: "2", classes: { available: false, hover: false, remove: true, update: false, new: false } },
            { id: "3", classes: { available: false, hover: false, remove: false, update: false, new: true } },
        ]);

        expect(Array.from(svg.personById.values()).map((person) => person.children.name.old)).toEqual([
            true,
            true,
            false,
        ]);

        expect(Array.from(svg.personById.values()).map((person) => person.children.name.styles.opacity)).toEqual([
            1e-6,
            1e-6,
            1,
        ]);

        expect(Array.from(svg.personById.values()).map((person) => person.children.arc.styles.fill)).toEqual([
            undefined,
            "rgb(235, 235, 235)",
            "rgb(250, 250, 250)",
        ]);

        expect(Array.from(svg.personById.values()).map((person) => person.children.arc.styles.opacity)).toEqual([
            undefined,
            null,
            null,
        ]);

        transition.complete();
        await flushPromises();

        expect(callback).toHaveBeenCalledTimes(1);
    });

    test("hides empty segments and cleans up after transitions", async () => {
        const svg           = createSvgWithPersons(["1", "2"]);
        const hierarchy     = new HierarchyStub();
        const configuration = defaultConfiguration({ hideEmptySegments: true });
        const geometry      = createGeometry();
        const update        = new Update(svg, configuration, hierarchy, createArcFactory(), geometry);
        const callback      = jest.fn();

        jsonMock.mockResolvedValueOnce({
            data: createNodes(),
        });

        update.update("/update", callback);
        await flushPromises();

        const [transition] = transitionInstances;

        expect(Array.from(svg.personById.values()).map((person) => person.children.arc.styles.opacity)).toEqual([
            undefined,
            1e-6,
            1,
        ]);

        transition.complete();
        await flushPromises();

        expect(timerMock).toHaveBeenCalledTimes(1);
        expect(timerStops[0]).toHaveBeenCalledTimes(1);

        const persons = Array.from(svg.personById.values());

        expect(persons[1].children.arc.removed).toBe(true);
        expect(persons[0].children.arc.attrStyle).toBeNull();
        expect(persons[2].children.name.styles.opacity).toBeNull();

        expect(persons.map((person) => person.classes)).toEqual([
            { available: false, hover: false, remove: false, update: false, new: false },
            { available: false, hover: false, remove: false, update: false, new: false },
            { available: false, hover: false, remove: false, update: false, new: false },
        ]);

        expect(persons.map((person) => ({
            nameOld: person.children.name.old,
            colorOld: person.children.color.old,
            titleOld: person.children.title.old,
            nameRemoved: person.children.name.removed,
            colorRemoved: person.children.color.removed,
            titleRemoved: person.children.title.removed,
        }))).toEqual([
            { nameOld: false, colorOld: false, titleOld: false, nameRemoved: true, colorRemoved: true, titleRemoved: true },
            { nameOld: false, colorOld: false, titleOld: false, nameRemoved: true, colorRemoved: true, titleRemoved: true },
            { nameOld: false, colorOld: false, titleOld: false, nameRemoved: false, colorRemoved: false, titleRemoved: false },
        ]);

        expect(callback).toHaveBeenCalledTimes(1);
    });
});
