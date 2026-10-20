import { createAlternativeNamesData, createNamesData } from "resources/js/modules/svg/name-parts";

const createDatum = (overrides = {}) => ({
    data: {
        data: {
            name: "Jane Marie Doe",
            firstNames: ["Jane", "Marie"],
            lastNames: ["Doe"],
            preferredName: "Marie",
            alternativeName: "",
            isNameRtl: false,
            isAltRtl: false,
            ...overrides,
        },
    },
});

describe("createNamesData", () => {
    it("splits full names into ordered label groups", () => {
        const [firstNames, lastNames] = createNamesData(createDatum());

        expect(firstNames).toEqual([
            { label: "Jane", isPreferred: false, isLastName: false, isNameRtl: false },
            { label: "Marie", isPreferred: true, isLastName: false, isNameRtl: false },
        ]);
        expect(lastNames).toEqual([
            { label: "Doe", isPreferred: false, isLastName: true, isNameRtl: false },
        ]);
    });

    it("orders the groups by their position in the full name", () => {
        const groups = createNamesData(
            createDatum({
                name: "Doe Jane",
                firstNames: ["Jane"],
                lastNames: ["Doe"],
                preferredName: "Jane",
            }),
        );

        expect(groups.map((group) => group.map((part) => part.label))).toEqual([["Doe"], ["Jane"]]);
    });

    it("keeps the nickname inside the first name group, after the given names", () => {
        const [firstNames] = createNamesData(
            createDatum({
                name: 'Jane "Chalky" Doe',
                firstNames: ["Jane"],
                lastNames: ["Doe"],
                preferredName: "Jane",
                nickname: "Chalky",
            }),
        );

        expect(firstNames).toEqual([
            { label: "Jane", isPreferred: true, isLastName: false, isNameRtl: false },
            {
                label: '"Chalky"',
                isPreferred: false,
                isLastName: false,
                isNickname: true,
                isNameRtl: false,
            },
        ]);
    });

    it("ignores a nickname that does not occur in the full name", () => {
        const [firstNames] = createNamesData(createDatum({ nickname: "Chalky" }));

        expect(firstNames.map((part) => part.label)).toEqual(["Jane", "Marie"]);
    });

    it("finds the surname behind an equal given name", () => {
        const groups = createNamesData(
            createDatum({
                name: "Marie Marie",
                firstNames: ["Marie"],
                lastNames: ["Marie"],
                preferredName: "Marie",
            }),
        );
        const [firstNames, lastNames] = groups;

        expect(firstNames?.map((part) => part.isLastName)).toEqual([false]);
        expect(lastNames?.map((part) => part.isLastName)).toEqual([true]);
    });

    it("carries the right-to-left flag of the name into every part", () => {
        const groups = createNamesData(createDatum({ isNameRtl: true }));

        expect(groups.flat().every((part) => part.isNameRtl === true)).toBe(true);
    });
});

describe("createAlternativeNamesData", () => {
    it("splits the alternative name into one part per word", () => {
        expect(
            createAlternativeNamesData(createDatum({ alternativeName: "Jana van Doe" })),
        ).toEqual([
            { label: "Jana", isPreferred: false, isLastName: false, isNameRtl: false },
            { label: "van", isPreferred: false, isLastName: false, isNameRtl: false },
            { label: "Doe", isPreferred: false, isLastName: false, isNameRtl: false },
        ]);
    });

    it("marks every part with the right-to-left flag of the alternative name", () => {
        const parts = createAlternativeNamesData(
            createDatum({ alternativeName: "Jana Doe", isAltRtl: true, isNameRtl: false }),
        );

        expect(parts.every((part) => part.isNameRtl === true)).toBe(true);
    });
});
