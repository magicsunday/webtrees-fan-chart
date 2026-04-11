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

await jest.unstable_mockModule("resources/js/modules/lib/d3", () => ({
    __esModule: true,
    hierarchy: hierarchyMock,
    partition: partitionMock
}));

const { default: Hierarchy, SEX_FEMALE, SEX_MALE } = await import("resources/js/modules/custom/hierarchy");

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
