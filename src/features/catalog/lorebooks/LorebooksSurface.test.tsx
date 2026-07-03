import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createLorebookRecord } from "../../../engine/catalog/lorebook-actions";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import {
  DEFAULT_LORE_ENTRY_RECURSION,
  resolveEntryRecursion,
} from "../../../engine/contracts/types/lorebook";
import {
  canSaveLorebookEntryDraft,
  EMPTY_LORE_MATCH_SOURCES,
  entryDraftDisablesBannerSave,
  lorebookEntryDraftToInput,
  normalizeLoreMatchSources,
  parseLorebookEntryKeys,
  readNullableNonNegativeIntegerInput,
  readNullablePercentInput,
  readPercentInput,
  type LorebookEntryDraft,
} from "./lorebook-entry-draft";
import { LorebooksSurface, type LorebooksSurfaceNav } from "./LorebooksSurface";
import { readScanDepthInput } from "./lorebook-scan-depth";

const now = "2026-07-02T00:00:00.000Z";

describe("readScanDepthInput", () => {
  it("treats blank scan-depth drafts as invalid", () => {
    expect(readScanDepthInput("", 2)).toBe(2);
    expect(readScanDepthInput("   ", 3)).toBe(3);
  });

  it("normalizes finite non-negative integer scan depths", () => {
    expect(readScanDepthInput("4.9", 2)).toBe(4);
    expect(readScanDepthInput("-1", 2)).toBe(0);
    expect(readScanDepthInput("Infinity", 2)).toBe(2);
  });
});

const baseDraft: LorebookEntryDraft = {
  title: "Entry",
  body: "Body",
  enabled: true,
  strategy: "constant",
  key: "",
  keySecondary: "",
  selectiveLogic: "and-any",
  probability: "100",
  inclusionGroup: "",
  groupWeight: "100",
  prioritizeInclusion: false,
  insertionOrder: "100",
  insertionPosition: "after-character",
  depth: "0",
  role: "system",
  nonRecursable: DEFAULT_LORE_ENTRY_RECURSION.nonRecursable,
  preventFurther: DEFAULT_LORE_ENTRY_RECURSION.preventFurther,
  delayUntilRecursion: DEFAULT_LORE_ENTRY_RECURSION.delayUntilRecursion,
  recursionLevel: String(DEFAULT_LORE_ENTRY_RECURSION.recursionLevel),
  matchSources: EMPTY_LORE_MATCH_SOURCES,
};

function surfaceNav(overrides: Partial<LorebooksSurfaceNav> = {}): LorebooksSurfaceNav {
  const lorebook = createLorebookRecord({
    id: "lorebook-1",
    input: { title: "World Notes" },
    now,
  });

  return {
    lorebooks: [lorebook],
    appSettings: DEFAULT_APP_SETTINGS,
    view: { kind: "lorebooks", lorebookId: lorebook.id },
    createLorebook: (input) =>
      createLorebookRecord({
        id: "created-lorebook",
        input,
        now,
      }),
    createLorebookEntry: () => null,
    deleteLorebook: () => {},
    deleteLorebookEntry: () => {},
    duplicateLorebookEntry: () => null,
    setView: () => {},
    updateLorebook: () => {},
    updateLorebookEntry: () => {},
    ...overrides,
  };
}

describe("lorebook entry draft helpers", () => {
  it("rejects selective drafts without parsed keys", () => {
    expect(
      canSaveLorebookEntryDraft({
        ...baseDraft,
        strategy: "selective",
        key: "",
      }),
    ).toBe(false);
    expect(
      canSaveLorebookEntryDraft({
        ...baseDraft,
        strategy: "selective",
        key: " , , ",
      }),
    ).toBe(false);
  });

  it("allows constants without keys and selective drafts with parsed keys", () => {
    expect(canSaveLorebookEntryDraft(baseDraft)).toBe(true);
    expect(
      canSaveLorebookEntryDraft({
        ...baseDraft,
        strategy: "selective",
        key: "canal",
      }),
    ).toBe(true);
  });

  it("parses comma-separated keys before persistence", () => {
    expect(parseLorebookEntryKeys(" canal,  tower ,, ")).toEqual(["canal", "tower"]);
    expect(parseLorebookEntryKeys(" /wolf{2,3}/i, canal ")).toEqual(["/wolf{2,3}/i", "canal"]);
    expect(parseLorebookEntryKeys(" /amber,bell/, tower ")).toEqual(["/amber,bell/", "tower"]);
    expect(parseLorebookEntryKeys(" /route, canal ")).toEqual(["/route", "canal"]);
    expect(parseLorebookEntryKeys(" /route, canal, /wolf/ ")).toEqual([
      "/route",
      "canal",
      "/wolf/",
    ]);
    expect(parseLorebookEntryKeys(" /route, canal, /wolf ")).toEqual(["/route", "canal", "/wolf"]);
    expect(parseLorebookEntryKeys(" /route, canal, /wolf/q ")).toEqual([
      "/route",
      "canal",
      "/wolf/q",
    ]);
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        strategy: "selective",
        key: "canal",
      }),
    ).toMatchObject({
      strategy: "selective",
      key: ["canal"],
    });
  });

  it("serializes optional filters and clears stale selective logic", () => {
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        keySecondary: "amber,  violet ,, ",
        selectiveLogic: "and-all",
      }),
    ).toMatchObject({
      keySecondary: ["amber", "violet"],
      selectiveLogic: "and-all",
    });
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        keySecondary: " , , ",
        selectiveLogic: "not-any",
      }),
    ).toMatchObject({
      keySecondary: null,
      selectiveLogic: null,
    });
  });

  it("serializes insertion order, position, depth, and role", () => {
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        insertionPosition: "at-depth",
      }),
    ).toMatchObject({
      insertionPosition: "at-depth",
      role: "system",
    });
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        insertionOrder: "25.5",
        insertionPosition: "at-depth",
        depth: "2.9",
        role: "assistant",
      }),
    ).toMatchObject({
      insertionOrder: 25.5,
      insertionPosition: "at-depth",
      depth: 2,
      role: "assistant",
    });
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        insertionPosition: "before-character",
        depth: "4",
        role: "user",
      }),
    ).toMatchObject({
      insertionPosition: "before-character",
      depth: null,
      role: null,
    });
  });

  it("serializes probability and inclusion-group controls", () => {
    expect(readPercentInput("150", 100)).toBe(100);
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        probability: "49.9",
        inclusionGroup: " rivals , alternates ",
        groupWeight: "25.9",
        prioritizeInclusion: true,
      }),
    ).toMatchObject({
      probability: 49,
      inclusionGroup: " rivals , alternates ",
      groupWeight: 25,
      prioritizeInclusion: true,
    });
  });

  it("serializes additional matching sources only when enabled", () => {
    expect(lorebookEntryDraftToInput(baseDraft).matchSources).toBeNull();
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        matchSources: {
          ...EMPTY_LORE_MATCH_SOURCES,
          characterDescription: true,
        },
      }).matchSources,
    ).toEqual({
      ...EMPTY_LORE_MATCH_SOURCES,
      characterDescription: true,
    });
  });

  it("serializes recursion controls only when enabled", () => {
    expect(lorebookEntryDraftToInput(baseDraft).recursion).toBeNull();
    expect(lorebookEntryDraftToInput({ ...baseDraft, recursionLevel: "4" }).recursion).toBeNull();
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        preventFurther: true,
        delayUntilRecursion: true,
        recursionLevel: "2.9",
      }).recursion,
    ).toEqual({
      ...DEFAULT_LORE_ENTRY_RECURSION,
      preventFurther: true,
      delayUntilRecursion: true,
      recursionLevel: 2,
    });
  });

  it("normalizes missing matching sources to default-off checkboxes", () => {
    expect(normalizeLoreMatchSources(null)).toEqual(EMPTY_LORE_MATCH_SOURCES);
    expect(
      normalizeLoreMatchSources({
        ...EMPTY_LORE_MATCH_SOURCES,
        scenario: true,
      }),
    ).toEqual({
      ...EMPTY_LORE_MATCH_SOURCES,
      scenario: true,
    });
  });

  it("normalizes missing recursion controls to default-off checkboxes", () => {
    expect(resolveEntryRecursion({ recursion: null })).toEqual(DEFAULT_LORE_ENTRY_RECURSION);
    expect(
      resolveEntryRecursion({
        recursion: { ...DEFAULT_LORE_ENTRY_RECURSION, nonRecursable: true },
      }),
    ).toEqual({
      ...DEFAULT_LORE_ENTRY_RECURSION,
      nonRecursable: true,
    });
  });

  it("normalizes nullable budget inputs", () => {
    expect(readNullableNonNegativeIntegerInput("", 7)).toBeNull();
    expect(readNullableNonNegativeIntegerInput("3.9", null)).toBe(3);
    expect(readNullableNonNegativeIntegerInput("nope", 7)).toBe(7);
    expect(readNullablePercentInput("150", null)).toBe(100);
  });

  it("applies entry draft save blocking only when the entry editor owns save", () => {
    const invalidSelectiveDraft: LorebookEntryDraft = {
      ...baseDraft,
      strategy: "selective",
      key: "",
    };

    expect(
      entryDraftDisablesBannerSave({
        draft: invalidSelectiveDraft,
        showEditor: true,
        showLorebookEditor: false,
      }),
    ).toBe(true);
    expect(
      entryDraftDisablesBannerSave({
        draft: invalidSelectiveDraft,
        showEditor: true,
        showLorebookEditor: true,
      }),
    ).toBe(false);
  });
});

describe("LorebooksSurface", () => {
  it("renders Include names in existing lorebook activation settings", () => {
    const markup = renderToStaticMarkup(<LorebooksSurface nav={surfaceNav()} />);

    expect(markup).toContain("Include names");
    expect(markup).toContain('aria-label="Include names"');
    expect(markup).toContain("Recursive scan");
    expect(markup).toContain("Max recursion steps");
    expect(markup).toContain("Use group scoring");
  });

  it("renders Include names in new lorebook activation settings", () => {
    const markup = renderToStaticMarkup(
      <LorebooksSurface
        nav={surfaceNav({
          lorebooks: [],
          view: { kind: "lorebooks", mode: "new-lorebook" },
        })}
      />,
    );

    expect(markup).toContain("Include names");
    expect(markup).toContain('aria-label="Include names"');
    expect(markup).toContain("Recursive scan");
    expect(markup).toContain("Max recursion steps");
    expect(markup).toContain("Use group scoring");
  });
});
