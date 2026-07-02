import { describe, expect, it, vi } from "vitest";

import {
  activateLorebookEntries,
  buildScanBuffer,
  matchKey,
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
});
