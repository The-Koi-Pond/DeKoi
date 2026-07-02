import { describe, expect, it, vi } from "vitest";

import {
  activateLorebookEntries,
  applyTokenBudget,
  buildScanBuffer,
  matchKey,
  sortActivatedEntries,
} from "./lorebook-activation";
import {
  createLorebookEntryRecord,
  createLorebookRecord,
} from "../catalog/lorebook-actions";
import type { LorebookRecord } from "../contracts/types/lorebook";

const now = "2026-07-02T00:00:00.000Z";

function lorebook(entries: LorebookRecord["entries"], activation = {}) {
  return {
    ...createLorebookRecord({
      id: "lorebook-under-test",
      input: {
        title: "Activation Lore",
        activation,
      },
      now,
    }),
    entries,
  };
}

function entry(
  input: Partial<Parameters<typeof createLorebookEntryRecord>[0]["input"]>,
) {
  return createLorebookEntryRecord({
    id: input.title ?? "entry-under-test",
    input: {
      title: input.title ?? "Entry",
      body: input.body ?? "Entry body.",
      ...input,
    },
    now,
  });
}

describe("lorebook activation", () => {
  it("activates enabled constant entries with non-empty bodies", () => {
    const active = entry({ title: "Constant", strategy: "constant" });
    const empty = entry({ title: "Empty", strategy: "constant", body: "" });

    const activated = activateLorebookEntries(lorebook([active, empty]), "");

    expect(activated.map((item) => item.entry)).toEqual([active]);
    expect(activated).toMatchObject([
      {
        lorebookId: "lorebook-under-test",
        lorebookTitle: "Activation Lore",
        matchReason: "constant",
        matchedKey: null,
      },
    ]);
  });

  it("keeps selective entries with null or empty primary keys inactive", () => {
    const noKey = entry({ title: "No Key", strategy: "selective", key: null });
    const emptyKey = entry({
      title: "Empty Key",
      strategy: "selective",
      key: ["  "],
    });

    expect(activateLorebookEntries(lorebook([noKey, emptyKey]), "No Key")).toEqual(
      [],
    );
  });

  it("activates selective entries when any plaintext primary key is present", () => {
    const present = entry({
      title: "Present",
      strategy: "selective",
      key: ["missing", "moon gate"],
    });
    const absent = entry({
      title: "Absent",
      strategy: "selective",
      key: ["sun gate"],
    });

    const activated = activateLorebookEntries(
      lorebook([present, absent]),
      "Open the moon gate.",
    );

    expect(activated.map((item) => item.entry)).toEqual([present]);
    expect(activated[0]).toMatchObject({
      matchReason: "primary-key",
      matchedKey: "moon gate",
    });
  });

  it("skips disabled entries", () => {
    const disabled = entry({
      title: "Disabled",
      strategy: "constant",
      enabled: false,
    });

    expect(activateLorebookEntries(lorebook([disabled]), "Disabled")).toEqual([]);
  });

  it("builds a scan buffer from only the last N sources", () => {
    const buffer = buildScanBuffer(
      [
        { name: "A", body: "first" },
        { name: "B", body: "second" },
        { name: "C", body: "third" },
      ],
      { scanDepth: 2, includeNames: true },
    );

    expect(buffer).toBe("B: second\nC: third");
  });

  it("drops empty-body sources before applying scan depth", () => {
    const buffer = buildScanBuffer(
      [
        { name: "Alex", body: "open the moon gate" },
        { name: "Moon Gate", body: "   " },
      ],
      { scanDepth: 1, includeNames: true },
    );

    expect(buffer).toBe("Alex: open the moon gate");
  });

  it("includes or excludes names from the scan buffer", () => {
    const sources = [{ name: "SecretName", body: "ordinary body" }];

    expect(
      buildScanBuffer(sources, { scanDepth: 1, includeNames: true }),
    ).toContain("SecretName");
    expect(
      buildScanBuffer(sources, { scanDepth: 1, includeNames: false }),
    ).not.toContain("SecretName");
  });

  it("matches whole words separately from substrings", () => {
    expect(
      matchKey("cat", "A cat appears.", {
        caseSensitiveKeys: false,
        matchWholeWords: true,
      }),
    ).toBe(true);
    expect(
      matchKey("cat", "The catalog opens.", {
        caseSensitiveKeys: false,
        matchWholeWords: true,
      }),
    ).toBe(false);
    expect(
      matchKey("cat", "The catalog opens.", {
        caseSensitiveKeys: false,
        matchWholeWords: false,
      }),
    ).toBe(true);
  });

  it("respects case-sensitive matching", () => {
    expect(
      matchKey("moon gate", "Moon Gate", {
        caseSensitiveKeys: true,
        matchWholeWords: false,
      }),
    ).toBe(false);
    expect(
      matchKey("moon gate", "Moon Gate", {
        caseSensitiveKeys: false,
        matchWholeWords: false,
      }),
    ).toBe(true);
  });

  it("uses locale-independent lowercasing for case-insensitive keys", () => {
    const localeLowerSpy = vi
      .spyOn(String.prototype, "toLocaleLowerCase")
      .mockImplementation(() => {
        throw new Error("locale-sensitive lowercasing used");
      });
    const matched = (() => {
      try {
        return matchKey("IRIS", "iris blooms", {
          caseSensitiveKeys: false,
          matchWholeWords: true,
        });
      } finally {
        localeLowerSpy.mockRestore();
      }
    })();

    expect(matched).toBe(true);
  });

  it("treats regex-like keys as deferred non-matches", () => {
    expect(
      matchKey("/moon gate/i", "moon gate", {
        caseSensitiveKeys: false,
        matchWholeWords: false,
      }),
    ).toBe(false);
  });

  it("sorts activated entries by insertion order with stable source tiebreaks", () => {
    const low = entry({
      title: "Low",
      strategy: "constant",
      insertionOrder: 10,
    });
    const tiedFirst = entry({
      title: "Tied First",
      strategy: "constant",
      insertionOrder: 50,
    });
    const tiedSecond = entry({
      title: "Tied Second",
      strategy: "constant",
      insertionOrder: 50,
    });
    const highOtherSource = entry({
      title: "High Other Source",
      strategy: "constant",
      insertionOrder: 100,
    });
    const firstLorebookEntries = activateLorebookEntries(
      lorebook([low, tiedFirst, tiedSecond]),
      "",
      { sourceOrder: 0 },
    );
    const secondLorebookEntries = activateLorebookEntries(
      lorebook([highOtherSource]),
      "",
      { sourceOrder: 1 },
    );

    expect(
      sortActivatedEntries([
        ...firstLorebookEntries,
        ...secondLorebookEntries,
      ]).map((item) => item.entry.title),
    ).toEqual(["High Other Source", "Tied First", "Tied Second", "Low"]);
  });

  it("lets constant entries outrank selective entries when applying token budgets", () => {
    const constant = entry({
      title: "Constant",
      strategy: "constant",
      insertionOrder: 0,
    });
    const high = entry({
      title: "High",
      strategy: "selective",
      key: ["gate"],
      insertionOrder: 30,
    });
    const medium = entry({
      title: "Medium",
      strategy: "selective",
      key: ["gate"],
      insertionOrder: 20,
    });
    const low = entry({
      title: "Low",
      strategy: "selective",
      key: ["gate"],
      insertionOrder: 10,
    });
    const oversized = entry({
      title: "Oversized",
      strategy: "selective",
      key: ["gate"],
      insertionOrder: 40,
    });
    const activated = activateLorebookEntries(
      lorebook([low, constant, medium, high, oversized]),
      "gate",
    );

    const budgeted = applyTokenBudget(activated, {
      budgetTokens: 3,
      approxTokens: (item) => (item.entry.title === "Oversized" ? 4 : 1),
    });

    expect(budgeted.map((item) => item.entry.title)).toEqual([
      "High",
      "Medium",
      "Constant",
    ]);
  });

  it("uses constant-first budget priority for percent budgets after context resolution", () => {
    const constant = entry({
      title: "Constant",
      strategy: "constant",
      insertionOrder: 0,
    });
    const high = entry({
      title: "High",
      strategy: "selective",
      key: ["gate"],
      insertionOrder: 50,
    });
    const activated = activateLorebookEntries(
      lorebook([high, constant], { budgetPercent: 50 }),
      "gate",
    );

    const budgeted = applyTokenBudget(activated, {
      budgetPercent: 50,
      contextTokens: 2,
      approxTokens: () => 1,
    });

    expect(budgeted.map((item) => item.entry.title)).toEqual(["Constant"]);
  });

  it("uses source and entry order tiebreaks within budget priority groups", () => {
    const secondSource = entry({
      title: "Second Source",
      strategy: "constant",
      insertionOrder: 10,
    });
    const firstEntry = entry({
      title: "First Entry",
      strategy: "constant",
      insertionOrder: 10,
    });
    const secondEntry = entry({
      title: "Second Entry",
      strategy: "constant",
      insertionOrder: 10,
    });
    const firstLorebookEntries = activateLorebookEntries(
      lorebook([firstEntry, secondEntry]),
      "",
      { sourceOrder: 0 },
    );
    const secondLorebookEntries = activateLorebookEntries(
      lorebook([secondSource]),
      "",
      { sourceOrder: 1 },
    );

    const budgeted = applyTokenBudget(
      [...secondLorebookEntries, ...firstLorebookEntries],
      {
        budgetTokens: 2,
        approxTokens: () => 1,
      },
    );

    expect(budgeted.map((item) => item.entry.title)).toEqual([
      "First Entry",
      "Second Entry",
    ]);
  });

  it("derives percent budgets from context tokens and leaves entries alone without context", () => {
    const first = entry({
      title: "First",
      strategy: "constant",
      insertionOrder: 20,
    });
    const second = entry({
      title: "Second",
      strategy: "constant",
      insertionOrder: 10,
    });
    const activated = activateLorebookEntries(lorebook([first, second]), "");

    expect(
      applyTokenBudget(activated, {
        budgetPercent: 50,
        contextTokens: 2,
        approxTokens: () => 1,
      }).map((item) => item.entry.title),
    ).toEqual(["First"]);
    expect(
      applyTokenBudget(activated, {
        budgetPercent: 50,
        contextTokens: null,
        approxTokens: () => 100,
      }).map((item) => item.entry.title),
    ).toEqual(["First", "Second"]);
  });

  it("counts reserved prompt text against the token budget", () => {
    const first = entry({
      title: "First",
      strategy: "constant",
      insertionOrder: 20,
    });
    const second = entry({
      title: "Second",
      strategy: "constant",
      insertionOrder: 10,
    });
    const activated = activateLorebookEntries(lorebook([first, second]), "");

    expect(
      applyTokenBudget(activated, {
        budgetTokens: 2,
        reservedTokens: 1,
        approxTokens: () => 1,
      }).map((item) => item.entry.title),
    ).toEqual(["First"]);
  });
});
