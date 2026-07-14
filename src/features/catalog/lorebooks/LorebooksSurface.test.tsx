import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  createLorebookEntryRecord,
  createLorebookRecord,
} from "../../../engine/catalog/lorebook-actions";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import {
  DEFAULT_LORE_ENTRY_TIMING,
  DEFAULT_LORE_ENTRY_RECURSION,
  resolveEntryTiming,
  resolveEntryRecursion,
} from "../../../engine/contracts/types/lorebook";
import {
  canSaveLorebookEntryDraft,
  EMPTY_LORE_MATCH_SOURCES,
  entryDraftDisablesBannerSave,
  lorebookEntryDraftFromRecord,
  lorebookEntryDraftToInput,
  normalizeLoreMatchSources,
  parseLorebookEntryKeys,
  readNonNegativeFiniteNumberInput,
  readNullableNonNegativeIntegerInput,
  readNullablePercentInput,
  readPercentInput,
  type LorebookEntryDraft,
} from "./lorebook-entry-draft";
import { LorebooksSurface, type LorebooksSurfaceNav } from "./LorebooksSurface";
import { EntryCharacterFilterControls } from "./EntryCharacterFilterControls";
import { EntryTriggerControls } from "./EntryTriggerControls";
import { updateTriggerScope } from "./entry-trigger-scope";
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
  sticky: String(DEFAULT_LORE_ENTRY_TIMING.sticky),
  cooldown: String(DEFAULT_LORE_ENTRY_TIMING.cooldown),
  delay: String(DEFAULT_LORE_ENTRY_TIMING.delay),
  matchSources: EMPTY_LORE_MATCH_SOURCES,
  triggers: null,
  characterFilter: null,
};

function surfaceNav(overrides: Partial<LorebooksSurfaceNav> = {}): LorebooksSurfaceNav {
  const lorebook = createLorebookRecord({
    id: "lorebook-1",
    input: { title: "World Notes" },
    now,
  });

  return {
    characters: [],
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
      groupWeight: 25.9,
      prioritizeInclusion: true,
    });
    expect(readNonNegativeFiniteNumberInput("0.5", 100)).toBe(0.5);
    expect(readNonNegativeFiniteNumberInput("-1", 100)).toBe(100);
    expect(readNonNegativeFiniteNumberInput("Infinity", 100)).toBe(100);
    expect(lorebookEntryDraftToInput({ ...baseDraft, groupWeight: "-1" }).groupWeight).toBe(100);
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

  it("round-trips trigger and companion restrictions without losing imported values", () => {
    const record = createLorebookEntryRecord({
      id: "restricted-entry",
      input: {
        title: "Restricted",
        triggers: { types: ["normal", "regenerate"] },
        characterFilter: {
          mode: "exclude",
          characterIds: [" character-1 ", "character-1", "character-2"],
        },
      },
      now,
    });

    const draft = lorebookEntryDraftFromRecord(record);

    expect(lorebookEntryDraftToInput(draft)).toMatchObject({
      triggers: { types: ["normal", "regenerate"] },
      characterFilter: {
        mode: "exclude",
        characterIds: ["character-1", "character-2"],
      },
    });
  });

  it("requires selections for enabled trigger and companion restrictions", () => {
    expect(canSaveLorebookEntryDraft({ ...baseDraft, triggers: { types: [] } })).toBe(false);
    expect(
      canSaveLorebookEntryDraft({
        ...baseDraft,
        characterFilter: { mode: "include", characterIds: [] },
      }),
    ).toBe(false);
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

  it("serializes timed effects only when enabled", () => {
    expect(lorebookEntryDraftToInput(baseDraft).timing).toBeNull();
    expect(lorebookEntryDraftToInput({ ...baseDraft, sticky: "4.9" }).timing).toEqual({
      ...DEFAULT_LORE_ENTRY_TIMING,
      sticky: 4,
    });
    expect(
      lorebookEntryDraftToInput({
        ...baseDraft,
        sticky: "-1",
        cooldown: "2.9",
        delay: "3",
      }).timing,
    ).toEqual({
      ...DEFAULT_LORE_ENTRY_TIMING,
      cooldown: 2,
      delay: 3,
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

  it("normalizes missing timed effects to default zero values", () => {
    expect(resolveEntryTiming({ timing: null })).toEqual(DEFAULT_LORE_ENTRY_TIMING);
    expect(resolveEntryTiming({ timing: { ...DEFAULT_LORE_ENTRY_TIMING, cooldown: 2 } })).toEqual({
      ...DEFAULT_LORE_ENTRY_TIMING,
      cooldown: 2,
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
  it("renders supported and imported trigger constraints without claiming unsupported actions", () => {
    const markup = renderToStaticMarkup(
      <EntryTriggerControls
        draft={{ ...baseDraft, triggers: { types: ["normal", "regenerate"] } }}
        onDraftChange={() => undefined}
      />,
    );

    expect(markup).toContain("Ordinary send");
    expect(markup).toContain("Imported constraints preserved: Regenerate");
    expect(markup).toContain("Clear all trigger restrictions");
    expect(markup).not.toContain('<option value="regenerate"');
    expect(markup).not.toContain('<option value="all"');
  });

  it("preserves imported trigger values through scope transitions", () => {
    const draft: LorebookEntryDraft = { ...baseDraft, triggers: { types: ["regenerate"] } };
    expect(updateTriggerScope(draft, "all").triggers?.types).toEqual(["regenerate"]);
    const restricted = updateTriggerScope(draft, "restricted");
    expect(restricted.triggers?.types).toEqual(["regenerate", "normal"]);
    expect(updateTriggerScope(restricted, "all").triggers?.types).toEqual(["regenerate", "normal"]);

    const unrestricted = updateTriggerScope(baseDraft, "restricted");
    expect(unrestricted.triggers?.types).toEqual(["normal"]);
    expect(updateTriggerScope(unrestricted, "all").triggers).toBeNull();
  });

  it("renders catalog companions as character-filter choices", () => {
    const markup = renderToStaticMarkup(
      <EntryCharacterFilterControls
        characters={[{ id: "character-1", displayName: "Mara" }]}
        draft={{
          ...baseDraft,
          characterFilter: { mode: "include", characterIds: ["character-1"] },
        }}
        onDraftChange={() => undefined}
      />,
    );

    expect(markup).toContain("Only selected companions");
    expect(markup).toContain("Mara");
    expect(markup).toContain('aria-label="Filter companion Mara"');
  });

  it("uses unique label targets when filter controls are rendered more than once", () => {
    const markup = renderToStaticMarkup(
      <>
        <EntryTriggerControls draft={baseDraft} onDraftChange={() => undefined} />
        <EntryTriggerControls draft={baseDraft} onDraftChange={() => undefined} />
        <EntryCharacterFilterControls
          characters={[]}
          draft={baseDraft}
          onDraftChange={() => undefined}
        />
        <EntryCharacterFilterControls
          characters={[]}
          draft={baseDraft}
          onDraftChange={() => undefined}
        />
      </>,
    );
    const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    const labelTargets = [...markup.matchAll(/ for="([^"]+)"/g)].map((match) => match[1]);

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(labelTargets).toEqual(ids);
  });

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
