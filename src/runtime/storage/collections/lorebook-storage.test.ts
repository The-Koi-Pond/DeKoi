import { describe, expect, it } from "vitest";

import { normalizeLorebookRecord } from "./lorebook-storage";

describe("normalizeLorebookRecord", () => {
  it("normalizes v2 lorebooks with defaulted fields and clamped percentages", () => {
    const record = normalizeLorebookRecord({
      id: "lorebook-under-test",
      schemaVersion: 2,
      title: "Activation Contract",
      summary: "Validates v2 normalization.",
      activation: {
        budgetPercent: 500,
      },
      entries: [
        {
          id: "entry-under-test",
          schemaVersion: 2,
          title: "Defaulted Entry",
          body: "Entry body.",
          enabled: true,
          createdAt: "2026-06-24T07:00:00.000Z",
          updatedAt: "2026-06-24T07:00:00.000Z",
        },
      ],
      createdAt: "2026-06-24T07:00:00.000Z",
      updatedAt: "2026-06-24T07:00:00.000Z",
    });

    expect(record).toMatchObject({
      schemaVersion: 2,
      activation: {
        scanDepth: 2,
        includeNames: true,
        caseSensitiveKeys: false,
        matchWholeWords: true,
        recursiveScan: false,
        maxRecursionSteps: 0,
        budgetTokens: null,
        budgetPercent: 100,
      },
      entries: [
        {
          schemaVersion: 2,
          strategy: "constant",
          probability: 100,
          inclusionGroup: null,
          insertionPosition: "after-character",
          insertionOrder: 100,
          depth: null,
          role: null,
          key: null,
          keySecondary: null,
          selectiveLogic: null,
          recursion: null,
          timing: null,
          triggers: null,
          characterFilter: null,
          matchSources: null,
        },
      ],
    });
  });

  it("rejects pre-v2 development lorebook records", () => {
    expect(
      normalizeLorebookRecord({
        id: "legacy-lorebook",
        schemaVersion: 1,
        title: "Legacy",
        summary: "",
        entries: [],
      }),
    ).toBeNull();
  });

  it("filters malformed v2 entries without dropping valid sibling entries", () => {
    const record = normalizeLorebookRecord({
      id: "lorebook-under-test",
      schemaVersion: 2,
      title: "Activation Contract",
      summary: "",
      entries: [
        {
          id: "valid-entry",
          schemaVersion: 2,
          title: "Valid Entry",
          body: "This entry should survive.",
        },
        {
          id: "entry-without-title",
          schemaVersion: 2,
          title: "",
          body: "This entry should be filtered.",
        },
      ],
    });

    expect(record?.entries).toHaveLength(1);
    expect(record?.entries[0]?.id).toBe("valid-entry");
  });
});
