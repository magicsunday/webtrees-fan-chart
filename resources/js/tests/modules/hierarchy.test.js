import { jest } from "@jest/globals";

const { default: Hierarchy, SEX_FEMALE, SEX_MALE } = await import("resources/js/modules/hierarchy");

const createIndividual = ({ id = 1, generation = 1, sex = SEX_MALE, parents } = {}) => ({
    data: {
        xref: `I${id}`,
        url: `url-${id}`,
        updateUrl: `update-${id}`,
        generation,
        name: `Person ${id}`,
        firstNames: ["Person"],
        lastNames: ["Test"],
        preferredName: `Person ${id}`,
        alternativeName: "",
        isAltRtl: false,
        sex,
        timespan: "",
    },
    ...(parents ? { parents } : {}),
});

describe("Hierarchy.init", () => {
    test("adds missing parents with male and female placeholders until configured generations", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        const hierarchy = new Hierarchy({ generations: 3 });

        hierarchy.init(rootDatum);

        const children = hierarchy.root.children;
        const childGenerations = children.map((child) => child.data.data.generation);

        expect(children).toHaveLength(2);
        expect(children.map((child) => child.data.data.sex)).toEqual([SEX_MALE, SEX_FEMALE]);
        expect(childGenerations.every((generation) => generation === 2)).toBe(true);
        expect(hierarchy.nodes).toHaveLength(7);

        // Verify original datum was not mutated
        expect(rootDatum.parents).toBeUndefined();
    });

    test("completes single parent entries by adding the missing sex at the correct position", () => {
        const existingParent = createIndividual({ id: 2, generation: 2, sex: SEX_FEMALE });
        const rootDatum = createIndividual({
            id: 1,
            generation: 1,
            parents: [existingParent],
        });
        const hierarchy = new Hierarchy({ generations: 3 });

        hierarchy.init(rootDatum);

        const children = hierarchy.root.children;

        expect(children).toHaveLength(2);
        expect(children[0].data.data.sex).toBe(SEX_MALE);
        expect(children[0].data.data.generation).toBe(2);
        expect(children[1].data).toBe(existingParent);
    });

    test("stops generating parents when the configured generation depth is reached", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        const hierarchy = new Hierarchy({ generations: 2 });

        hierarchy.init(rootDatum);

        const children = hierarchy.root.children;

        expect(children).toHaveLength(2);
        expect(children.every((child) => child.data.data.generation === 2)).toBe(true);
        // A leaf of a d3 hierarchy has no children property at all
        expect(children.every((child) => child.children === undefined)).toBe(true);
        expect(hierarchy.nodes).toHaveLength(3);
    });

    test("treats an empty parents array like a missing one", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1, parents: [] });
        const hierarchy = new Hierarchy({ generations: 3 });

        hierarchy.init(rootDatum);

        const children = hierarchy.root.children;

        expect(children).toHaveLength(2);
        expect(children.map((child) => child.data.data.sex)).toEqual([SEX_MALE, SEX_FEMALE]);
        expect(hierarchy.nodes).toHaveLength(7);
        expect(rootDatum.parents).toEqual([]);
    });

    test("keeps a person with an empty parents array a leaf at the generation limit", () => {
        const rootDatum = createIndividual({ id: 1, generation: 2, parents: [] });
        const hierarchy = new Hierarchy({ generations: 2 });

        hierarchy.init(rootDatum);

        // A leaf of a d3 hierarchy has no children property at all
        expect(hierarchy.root.children).toBeUndefined();
        expect(hierarchy.nodes).toHaveLength(1);
    });

    test("gives every ancestor slot of a generation the same share of the circle", () => {
        const hierarchy = new Hierarchy({ generations: 3 });

        hierarchy.init(createIndividual({ id: 1, generation: 1 }));

        const [father, mother] = hierarchy.root.children;
        const grandparents = [...father.children, ...mother.children];

        // The circle is one unit wide. The root spans all of it, each parent half of it and each
        // grandparent a quarter of it, in the order father, mother, father's parents, mother's parents.
        expect([hierarchy.root.x0, hierarchy.root.x1]).toEqual([0, 1]);
        expect([father.x0, father.x1]).toEqual([0, 0.5]);
        expect([mother.x0, mother.x1]).toEqual([0.5, 1]);
        expect(grandparents.map((node) => [node.x0, node.x1])).toEqual([
            [0, 0.25],
            [0.25, 0.5],
            [0.5, 0.75],
            [0.75, 1],
        ]);
    });

    test("assigns unique numeric identifiers to all nodes", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        const hierarchy = new Hierarchy({ generations: 3 });

        hierarchy.init(rootDatum);

        const ids = hierarchy.nodes.map((node) => node.id);

        expect(ids.every((id) => typeof id === "number")).toBe(true);
        expect(new Set(ids).size).toBe(hierarchy.nodes.length);
        expect(ids).toEqual(ids.map((_, index) => index));
    });
});

describe("Hierarchy accessors", () => {
    test("throws when an accessor is read before init() has been called", () => {
        const hierarchy = new Hierarchy({ generations: 3 });

        expect(() => hierarchy.nodes).toThrow(
            "Hierarchy.nodes is not available before init() has been called",
        );
    });
});

describe("Hierarchy.initDescendants", () => {
    const createPartner = ({
        xref = "I2",
        name = "Partner",
        sex = SEX_FEMALE,
        children = [],
    } = {}) => ({
        data: {
            xref,
            url: `url-${xref}`,
            updateUrl: `update-${xref}`,
            generation: -1,
            name,
            firstNames: [name],
            lastNames: ["Test"],
            preferredName: name,
            alternativeName: "",
            isAltRtl: false,
            sex,
            timespan: "",
        },
        ...(children.length > 0 ? { children } : {}),
    });

    const createChild = ({ xref = "I3", name = "Child", sex = SEX_MALE } = {}) => ({
        data: {
            xref,
            url: `url-${xref}`,
            updateUrl: `update-${xref}`,
            generation: -2,
            name,
            firstNames: [name],
            lastNames: ["Test"],
            preferredName: name,
            alternativeName: "",
            isAltRtl: false,
            sex,
            timespan: "",
        },
    });

    test("does nothing when showDescendants is false", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [createPartner()];
        const config = { generations: 2, showDescendants: false, fanDegree: 210 };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        const descNodes = hierarchy.nodes.filter((n) => n.depth < 0);

        expect(descNodes).toHaveLength(0);
        expect(hierarchy.descendantLayout.childScale).toBeNull();
    });

    test("creates partner and children nodes when showDescendants is true", () => {
        const child1 = createChild({ xref: "I10", name: "Child 1" });
        const child2 = createChild({ xref: "I11", name: "Child 2" });
        const partner = createPartner({ xref: "I2", children: [child1, child2] });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [partner];
        const config = { generations: 2, showDescendants: true, fanDegree: 210 };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        const descNodes = hierarchy.nodes.filter((n) => n.depth < 0);

        expect(descNodes).toHaveLength(3);
        expect(descNodes.filter((n) => n.depth === -1)).toHaveLength(1);
        expect(descNodes.filter((n) => n.depth === -2)).toHaveLength(2);
        expect(hierarchy.descendantLayout.childScale).not.toBeNull();
    });

    test("descendant nodes use sequential integer IDs continuing from ancestors", () => {
        const child = createChild({ xref: "I10" });
        const partner = createPartner({ xref: "I2", children: [child] });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [partner];
        const config = { generations: 2, showDescendants: true, fanDegree: 210 };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        // 2 generations = 3 ancestor nodes (IDs 0-2), descendants start at 3
        const partnerNode = hierarchy.nodes.find((n) => n.depth === -1);
        const childNode = hierarchy.nodes.find((n) => n.depth === -2);

        expect(partnerNode.id).toBe(3);
        expect(childNode.id).toBe(4);
    });

    test("children are equally spaced within their partner block", () => {
        const children = [
            createChild({ xref: "I10" }),
            createChild({ xref: "I11" }),
            createChild({ xref: "I12" }),
        ];
        const partner = createPartner({ xref: "I2", children });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [partner];
        const config = { generations: 2, showDescendants: true, fanDegree: 210 };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        const childNodes = hierarchy.nodes.filter((n) => n.depth === -2);
        const widths = childNodes.map((n) => n.x1 - n.x0);

        expect(childNodes).toHaveLength(3);
        expect(widths[0]).toBeCloseTo(widths[1], 10);
        expect(widths[1]).toBeCloseTo(widths[2], 10);
    });

    test("multiple partners get weighted angle distribution", () => {
        const partner1 = createPartner({
            xref: "I2",
            children: [
                createChild({ xref: "I10" }),
                createChild({ xref: "I11" }),
                createChild({ xref: "I12" }),
            ],
        });
        const partner2 = createPartner({ xref: "I3", sex: SEX_FEMALE });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [partner1, partner2];
        const config = { generations: 2, showDescendants: true, fanDegree: 210 };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        // Find partners by xref (order is reversed for left-to-right chronology)
        const p1 = hierarchy.nodes.find((n) => n.depth === -1 && n.data.data.xref === "I2");
        const p2 = hierarchy.nodes.find((n) => n.depth === -1 && n.data.data.xref === "I3");

        // partner1 has 3 children (weight=3), partner2 has 0 (weight=1), total=4
        expect(p1.x1 - p1.x0).toBeCloseTo(0.75, 10);
        expect(p2.x1 - p2.x0).toBeCloseTo(0.25, 10);
    });

    test("unassigned children get their own angle block", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.unassignedChildren = [createChild({ xref: "I20" }), createChild({ xref: "I21" })];
        const config = { generations: 2, showDescendants: true, fanDegree: 210 };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        const descNodes = hierarchy.nodes.filter((n) => n.depth < 0);

        expect(descNodes).toHaveLength(2);
        expect(descNodes.every((n) => n.depth === -2)).toBe(true);
        expect(descNodes[0].x0).toBe(0);
        expect(descNodes[1].x1).toBeCloseTo(1, 10);
    });

    test("clears childScale and smallestChildFraction when no descendants exist", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        const config = { generations: 2, showDescendants: true, fanDegree: 210 };
        const hierarchy = new Hierarchy(config);

        hierarchy.descendantLayout.childScale = "stale";
        hierarchy.descendantLayout.smallestChildFraction = 0.05;
        hierarchy.descendantLayout.compactChildren = true;

        hierarchy.init(rootDatum);

        // Both descendant layout results must be cleared together: a stale
        // fraction surviving an update would cap the font of a later chart
        // against a sector that is no longer rendered.
        expect(hierarchy.descendantLayout.childScale).toBeNull();
        expect(hierarchy.descendantLayout.smallestChildFraction).toBe(0);
        expect(hierarchy.descendantLayout.compactChildren).toBe(false);
    });

    test.each([
        ["a few children get arcs wide enough for places", 2, false],
        ["the widest crowd that still fits the places", 6, false],
        ["more children than the sector holds at the minimum arc width", 7, true],
    ])(
        "marks the children compact only when the arcs are too narrow: %s",
        (_label, count, expected) => {
            const children = Array.from({ length: count }, (_, index) =>
                createChild({ xref: `I${100 + index}` }),
            );
            const rootDatum = createIndividual({ id: 1, generation: 1 });
            rootDatum.partners = [createPartner({ xref: "I2", children })];
            const hierarchy = new Hierarchy({
                generations: 2,
                showDescendants: true,
                fanDegree: 210,
            });

            hierarchy.init(rootDatum);

            expect(hierarchy.descendantLayout.compactChildren).toBe(expected);
        },
    );

    test("resets the compact flag when a later init has fewer children", () => {
        const crowd = Array.from({ length: 7 }, (_, index) =>
            createChild({ xref: `I${100 + index}` }),
        );
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [createPartner({ xref: "I2", children: crowd })];
        const hierarchy = new Hierarchy({ generations: 2, showDescendants: true, fanDegree: 210 });

        hierarchy.init(rootDatum);
        rootDatum.partners = [createPartner({ xref: "I2", children: [crowd[0]] })];
        hierarchy.init(rootDatum);

        expect(hierarchy.descendantLayout.compactChildren).toBe(false);
    });

    test("keeps the same descendant layout object across later init calls", () => {
        const child = createChild({ xref: "I10" });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [createPartner({ xref: "I2", children: [child] })];
        const hierarchy = new Hierarchy({ generations: 2, showDescendants: true, fanDegree: 210 });
        const layout = hierarchy.descendantLayout;

        hierarchy.init(rootDatum);
        const scaleAfterFirstInit = layout.childScale;
        hierarchy.init(rootDatum);

        // A geometry created before the second init holds this very object, so
        // the hierarchy must rewrite it in place instead of replacing it.
        expect(hierarchy.descendantLayout).toBe(layout);
        expect(scaleAfterFirstInit).not.toBeNull();
        expect(layout.childScale).not.toBeNull();
        expect(layout.childScale).not.toBe(scaleAfterFirstInit);
    });

    test("keeps the configuration free of descendant layout results", () => {
        const child = createChild({ xref: "I10" });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [createPartner({ xref: "I2", children: [child] })];
        const config = { generations: 2, showDescendants: true, fanDegree: 210 };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        expect(config).toEqual({ generations: 2, showDescendants: true, fanDegree: 210 });
        expect(hierarchy.descendantLayout.smallestChildFraction).toBeGreaterThan(0);
    });
});
