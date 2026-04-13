import { jest } from "@jest/globals";

const hierarchyMock = jest.fn((datum, childrenAccessor) => {
    const buildNode = (value, parent = null) => {
        const node = {
            data    : value,
            parent,
            children: []
        };
        const children = typeof childrenAccessor === "function"
            ? childrenAccessor(value) || []
            : [];

        node.children = children.map((child) => buildNode(child, node));

        return node;
    };

    const root = buildNode(datum);

    root.count = jest.fn(() => root);

    root.descendants = () => {
        const nodes = [];
        const visit = (node) => {
            nodes.push(node);
            node.children.forEach(visit);
        };

        visit(root);

        return nodes;
    };

    return root;
});

const partitionMock = jest.fn(() => (root) => root);

const scaleLinearMock = jest.fn(() => {
    let _domain = [0, 1];
    let _range = [0, 1];

    const scale = (value) => {
        const t = (value - _domain[0]) / (_domain[1] - _domain[0]);
        return _range[0] + t * (_range[1] - _range[0]);
    };

    scale.domain = (d) => { _domain = d; return scale; };
    scale.range = (r) => { _range = r; return scale; };

    return scale;
});

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    hierarchy: hierarchyMock,
    partition: partitionMock,
    scaleLinear: scaleLinearMock,
}));

const { default: Hierarchy, SEX_FEMALE, SEX_MALE, DESCENDANT_GAP_DEG } = await import("resources/js/modules/custom/hierarchy");

const createIndividual = ({ id = 1, generation = 1, sex = SEX_MALE, parents } = {}) => ({
    data: {
        id,
        xref           : `I${id}`,
        url            : `url-${id}`,
        updateUrl      : `update-${id}`,
        generation,
        name           : `Person ${id}`,
        firstNames     : ["Person"],
        lastNames      : ["Test"],
        preferredName  : `Person ${id}`,
        alternativeName: "",
        isAltRtl       : false,
        sex,
        timespan       : ""
    },
    ...(parents ? { parents } : {})
});

describe("Hierarchy.init", () => {
    beforeEach(() => {
        hierarchyMock.mockClear();
        partitionMock.mockClear();
    });

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
            id       : 1,
            generation: 1,
            parents  : [existingParent]
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
        expect(children.every((child) => child.children.length === 0)).toBe(true);
        expect(hierarchy.nodes).toHaveLength(3);
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

describe("Hierarchy.initDescendants", () => {
    const createPartner = ({ xref = "I2", name = "Partner", sex = SEX_FEMALE, children = [] } = {}) => ({
        data: {
            id: 2, xref, url: `url-${xref}`, updateUrl: `update-${xref}`,
            generation: -1, name, firstNames: [name], lastNames: ["Test"],
            preferredName: name, alternativeName: "", isAltRtl: false,
            sex, timespan: "",
        },
        ...(children.length > 0 ? { children } : {}),
    });

    const createChild = ({ xref = "I3", name = "Child", sex = SEX_MALE } = {}) => ({
        data: {
            id: 3, xref, url: `url-${xref}`, updateUrl: `update-${xref}`,
            generation: -2, name, firstNames: [name], lastNames: ["Test"],
            preferredName: name, alternativeName: "", isAltRtl: false,
            sex, timespan: "",
        },
    });

    beforeEach(() => {
        hierarchyMock.mockClear();
        partitionMock.mockClear();
        scaleLinearMock.mockClear();
    });

    test("does nothing when showDescendants is false", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [createPartner()];
        const config = { generations: 2, showDescendants: false, fanDegree: 210, childScale: null };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        const descNodes = hierarchy.nodes.filter((n) => n.depth < 0);

        expect(descNodes).toHaveLength(0);
        expect(config.childScale).toBeNull();
    });

    test("creates partner and children nodes when showDescendants is true", () => {
        const child1 = createChild({ xref: "I10", name: "Child 1" });
        const child2 = createChild({ xref: "I11", name: "Child 2" });
        const partner = createPartner({ xref: "I2", children: [child1, child2] });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [partner];
        const config = { generations: 2, showDescendants: true, fanDegree: 210, childScale: null };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        const descNodes = hierarchy.nodes.filter((n) => n.depth < 0);

        expect(descNodes).toHaveLength(3);
        expect(descNodes.filter((n) => n.depth === -1)).toHaveLength(1);
        expect(descNodes.filter((n) => n.depth === -2)).toHaveLength(2);
        expect(config.childScale).not.toBeNull();
    });

    test("descendant nodes use sequential integer IDs continuing from ancestors", () => {
        const child = createChild({ xref: "I10" });
        const partner = createPartner({ xref: "I2", children: [child] });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [partner];
        const config = { generations: 2, showDescendants: true, fanDegree: 210, childScale: null };
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
        const config = { generations: 2, showDescendants: true, fanDegree: 210, childScale: null };
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
            children: [createChild({ xref: "I10" }), createChild({ xref: "I11" }), createChild({ xref: "I12" })],
        });
        const partner2 = createPartner({ xref: "I3", sex: SEX_FEMALE });
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.partners = [partner1, partner2];
        const config = { generations: 2, showDescendants: true, fanDegree: 210, childScale: null };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        // 2 generations = 3 ancestor nodes (IDs 0-2), partner1 = 3, partner2 = 7
        // (3 children of partner1 at IDs 4-6, then partner2 at 7)
        const p1 = hierarchy.nodes.find((n) => n.depth === -1 && n.id === 3);
        const p2 = hierarchy.nodes.find((n) => n.depth === -1 && n.id === 7);

        // partner1 has 3 children (weight=3), partner2 has 0 (weight=1), total=4
        expect(p1.x1 - p1.x0).toBeCloseTo(0.75, 10);
        expect(p2.x1 - p2.x0).toBeCloseTo(0.25, 10);
    });

    test("unassigned children get their own angle block", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        rootDatum.unassignedChildren = [
            createChild({ xref: "I20" }),
            createChild({ xref: "I21" }),
        ];
        const config = { generations: 2, showDescendants: true, fanDegree: 210, childScale: null };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        const descNodes = hierarchy.nodes.filter((n) => n.depth < 0);

        expect(descNodes).toHaveLength(2);
        expect(descNodes.every((n) => n.depth === -2)).toBe(true);
        expect(descNodes[0].x0).toBe(0);
        expect(descNodes[1].x1).toBeCloseTo(1, 10);
    });

    test("sets childScale to null when no descendants exist", () => {
        const rootDatum = createIndividual({ id: 1, generation: 1 });
        const config = { generations: 2, showDescendants: true, fanDegree: 210, childScale: "stale" };
        const hierarchy = new Hierarchy(config);

        hierarchy.init(rootDatum);

        expect(config.childScale).toBeNull();
    });
});

describe("DESCENDANT_GAP_DEG constant", () => {
    test("is exported as a number", () => {
        expect(typeof DESCENDANT_GAP_DEG).toBe("number");
    });

    test("equals 10 degrees", () => {
        expect(DESCENDANT_GAP_DEG).toBe(10);
    });
});
