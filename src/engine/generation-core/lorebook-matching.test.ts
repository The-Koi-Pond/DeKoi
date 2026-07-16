import { describe, expect, it, vi } from "vitest";

import { buildScanBuffer, matchKey } from "./lorebook-matching";

describe("lorebook matching", () => {
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

    expect(buildScanBuffer(sources, { scanDepth: 1, includeNames: true })).toContain("SecretName");
    expect(buildScanBuffer(sources, { scanDepth: 1, includeNames: false })).not.toContain(
      "SecretName",
    );
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

  it("applies case-sensitivity defaults to regex keys without explicit flags", () => {
    expect(
      matchKey("/moon gate/", "MOON GATE", {
        caseSensitiveKeys: false,
        matchWholeWords: false,
      }),
    ).toBe(true);
    expect(
      matchKey("/moon gate/", "MOON GATE", {
        caseSensitiveKeys: true,
        matchWholeWords: false,
      }),
    ).toBe(false);
  });

  it("does not apply whole-word wrapping to regex keys", () => {
    expect(
      matchKey("/cat/", "catalog", {
        caseSensitiveKeys: false,
        matchWholeWords: true,
      }),
    ).toBe(true);
  });
});
