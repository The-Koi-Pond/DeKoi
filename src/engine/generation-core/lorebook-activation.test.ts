import { describe, expect, it, vi } from "vitest";

import {
  advanceLoreRuntimeStateForEvaluation,
  activateLorebookEntries,
  activateLorebookEntriesWithWarnings,
  applyTokenBudget,
  buildMatchSources,
  buildScanBuffer,
  matchKey,
  sortActivatedEntriesForInsertion,
} from "./lorebook-activation";
import { finalizeActivationResult } from "./lorebook-activation-resolution";
import type { ActivatedLoreEntry } from "./lorebook-activation-types";
import { createLorebookEntryRecord, createLorebookRecord } from "../catalog/lorebook-actions";
import type { LorebookRecord } from "../contracts/types/lorebook";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import type { CharacterRecord } from "../contracts/types/character";
import type { PersonaRecord } from "../contracts/types/persona";
import {
  activateLoreGenerationEntriesWithWarnings,
  type LorebookSourceBuckets,
} from "../generation/generation";

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

function chatLorebookSources(lorebooks: LorebookRecord[]): LorebookSourceBuckets {
  return {
    chat: lorebooks,
    persona: [],
    character: [],
    global: [],
  };
}

function entry(input: Partial<Parameters<typeof createLorebookEntryRecord>[0]["input"]>) {
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

function runtimeState(input: Partial<LoreRuntimeState> = {}): LoreRuntimeState {
  return {
    id: "lore-runtime-state-under-test",
    schemaVersion: 1,
    ownerKind: "mode-branch",
    ownerId: "messenger-thread-under-test",
    lastEvaluatedMessageCount: 0,
    createdAt: now,
    updatedAt: now,
    ...input,
    entries: input.entries ?? [],
  };
}

function activateWithAdvancedRuntimeState(
  book: LorebookRecord,
  scanBuffer: string,
  options: NonNullable<Parameters<typeof activateLorebookEntriesWithWarnings>[2]> & {
    messageCount: number;
    runtimeState: LoreRuntimeState;
  },
) {
  return activateLorebookEntriesWithWarnings(book, scanBuffer, {
    ...options,
    runtimeState: advanceLoreRuntimeStateForEvaluation(options.runtimeState, options.messageCount),
  });
}

function activatedEntry(
  lorebookId: string,
  loreEntry: LorebookRecord["entries"][number],
  overrides: Partial<ActivatedLoreEntry> = {},
): ActivatedLoreEntry {
  return {
    lorebookId,
    lorebookTitle: lorebookId,
    lorebookSummary: "",
    entry: loreEntry,
    matchReason: "constant",
    activationSource: "direct",
    matchedKey: null,
    matchedKeyCount: 0,
    warnings: [],
    sourceOrder: 0,
    sourceKind: "chat",
    entryIndex: 0,
    recursionLevel: null,
    ...overrides,
  };
}

function character(input: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: "character-1",
    schemaVersion: 1,
    displayName: "Mara",
    nickname: null,
    description: "",
    personality: "",
    scenario: "",
    firstMessage: "",
    alternateGreetings: [],
    groupOnlyGreetings: [],
    exampleMessages: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    creator: "",
    characterVersion: "",
    creatorNotes: "",
    tags: [],
    characterNote: "",
    characterNoteDepth: 0,
    characterNoteRole: "system",
    talkativeness: 0.5,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    ...input,
    lorebookIds: input.lorebookIds ?? [],
  };
}

function persona(input: Partial<PersonaRecord> = {}): PersonaRecord {
  return {
    id: "persona-1",
    schemaVersion: 1,
    displayName: "Alex",
    nickname: null,
    description: "",
    personality: "",
    scenario: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    creator: "",
    characterVersion: "",
    creatorNotes: "",
    tags: [],
    characterNote: "",
    characterNoteDepth: 0,
    characterNoteRole: "system",
    talkativeness: 0.5,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    ...input,
    lorebookIds: input.lorebookIds ?? [],
  };
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

    expect(activateLorebookEntries(lorebook([noKey, emptyKey]), "No Key")).toEqual([]);
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

    const activated = activateLorebookEntries(lorebook([present, absent]), "Open the moon gate.");

    expect(activated.map((item) => item.entry)).toEqual([present]);
    expect(activated[0]).toMatchObject({
      matchReason: "primary-key",
      matchedKey: "moon gate",
    });
  });

  it("delays entry activation until the thread reaches the configured message count", () => {
    const delayed = entry({
      title: "Delayed",
      strategy: "selective",
      key: ["moon gate"],
      timing: { sticky: 0, cooldown: 0, delay: 2 },
    });

    expect(
      activateLorebookEntries(lorebook([delayed]), "Open the moon gate.", { messageCount: 1 }),
    ).toEqual([]);
    expect(
      activateLorebookEntries(lorebook([delayed]), "Open the moon gate.", { messageCount: 2 }).map(
        (item) => item.entry.title,
      ),
    ).toEqual(["Delayed"]);
  });

  it("applies delayed sticky and cooldown timers across a message sequence", () => {
    const timed = entry({
      title: "Timed",
      strategy: "selective",
      key: ["moon gate"],
      timing: { sticky: 3, cooldown: 2, delay: 2 },
    });
    const book = lorebook([timed]);
    let state = runtimeState();

    const first = activateWithAdvancedRuntimeState(book, "Open the moon gate.", {
      messageCount: 1,
      runtimeState: state,
    });
    state = first.runtimeState ?? state;
    expect(first.entries).toEqual([]);
    expect(state.entries).toEqual([]);

    const second = activateWithAdvancedRuntimeState(book, "Open the moon gate.", {
      messageCount: 2,
      runtimeState: state,
    });
    state = second.runtimeState ?? state;
    expect(second.entries.map((item) => item.entry.title)).toEqual(["Timed"]);
    expect(state.entries).toMatchObject([
      {
        activatedAtMessageIndex: 2,
        stickyRemaining: 3,
        cooldownRemaining: 2,
      },
    ]);

    const third = activateWithAdvancedRuntimeState(book, "", {
      messageCount: 3,
      runtimeState: state,
    });
    state = third.runtimeState ?? state;
    expect(third.entries).toMatchObject([{ matchReason: "sticky" }]);
    expect(state.entries).toMatchObject([{ stickyRemaining: 2, cooldownRemaining: 1 }]);

    const fourth = activateWithAdvancedRuntimeState(book, "", {
      messageCount: 4,
      runtimeState: state,
    });
    state = fourth.runtimeState ?? state;
    expect(fourth.entries).toMatchObject([{ matchReason: "sticky" }]);
    expect(state.entries).toMatchObject([{ stickyRemaining: 1, cooldownRemaining: 0 }]);

    const fifth = activateWithAdvancedRuntimeState(book, "", {
      messageCount: 5,
      runtimeState: state,
    });
    state = fifth.runtimeState ?? state;
    expect(fifth.entries).toEqual([]);
    expect(state.entries).toEqual([]);

    const sixth = activateWithAdvancedRuntimeState(book, "Open the moon gate.", {
      messageCount: 6,
      runtimeState: state,
    });
    expect(sixth.entries.map((item) => item.entry.title)).toEqual(["Timed"]);
    expect(sixth.runtimeState?.entries).toMatchObject([
      {
        activatedAtMessageIndex: 6,
        stickyRemaining: 3,
        cooldownRemaining: 2,
      },
    ]);
  });

  it("lets sticky activations bypass probability", () => {
    const sticky = entry({
      title: "Sticky",
      strategy: "selective",
      key: ["moon gate"],
      probability: 0,
      timing: { sticky: 2, cooldown: 0, delay: 0 },
    });

    const result = activateWithAdvancedRuntimeState(lorebook([sticky]), "", {
      messageCount: 2,
      rand: () => 0.99,
      runtimeState: runtimeState({
        lastEvaluatedMessageCount: 1,
        entries: [
          {
            lorebookId: "lorebook-under-test",
            entryId: sticky.id,
            entryUpdatedAt: sticky.updatedAt,
            activatedAtMessageIndex: 1,
            stickyRemaining: 2,
            cooldownRemaining: 0,
          },
        ],
      }),
    });

    expect(result.entries).toMatchObject([{ entry: sticky, matchReason: "sticky" }]);
  });

  it("lets sticky activations bypass inclusion-group suppression", () => {
    const sticky = entry({
      title: "Sticky",
      strategy: "selective",
      key: ["moon gate"],
      inclusionGroup: "variants",
      insertionOrder: 10,
      timing: { sticky: 2, cooldown: 0, delay: 0 },
    });
    const groupMate = entry({
      title: "Group Mate",
      strategy: "selective",
      key: ["rival gate"],
      inclusionGroup: "variants",
      insertionOrder: 100,
      prioritizeInclusion: true,
    });

    const result = activateWithAdvancedRuntimeState(
      lorebook([sticky, groupMate]),
      "The rival gate opens.",
      {
        messageCount: 2,
        runtimeState: runtimeState({
          lastEvaluatedMessageCount: 1,
          entries: [
            {
              lorebookId: "lorebook-under-test",
              entryId: sticky.id,
              entryUpdatedAt: sticky.updatedAt,
              activatedAtMessageIndex: 1,
              stickyRemaining: 2,
              cooldownRemaining: 0,
            },
          ],
        }),
      },
    );

    expect(
      result.entries.map((item) => ({
        title: item.entry.title,
        matchReason: item.matchReason,
      })),
    ).toEqual([
      { title: "Group Mate", matchReason: "primary-key" },
      { title: "Sticky", matchReason: "sticky" },
    ]);
  });

  it("does not start timers for generation entries trimmed by lore budget", () => {
    const timed = entry({
      title: "Timed",
      strategy: "selective",
      key: ["moon gate"],
      body: "A long body that cannot fit in a zero-token lore budget.",
      timing: { sticky: 4, cooldown: 3, delay: 0 },
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      chatLorebookSources([lorebook([timed], { budgetTokens: 0 })]),
      {
        runtimeState: runtimeState(),
        scanSources: [{ body: "Open the moon gate." }],
      },
    );

    expect(result.entries).toEqual([]);
    expect(result.runtimeState?.entries).toEqual([]);
  });

  it("clears sticky timers when generation budget trims sticky activations", () => {
    const sticky = entry({
      title: "Sticky",
      strategy: "selective",
      key: ["moon gate"],
      body: "A long body that cannot fit in a zero-token lore budget.",
      timing: { sticky: 4, cooldown: 0, delay: 0 },
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      chatLorebookSources([lorebook([sticky], { budgetTokens: 0 })]),
      {
        runtimeState: runtimeState({
          lastEvaluatedMessageCount: 1,
          entries: [
            {
              lorebookId: "lorebook-under-test",
              entryId: sticky.id,
              entryUpdatedAt: sticky.updatedAt,
              activatedAtMessageIndex: 1,
              stickyRemaining: 3,
              cooldownRemaining: 2,
            },
          ],
        }),
        scanSources: [{ body: "Previous message." }, { body: "Next message." }],
      },
    );

    expect(result.entries).toEqual([]);
    expect(result.runtimeState?.entries).toMatchObject([
      {
        stickyRemaining: 0,
        cooldownRemaining: 1,
      },
    ]);
  });

  it("blocks reactivation while cooldown remains active", () => {
    const cooling = entry({
      title: "Cooling",
      strategy: "selective",
      key: ["moon gate"],
      timing: { sticky: 0, cooldown: 3, delay: 0 },
    });
    const book = lorebook([cooling]);
    let state = runtimeState();

    const first = activateWithAdvancedRuntimeState(book, "Open the moon gate.", {
      messageCount: 1,
      runtimeState: state,
    });
    state = first.runtimeState ?? state;
    expect(first.entries.map((item) => item.entry.title)).toEqual(["Cooling"]);

    for (const messageCount of [2, 3]) {
      const blocked = activateWithAdvancedRuntimeState(book, "Open the moon gate.", {
        messageCount,
        runtimeState: state,
      });
      state = blocked.runtimeState ?? state;
      expect(blocked.entries).toEqual([]);
    }

    const reactivated = activateWithAdvancedRuntimeState(book, "Open the moon gate.", {
      messageCount: 4,
      runtimeState: state,
    });
    expect(reactivated.entries.map((item) => item.entry.title)).toEqual(["Cooling"]);
  });

  it("clears timed state when the thread does not advance", () => {
    const sticky = entry({
      title: "Sticky",
      strategy: "selective",
      key: ["moon gate"],
      timing: { sticky: 3, cooldown: 0, delay: 0 },
    });

    const result = activateWithAdvancedRuntimeState(lorebook([sticky]), "", {
      messageCount: 2,
      runtimeState: runtimeState({
        lastEvaluatedMessageCount: 2,
        entries: [
          {
            lorebookId: "lorebook-under-test",
            entryId: sticky.id,
            entryUpdatedAt: sticky.updatedAt,
            activatedAtMessageIndex: 1,
            stickyRemaining: 3,
            cooldownRemaining: 0,
          },
        ],
      }),
    });

    expect(result.entries).toEqual([]);
    expect(result.runtimeState?.entries).toEqual([]);
  });

  it("clears timed state when the entry definition changed", () => {
    const sticky = entry({
      title: "Sticky",
      strategy: "selective",
      key: ["moon gate"],
      timing: { sticky: 3, cooldown: 0, delay: 0 },
    });

    const result = activateWithAdvancedRuntimeState(lorebook([sticky]), "", {
      messageCount: 2,
      runtimeState: runtimeState({
        lastEvaluatedMessageCount: 1,
        entries: [
          {
            lorebookId: "lorebook-under-test",
            entryId: sticky.id,
            entryUpdatedAt: "2026-07-01T00:00:00.000Z",
            activatedAtMessageIndex: 1,
            stickyRemaining: 3,
            cooldownRemaining: 0,
          },
        ],
      }),
    });

    expect(result.entries).toEqual([]);
    expect(result.runtimeState?.entries).toEqual([]);
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

    expect(buildScanBuffer(sources, { scanDepth: 1, includeNames: true })).toContain("SecretName");
    expect(buildScanBuffer(sources, { scanDepth: 1, includeNames: false })).not.toContain(
      "SecretName",
    );
  });

  it("activates from opted-in companion and persona match sources only", () => {
    const fromDescription = entry({
      title: "Description Match",
      strategy: "selective",
      key: ["moonlit archive"],
      matchSources: {
        characterDescription: true,
        characterPersonality: false,
        scenario: false,
        characterNote: false,
        personaDescription: false,
      },
    });
    const defaultOff = entry({
      title: "Default Off",
      strategy: "selective",
      key: ["glass harbor"],
    });
    const fromPersona = entry({
      title: "Persona Match",
      strategy: "selective",
      key: ["violet cartographer"],
      matchSources: {
        characterDescription: false,
        characterPersonality: false,
        scenario: false,
        characterNote: false,
        personaDescription: true,
      },
    });
    const matchSources = buildMatchSources({
      companions: [
        character({
          description: "Keeps maps of the moonlit archive.",
          personality: "Knows the glass harbor.",
        }),
      ],
      activePersona: persona({
        description: "A violet cartographer from upriver.",
      }),
    });

    const activated = activateLorebookEntries(
      lorebook([fromDescription, defaultOff, fromPersona]),
      "",
      { matchSources },
    );

    expect(activated.map((item) => item.entry.title)).toEqual([
      "Description Match",
      "Persona Match",
    ]);
  });

  it("applies includeNames to additional match-source names", () => {
    const nameMatch = entry({
      title: "Name Match",
      strategy: "selective",
      key: ["Rook"],
      matchSources: {
        characterDescription: true,
        characterPersonality: false,
        scenario: false,
        characterNote: false,
        personaDescription: false,
      },
    });
    const matchSources = buildMatchSources({
      companions: [
        character({
          displayName: "Mara",
          nickname: "Rook",
          description: "No key here.",
        }),
      ],
    });

    expect(
      activateLorebookEntries(lorebook([nameMatch], { includeNames: true }), "", {
        matchSources,
      }).map((item) => item.entry.title),
    ).toEqual(["Name Match"]);
    expect(
      activateLorebookEntries(lorebook([nameMatch], { includeNames: false }), "", { matchSources }),
    ).toEqual([]);
  });

  it("applies includeNames to active persona nickname match-source names", () => {
    const nicknameMatch = entry({
      title: "Persona Nickname Match",
      strategy: "selective",
      key: ["Spark"],
      matchSources: {
        characterDescription: false,
        characterPersonality: false,
        scenario: false,
        characterNote: false,
        personaDescription: true,
      },
    });
    const matchSources = buildMatchSources({
      activePersona: persona({
        displayName: "Alex",
        nickname: "Spark",
        description: "No key here.",
      }),
    });

    expect(
      activateLorebookEntries(lorebook([nicknameMatch], { includeNames: true }), "", {
        matchSources,
      }).map((item) => item.entry.title),
    ).toEqual(["Persona Nickname Match"]);
    expect(
      activateLorebookEntries(lorebook([nicknameMatch], { includeNames: false }), "", {
        matchSources,
      }),
    ).toEqual([]);
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

  it.each([
    {
      logic: "and-any" as const,
      activeBuffer: "The gate opens near amber.",
      blockedBuffer: "The gate opens.",
    },
    {
      logic: "and-all" as const,
      activeBuffer: "The gate opens near amber and violet.",
      blockedBuffer: "The gate opens near amber.",
    },
    {
      logic: "not-any" as const,
      activeBuffer: "The gate opens.",
      blockedBuffer: "The gate opens near amber.",
    },
    {
      logic: "not-all" as const,
      activeBuffer: "The gate opens near amber.",
      blockedBuffer: "The gate opens near amber and violet.",
    },
  ])("applies $logic optional-filter selective logic", ({ activeBuffer, blockedBuffer, logic }) => {
    const filtered = entry({
      title: "Filtered",
      strategy: "selective",
      key: ["gate"],
      keySecondary: ["amber", "violet"],
      selectiveLogic: logic,
    });

    expect(
      activateLorebookEntries(lorebook([filtered]), activeBuffer).map((item) => item.entry.title),
    ).toEqual(["Filtered"]);
    expect(activateLorebookEntries(lorebook([filtered]), blockedBuffer)).toEqual([]);
  });

  it("ignores selective logic when optional-filter keys are blank", () => {
    const filtered = entry({
      title: "Filtered",
      strategy: "selective",
      key: ["gate"],
      keySecondary: ["  "],
      selectiveLogic: "and-all",
    });

    expect(
      activateLorebookEntries(lorebook([filtered]), "The gate opens.").map(
        (item) => item.entry.title,
      ),
    ).toEqual(["Filtered"]);
  });

  it("matches regex primary and optional-filter keys", () => {
    const primaryRegex = entry({
      title: "Primary Regex",
      strategy: "selective",
      key: ["/moon\\s+gate/i"],
    });
    const secondaryRegex = entry({
      title: "Secondary Regex",
      strategy: "selective",
      key: ["gate"],
      keySecondary: ["/amber\\s+bell/"],
      selectiveLogic: "and-any",
    });

    const activated = activateLorebookEntries(
      lorebook([primaryRegex, secondaryRegex]),
      "The moon     gate opens beside the amber bell.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Primary Regex", "Secondary Regex"]);
  });

  it("falls back to plaintext for invalid regex keys and surfaces a warning", () => {
    const invalidRegex = entry({
      title: "Invalid Regex",
      strategy: "selective",
      key: ["/[bad/"],
    });

    const activated = activateLorebookEntries(
      lorebook([invalidRegex], { matchWholeWords: false }),
      "Use literal /[bad/ text.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Invalid Regex"]);
    expect(activated[0]?.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
  });

  it("surfaces unsupported regex flags as invalid regex warnings", () => {
    const invalidFlag = entry({
      title: "Invalid Flag",
      strategy: "selective",
      key: ["/[bad/q"],
    });

    const activated = activateLorebookEntries(
      lorebook([invalidFlag], { matchWholeWords: false }),
      "Use literal /[bad/q text.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Invalid Flag"]);
    expect(activated[0]?.warnings[0]).toContain('Invalid regex key "/[bad/q" treated as plaintext');
  });

  it("surfaces invalid regex warnings when primary keys do not activate", () => {
    const invalidRegex = entry({
      title: "Inactive Invalid Regex",
      strategy: "selective",
      key: ["/[bad/"],
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([invalidRegex], { matchWholeWords: false }),
      "No literal fallback text appears.",
    );

    expect(activation.entries).toEqual([]);
    expect(activation.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
  });

  it("surfaces invalid regex warnings when optional filters block activation", () => {
    const invalidFilter = entry({
      title: "Blocked Invalid Filter",
      strategy: "selective",
      key: ["gate"],
      keySecondary: ["/[bad/"],
      selectiveLogic: "and-any",
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([invalidFilter], { matchWholeWords: false }),
      "The gate opens without the fallback text.",
    );

    expect(activation.entries).toEqual([]);
    expect(activation.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
  });

  it("rejects unsafe regex keys before matching and falls back to plaintext", () => {
    const unsafeRegex = entry({
      title: "Unsafe Regex",
      strategy: "selective",
      key: ["/(a+)+$/"],
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([unsafeRegex], { matchWholeWords: false }),
      "The literal /(a+)+$/ appears.",
    );

    expect(activation.entries.map((item) => item.entry.title)).toEqual(["Unsafe Regex"]);
    expect(activation.entries[0]?.warnings[0]).toContain(
      'Unsafe regex key "/(a+)+$/" treated as plaintext',
    );
    expect(activation.warnings[0]).toContain('Unsafe regex key "/(a+)+$/" treated as plaintext');
  });

  it("allows optional and exact-one group quantifiers in regex keys", () => {
    const optionalGroup = entry({
      title: "Optional Group",
      strategy: "selective",
      key: ["/(cat|dog)? gate/"],
    });
    const exactOneGroup = entry({
      title: "Exact One Group",
      strategy: "selective",
      key: ["/(moon|sun){1} gate/"],
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([optionalGroup, exactOneGroup], { matchWholeWords: false }),
      "The cat gate and moon gate open.",
    );

    expect(activation.entries.map((item) => item.entry.title)).toEqual([
      "Optional Group",
      "Exact One Group",
    ]);
    expect(activation.warnings).toEqual([]);
  });

  it("rejects optional inner quantifiers inside repeated regex groups", () => {
    const optionalInner = entry({
      title: "Optional Inner",
      strategy: "selective",
      key: ["/(a?){30}a{30}/"],
    });
    const boundedOptionalInner = entry({
      title: "Bounded Optional Inner",
      strategy: "selective",
      key: ["/(a{0,1}){30}a{30}/"],
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([optionalInner, boundedOptionalInner], {
        matchWholeWords: false,
      }),
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );

    expect(activation.entries).toEqual([]);
    expect(activation.warnings[0]).toContain(
      'Unsafe regex key "/(a?){30}a{30}/" treated as plaintext',
    );
    expect(activation.warnings[1]).toContain(
      'Unsafe regex key "/(a{0,1}){30}a{30}/" treated as plaintext',
    );
  });

  it("rejects repeated regex alternation before matching", () => {
    const repeatedAlternation = entry({
      title: "Repeated Alternation",
      strategy: "selective",
      key: ["/(cat|dog)+ gate/"],
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([repeatedAlternation], { matchWholeWords: false }),
      "The catdog gate opens.",
    );

    expect(activation.entries).toEqual([]);
    expect(activation.warnings[0]).toContain(
      'Unsafe regex key "/(cat|dog)+ gate/" treated as plaintext',
    );
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
    const secondLorebookEntries = activateLorebookEntries(lorebook([highOtherSource]), "", {
      sourceOrder: 1,
    });

    expect(
      sortActivatedEntriesForInsertion([...firstLorebookEntries, ...secondLorebookEntries]).map(
        (item) => item.entry.title,
      ),
    ).toEqual(["High Other Source", "Tied First", "Tied Second", "Low"]);
  });

  it("collapses inclusion groups with weighted random selection", () => {
    const light = entry({
      title: "Light",
      strategy: "constant",
      inclusionGroup: "variant",
      groupWeight: 10,
    });
    const heavy = entry({
      title: "Heavy",
      strategy: "constant",
      inclusionGroup: "variant",
      groupWeight: 90,
    });

    const activated = activateLorebookEntries(lorebook([light, heavy]), "", {
      rand: () => 0.2,
    });

    expect(activated.map((item) => item.entry.title)).toEqual(["Heavy"]);
  });

  it("uses prioritize inclusion to pick the highest insertion order in a group", () => {
    const lowPriorityToggle = entry({
      title: "Priority Toggle",
      strategy: "constant",
      inclusionGroup: "variant",
      insertionOrder: 10,
      prioritizeInclusion: true,
    });
    const highOrder = entry({
      title: "High Order",
      strategy: "constant",
      inclusionGroup: "variant",
      insertionOrder: 100,
    });

    const activated = activateLorebookEntries(lorebook([lowPriorityToggle, highOrder]), "");

    expect(activated.map((item) => item.entry.title)).toEqual(["High Order"]);
  });

  it("uses group scoring to pick the entry with the most matched primary keys", () => {
    const higherOrderSingleMatch = entry({
      title: "Single Match",
      strategy: "selective",
      key: ["gate"],
      inclusionGroup: "variant",
      insertionOrder: 100,
    });
    const lowerOrderMultiMatch = entry({
      title: "Multi Match",
      strategy: "selective",
      key: ["gate", "moon", "star"],
      inclusionGroup: "variant",
      insertionOrder: 10,
    });

    const activated = activateLorebookEntries(
      lorebook([higherOrderSingleMatch, lowerOrderMultiMatch], { useGroupScoring: true }),
      "The moon gate opens under a star.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Multi Match"]);
  });

  it("discovers overlapping inclusion groups by insertion order", () => {
    const lowDirect = entry({
      title: "Low Direct",
      strategy: "constant",
      inclusionGroup: "alpha",
      insertionOrder: 10,
      groupWeight: 70,
    });
    const highSelective = entry({
      title: "High Selective",
      strategy: "selective",
      key: ["gate"],
      inclusionGroup: "beta, alpha",
      insertionOrder: 100,
      groupWeight: 70,
    });
    const midSelective = entry({
      title: "Mid Selective",
      strategy: "selective",
      key: ["gate"],
      inclusionGroup: "beta",
      insertionOrder: 90,
      groupWeight: 30,
    });

    const activated = activateLorebookEntries(
      lorebook([lowDirect, highSelective, midSelective]),
      "The gate opens.",
      { rand: () => 0.39 },
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["High Selective"]);
  });

  it("collapses connected overlapping inclusion groups before weighted selection", () => {
    const alphaOnly = entry({
      title: "Alpha Only",
      strategy: "constant",
      inclusionGroup: "alpha",
      insertionOrder: 100,
      groupWeight: 100,
    });
    const bridge = entry({
      title: "Bridge",
      strategy: "constant",
      inclusionGroup: "alpha, beta",
      insertionOrder: 90,
      groupWeight: 0,
    });
    const betaOnly = entry({
      title: "Beta Only",
      strategy: "constant",
      inclusionGroup: "beta",
      insertionOrder: 80,
      groupWeight: 100,
    });

    const activated = activateLorebookEntries(lorebook([alphaOnly, bridge, betaOnly]), "", {
      rand: () => 0.25,
    });

    expect(activated.map((item) => item.entry.title)).toEqual(["Alpha Only"]);
  });

  it("scores connected overlapping inclusion groups as one candidate set", () => {
    const alphaOnly = entry({
      title: "Alpha Only",
      strategy: "selective",
      key: ["gate", "moon"],
      inclusionGroup: "alpha",
      insertionOrder: 100,
    });
    const bridge = entry({
      title: "Bridge",
      strategy: "selective",
      key: ["gate"],
      inclusionGroup: "alpha, beta",
      insertionOrder: 90,
    });
    const betaOnly = entry({
      title: "Beta Only",
      strategy: "selective",
      key: ["gate", "star", "sun"],
      inclusionGroup: "beta",
      insertionOrder: 80,
    });

    const activated = activateLorebookEntries(
      lorebook([alphaOnly, bridge, betaOnly], { useGroupScoring: true }),
      "The moon gate opens under a star-bright sun.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Beta Only"]);
  });

  it("applies insertion-order priority to connected overlapping inclusion groups", () => {
    const alphaOnly = entry({
      title: "Alpha Only",
      strategy: "constant",
      inclusionGroup: "alpha",
      insertionOrder: 100,
    });
    const bridge = entry({
      title: "Bridge",
      strategy: "constant",
      inclusionGroup: "alpha, beta",
      insertionOrder: 10,
      prioritizeInclusion: true,
    });
    const betaOnly = entry({
      title: "Beta Only",
      strategy: "constant",
      inclusionGroup: "beta",
      insertionOrder: 90,
    });

    const activated = activateLorebookEntries(lorebook([alphaOnly, bridge, betaOnly]), "");

    expect(activated.map((item) => item.entry.title)).toEqual(["Alpha Only"]);
  });

  it("keys grouped entry suppression by lorebook and entry id", () => {
    const winner = entry({
      title: "Winner",
      strategy: "constant",
      inclusionGroup: "alpha",
      insertionOrder: 100,
      groupWeight: 100,
    });
    const alphaLoser = {
      ...entry({
        title: "Alpha Loser",
        strategy: "constant",
        inclusionGroup: "alpha",
        insertionOrder: 10,
        groupWeight: 0,
      }),
      id: "shared-entry",
    };
    const unrelatedSameId = {
      ...entry({
        title: "Unrelated Same Id",
        strategy: "constant",
        inclusionGroup: "beta",
        insertionOrder: 90,
      }),
      id: "shared-entry",
    };

    const activation = finalizeActivationResult({
      activation: lorebook([]).activation,
      entries: [
        activatedEntry("book-a", winner),
        activatedEntry("book-a", alphaLoser),
        activatedEntry("book-b", unrelatedSameId),
      ],
      rand: () => 0,
      warnings: [],
    });

    expect(activation.entries.map((item) => item.entry.title)).toEqual([
      "Winner",
      "Unrelated Same Id",
    ]);
  });

  it("keys group-scoring counts by lorebook and entry id", () => {
    const first = {
      ...entry({
        title: "First Shared",
        strategy: "selective",
        inclusionGroup: "variant",
        insertionOrder: 100,
      }),
      id: "shared-entry",
    };
    const second = {
      ...entry({
        title: "Second Shared",
        strategy: "selective",
        inclusionGroup: "variant",
        insertionOrder: 10,
      }),
      id: "shared-entry",
    };

    const activation = finalizeActivationResult({
      activation: lorebook([], { useGroupScoring: true }).activation,
      countPrimaryMatches: (candidate) => ({
        matchedKeyCount: candidate.lorebookId === "book-b" ? 2 : 1,
        warnings: [],
      }),
      entries: [activatedEntry("book-a", first), activatedEntry("book-b", second)],
      rand: () => 0,
      warnings: [],
    });

    expect(activation.entries.map((item) => item.entry.title)).toEqual(["Second Shared"]);
  });

  it("stops primary matching after the first match when group scoring cannot use counts", () => {
    const ungrouped = entry({
      title: "Ungrouped",
      strategy: "selective",
      key: ["gate", "/[bad/"],
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([ungrouped], { matchWholeWords: false, useGroupScoring: true }),
      "The gate opens.",
    );

    expect(activation.entries[0]).toMatchObject({
      entry: ungrouped,
      matchedKey: "gate",
      matchedKeyCount: 1,
    });
    expect(activation.warnings).toEqual([]);
  });

  it("counts all matched primary keys for competing group-scored inclusion entries", () => {
    const grouped = entry({
      title: "Grouped",
      strategy: "selective",
      key: ["gate", "moon"],
      inclusionGroup: "variant",
      insertionOrder: 10,
    });
    const competitor = entry({
      title: "Competitor",
      strategy: "selective",
      key: ["gate"],
      inclusionGroup: "variant",
      insertionOrder: 100,
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([grouped, competitor], { useGroupScoring: true }),
      "The moon gate opens.",
    );

    expect(activation.entries[0]).toMatchObject({
      entry: grouped,
      matchedKey: "gate",
      matchedKeyCount: 2,
    });
  });

  it("keeps primary matching first-match for unopposed group-scored entries", () => {
    const RealRegExp = RegExp;
    const regexpSpy = vi.fn(function (pattern: string | RegExp = "", flags?: string) {
      return new RealRegExp(pattern, flags);
    });
    vi.stubGlobal("RegExp", regexpSpy);

    try {
      const grouped = entry({
        title: "Grouped",
        strategy: "selective",
        key: ["/gate/", "/expensive primary/"],
        inclusionGroup: "variant",
      });

      const activation = activateLorebookEntriesWithWarnings(
        lorebook([grouped], { useGroupScoring: true }),
        "The gate opens.",
      );

      expect(activation.entries[0]).toMatchObject({
        entry: grouped,
        matchedKey: "/gate/",
        matchedKeyCount: 1,
      });
      expect(regexpSpy.mock.calls.some(([pattern]) => pattern === "expensive primary")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps primary matching first-match when priority disables group scoring", () => {
    const RealRegExp = RegExp;
    const regexpSpy = vi.fn(function (pattern: string | RegExp = "", flags?: string) {
      return new RealRegExp(pattern, flags);
    });
    vi.stubGlobal("RegExp", regexpSpy);

    try {
      const priorityToggle = entry({
        title: "Priority Toggle",
        strategy: "selective",
        key: ["gate"],
        inclusionGroup: "variant",
        insertionOrder: 10,
        prioritizeInclusion: true,
      });
      const highOrder = entry({
        title: "High Order",
        strategy: "selective",
        key: ["/gate/", "/expensive primary/"],
        inclusionGroup: "variant",
        insertionOrder: 100,
      });

      const activation = activateLorebookEntriesWithWarnings(
        lorebook([priorityToggle, highOrder], { useGroupScoring: true }),
        "The gate opens.",
      );

      expect(activation.entries.map((item) => item.entry.title)).toEqual(["High Order"]);
      expect(activation.entries[0]?.matchedKeyCount).toBe(1);
      expect(regexpSpy.mock.calls.some(([pattern]) => pattern === "expensive primary")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps primary matching first-match when secondary filters block group-scored entries", () => {
    const RealRegExp = RegExp;
    const regexpSpy = vi.fn(function (pattern: string | RegExp = "", flags?: string) {
      return new RealRegExp(pattern, flags);
    });
    vi.stubGlobal("RegExp", regexpSpy);

    try {
      const filtered = entry({
        title: "Filtered",
        strategy: "selective",
        key: ["/gate/", "/expensive primary/"],
        keySecondary: ["missing filter"],
        selectiveLogic: "and-any",
        inclusionGroup: "variant",
      });

      const activation = activateLorebookEntriesWithWarnings(
        lorebook([filtered], { useGroupScoring: true }),
        "The gate opens.",
      );

      expect(activation.entries).toEqual([]);
      expect(regexpSpy.mock.calls.some(([pattern]) => pattern === "expensive primary")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not inflate group scoring with duplicate primary keys", () => {
    const duplicateHighOrder = entry({
      title: "Duplicate High Order",
      strategy: "selective",
      key: ["gate", "gate"],
      inclusionGroup: "variant",
      insertionOrder: 100,
    });
    const uniqueLowOrder = entry({
      title: "Unique Low Order",
      strategy: "selective",
      key: ["gate", "moon"],
      inclusionGroup: "variant",
      insertionOrder: 10,
    });

    const activated = activateLorebookEntries(
      lorebook([duplicateHighOrder, uniqueLowOrder], { useGroupScoring: true }),
      "The moon gate opens.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Unique Low Order"]);
  });

  it("does not inflate group scoring with case-insensitive duplicate primary keys", () => {
    const duplicateCaseHighOrder = entry({
      title: "Duplicate Case High Order",
      strategy: "selective",
      key: ["gate", "Gate"],
      inclusionGroup: "variant",
      insertionOrder: 100,
    });
    const uniqueLowOrder = entry({
      title: "Unique Low Order",
      strategy: "selective",
      key: ["gate", "moon"],
      inclusionGroup: "variant",
      insertionOrder: 10,
    });

    const activated = activateLorebookEntries(
      lorebook([duplicateCaseHighOrder, uniqueLowOrder], { useGroupScoring: true }),
      "The moon gate opens.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Unique Low Order"]);
  });

  it("does not inflate group scoring with equivalent regex primary keys", () => {
    const duplicateRegexHighOrder = entry({
      title: "Duplicate Regex High Order",
      strategy: "selective",
      key: ["/gate/", "/gate/i"],
      inclusionGroup: "variant",
      insertionOrder: 100,
    });
    const uniqueLowOrder = entry({
      title: "Unique Low Order",
      strategy: "selective",
      key: ["/gate/", "moon"],
      inclusionGroup: "variant",
      insertionOrder: 10,
    });

    const activated = activateLorebookEntries(
      lorebook([duplicateRegexHighOrder, uniqueLowOrder], { useGroupScoring: true }),
      "The moon gate opens.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Unique Low Order"]);
  });

  it("preserves the first matching regex key while deduping matched primary counts", () => {
    const grouped = entry({
      title: "Grouped Regex",
      strategy: "selective",
      key: ["/gate/i", "/gate/"],
      inclusionGroup: "variant",
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([grouped], { useGroupScoring: true }),
      "The gate opens.",
    );

    expect(activation.entries[0]).toMatchObject({
      matchedKey: "/gate/i",
      matchedKeyCount: 1,
    });
  });

  it("suppresses entries in any group owned by the winning inclusion member", () => {
    const bridge = entry({
      title: "Bridge",
      strategy: "constant",
      inclusionGroup: "alpha, beta",
      insertionOrder: 100,
      prioritizeInclusion: true,
    });
    const alphaOnly = entry({
      title: "Alpha Only",
      strategy: "constant",
      inclusionGroup: "alpha",
      insertionOrder: 10,
    });
    const betaOnly = entry({
      title: "Beta Only",
      strategy: "constant",
      inclusionGroup: "beta",
      insertionOrder: 10,
    });
    const outside = entry({
      title: "Outside",
      strategy: "constant",
      insertionOrder: 5,
    });

    const activated = activateLorebookEntries(lorebook([alphaOnly, betaOnly, outside, bridge]), "");

    expect(activated.map((item) => item.entry.title)).toEqual(["Bridge", "Outside"]);
  });

  it("applies probability as a final threshold gate after group resolution", () => {
    const doomedWinner = entry({
      title: "Doomed Winner",
      strategy: "constant",
      inclusionGroup: "variant",
      probability: 0,
      insertionOrder: 100,
      prioritizeInclusion: true,
    });
    const suppressedLoser = entry({
      title: "Suppressed Loser",
      strategy: "constant",
      inclusionGroup: "variant",
      probability: 100,
      insertionOrder: 10,
    });
    const thresholdKeep = entry({
      title: "Threshold Keep",
      strategy: "constant",
      probability: 50,
      insertionOrder: 5,
    });
    const thresholdDrop = entry({
      title: "Threshold Drop",
      strategy: "constant",
      probability: 50,
      insertionOrder: 0,
    });
    const rolls = [0.9, 0.49, 0.5];

    const activated = activateLorebookEntries(
      lorebook([suppressedLoser, doomedWinner, thresholdKeep, thresholdDrop]),
      "",
      { rand: () => rolls.shift() ?? 0 },
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Threshold Keep"]);
  });

  it("includes recursive matches when resolving inclusion groups", () => {
    const direct = entry({
      title: "Direct",
      strategy: "selective",
      key: ["gate"],
      body: "Hidden sigil.",
      inclusionGroup: "variant",
      insertionOrder: 10,
      prioritizeInclusion: true,
    });
    const recursive = entry({
      title: "Recursive",
      strategy: "selective",
      key: ["hidden sigil"],
      inclusionGroup: "variant",
      insertionOrder: 100,
    });

    const activated = activateLorebookEntries(
      lorebook([direct, recursive], { recursiveScan: true }),
      "Open the gate.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Recursive"]);
    expect(activated[0]?.activationSource).toBe("recursion");
  });

  it("lets entries seed recursion before probability filters them out", () => {
    const parent = entry({
      title: "Parent",
      strategy: "selective",
      key: ["gate"],
      body: "Hidden sigil.",
      probability: 0,
    });
    const child = entry({
      title: "Child",
      strategy: "selective",
      key: ["hidden sigil"],
      probability: 100,
    });
    const rolls = [0.9, 0];

    const activated = activateLorebookEntries(
      lorebook([parent, child], { recursiveScan: true }),
      "Open the gate.",
      { rand: () => rolls.shift() ?? 0 },
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Child"]);
    expect(activated[0]?.activationSource).toBe("recursion");
  });

  it("recursively activates entries from activated entry bodies without loops", () => {
    const bessie = entry({
      title: "Bessie",
      strategy: "selective",
      key: ["bessie"],
      body: "Bessie knows Rufus.",
    });
    const rufus = entry({
      title: "Rufus",
      strategy: "selective",
      key: ["rufus"],
      body: "Rufus knows Bessie.",
    });

    const activated = activateLorebookEntries(
      lorebook([bessie, rufus], { recursiveScan: true }),
      "Bessie arrives.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Bessie", "Rufus"]);
    expect(activated.map((item) => item.activationSource)).toEqual(["direct", "recursion"]);
  });

  it("skips recursive activation when recursive scan is disabled", () => {
    const starter = entry({
      title: "Starter",
      strategy: "selective",
      key: ["gate"],
      body: "Hidden sigil.",
    });
    const hidden = entry({
      title: "Hidden",
      strategy: "selective",
      key: ["hidden sigil"],
    });

    const activated = activateLorebookEntries(
      lorebook([starter, hidden], { recursiveScan: false }),
      "Open the gate.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Starter"]);
  });

  it("does not activate non-recursable entries from recursion scans", () => {
    const starter = entry({
      title: "Starter",
      strategy: "selective",
      key: ["gate"],
      body: "Hidden sigil.",
    });
    const hidden = entry({
      title: "Hidden",
      strategy: "selective",
      key: ["hidden sigil"],
      recursion: {
        nonRecursable: true,
        preventFurther: false,
        delayUntilRecursion: false,
        recursionLevel: 0,
      },
    });

    const activated = activateLorebookEntries(
      lorebook([starter, hidden], { recursiveScan: true }),
      "Open the gate.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Starter"]);
    expect(
      activateLorebookEntries(lorebook([hidden], { recursiveScan: true }), "Hidden sigil.").map(
        (item) => item.entry.title,
      ),
    ).toEqual(["Hidden"]);
  });

  it("keeps prevent-further entry bodies out of later recursion scans", () => {
    const starter = entry({
      title: "Starter",
      strategy: "selective",
      key: ["gate"],
      body: "Hidden sigil.",
      recursion: {
        nonRecursable: false,
        preventFurther: true,
        delayUntilRecursion: false,
        recursionLevel: 0,
      },
    });
    const hidden = entry({
      title: "Hidden",
      strategy: "selective",
      key: ["hidden sigil"],
    });

    const activated = activateLorebookEntries(
      lorebook([starter, hidden], { recursiveScan: true }),
      "Open the gate.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Starter"]);
  });

  it("opens delayed recursion levels only after the current level is stable", () => {
    const starter = entry({
      title: "Starter",
      strategy: "selective",
      key: ["gate"],
      body: "Bridge sigil.",
    });
    const bridge = entry({
      title: "Bridge",
      strategy: "selective",
      key: ["bridge sigil"],
      body: "Delayed sigil.",
    });
    const delayed = entry({
      title: "Delayed",
      strategy: "selective",
      key: ["delayed sigil"],
      recursion: {
        nonRecursable: false,
        preventFurther: false,
        delayUntilRecursion: true,
        recursionLevel: 1,
      },
    });

    const activated = activateLorebookEntries(
      lorebook([starter, bridge, delayed], { recursiveScan: true }),
      "Open the gate.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Starter", "Bridge", "Delayed"]);
    expect(activated[2]).toMatchObject({
      activationSource: "recursion",
      recursionLevel: 1,
    });
  });

  it("lets delayed entries match the grown recursion scan surface", () => {
    const starter = entry({
      title: "Starter",
      strategy: "selective",
      key: ["gate"],
      body: "Recursion has started.",
    });
    const delayed = entry({
      title: "Delayed",
      strategy: "selective",
      key: ["sealed vault"],
      recursion: {
        nonRecursable: false,
        preventFurther: false,
        delayUntilRecursion: true,
        recursionLevel: 1,
      },
    });

    const activated = activateLorebookEntries(
      lorebook([starter, delayed], { recursiveScan: true }),
      "Open the gate near the sealed vault.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Starter", "Delayed"]);
  });

  it("keeps delayed recursion probes on first-match primary matching", () => {
    const RealRegExp = RegExp;
    const regexpSpy = vi.fn(function (pattern: string | RegExp = "", flags?: string) {
      return new RealRegExp(pattern, flags);
    });
    vi.stubGlobal("RegExp", regexpSpy);

    try {
      const starter = entry({
        title: "Starter",
        strategy: "constant",
        body: "Seed sigil.",
      });
      const bridge = entry({
        title: "Bridge",
        strategy: "selective",
        key: ["seed sigil"],
        body: "Next sigil.",
      });
      const delayed = entry({
        title: "Delayed",
        strategy: "selective",
        key: ["/next sigil/", "/expensive probe/"],
        inclusionGroup: "variant",
        recursion: {
          nonRecursable: false,
          preventFurther: false,
          delayUntilRecursion: true,
          recursionLevel: 1,
        },
      });

      const activation = activateLorebookEntriesWithWarnings(
        lorebook([starter, bridge, delayed], {
          recursiveScan: true,
          maxRecursionSteps: 1,
          useGroupScoring: true,
        }),
        "",
      );

      expect(activation.entries.map((item) => item.entry.title)).toEqual(["Starter", "Bridge"]);
      expect(regexpSpy.mock.calls.some(([pattern]) => pattern === "expensive probe")).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("delays constant entries until their recursion level opens", () => {
    const starter = entry({
      title: "Starter",
      strategy: "selective",
      key: ["gate"],
      body: "Recursion has started.",
    });
    const delayedConstant = entry({
      title: "Delayed Constant",
      strategy: "constant",
      recursion: {
        nonRecursable: false,
        preventFurther: false,
        delayUntilRecursion: true,
        recursionLevel: 1,
      },
    });

    const activated = activateLorebookEntries(
      lorebook([starter, delayedConstant], { recursiveScan: true }),
      "Open the gate.",
    );

    expect(activated.map((item) => item.entry.title)).toEqual(["Starter", "Delayed Constant"]);
    expect(activated[1]).toMatchObject({
      activationSource: "recursion",
      matchReason: "constant",
      recursionLevel: 1,
    });
  });

  it("warns and stops runaway recursion at the hard pass cap", () => {
    const chain = Array.from({ length: 66 }, (_, index) =>
      entry({
        title: `Chain ${index}`,
        strategy: "selective",
        key: [`chain-${index}`],
        body: index < 65 ? `chain-${index + 1}` : "Done.",
      }),
    );

    const activation = activateLorebookEntriesWithWarnings(
      lorebook(chain, { recursiveScan: true, maxRecursionSteps: 0 }),
      "chain-0",
    );

    expect(activation.entries.map((item) => item.entry.title)).toHaveLength(65);
    expect(activation.entries.at(-1)?.entry.title).toBe("Chain 64");
    expect(activation.warnings[0]).toContain("recursion stopped after 64 passes");
  });

  it("does not warn when the hard-cap pass activates the last eligible entry", () => {
    const chain = Array.from({ length: 65 }, (_, index) =>
      entry({
        title: `Chain ${index}`,
        strategy: "selective",
        key: [`chain-${index}`],
        body: index < 64 ? `chain-${index + 1}` : "Done.",
      }),
    );
    const inactive = entry({
      title: "Non-recursable",
      strategy: "selective",
      key: ["done"],
      recursion: {
        nonRecursable: true,
        preventFurther: false,
        delayUntilRecursion: false,
        recursionLevel: 0,
      },
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([...chain, inactive], { recursiveScan: true, maxRecursionSteps: 0 }),
      "chain-0",
    );

    expect(activation.entries.map((item) => item.entry.title)).toHaveLength(65);
    expect(activation.entries.at(-1)?.entry.title).toBe("Chain 64");
    expect(activation.warnings).toEqual([]);
  });

  it("does not warn when hard-cap completion leaves only unmatched recursable entries", () => {
    const chain = Array.from({ length: 65 }, (_, index) =>
      entry({
        title: `Chain ${index}`,
        strategy: "selective",
        key: [`chain-${index}`],
        body: index < 64 ? `chain-${index + 1}` : "Done.",
      }),
    );
    const unmatched = entry({
      title: "Unmatched",
      strategy: "selective",
      key: ["missing sigil"],
    });
    const delayedUnmatched = entry({
      title: "Delayed Unmatched",
      strategy: "selective",
      key: ["missing delayed sigil"],
      recursion: {
        nonRecursable: false,
        preventFurther: false,
        delayUntilRecursion: true,
        recursionLevel: 1,
      },
    });

    const activation = activateLorebookEntriesWithWarnings(
      lorebook([...chain, unmatched, delayedUnmatched], {
        recursiveScan: true,
        maxRecursionSteps: 0,
      }),
      "chain-0",
    );

    expect(activation.entries.map((item) => item.entry.title)).toHaveLength(65);
    expect(activation.entries.at(-1)?.entry.title).toBe("Chain 64");
    expect(activation.warnings).toEqual([]);
  });

  it("honors the configured max recursion steps before the hard cap", () => {
    const chain = Array.from({ length: 6 }, (_, index) =>
      entry({
        title: `Chain ${index}`,
        strategy: "selective",
        key: [`chain-${index}`],
        body: index < 5 ? `chain-${index + 1}` : "Done.",
      }),
    );

    const activation = activateLorebookEntriesWithWarnings(
      lorebook(chain, { recursiveScan: true, maxRecursionSteps: 3 }),
      "chain-0",
    );

    expect(activation.entries.map((item) => item.entry.title)).toEqual([
      "Chain 0",
      "Chain 1",
      "Chain 2",
      "Chain 3",
    ]);
    expect(activation.warnings).toEqual([]);
  });

  it("lets direct matches outrank recursive matches when applying token budgets", () => {
    const direct = entry({
      title: "Direct",
      strategy: "selective",
      key: ["gate"],
      body: "Recursive sigil.",
      insertionOrder: 10,
    });
    const recursive = entry({
      title: "Recursive",
      strategy: "selective",
      key: ["recursive sigil"],
      insertionOrder: 100,
    });
    const activated = activateLorebookEntries(
      lorebook([direct, recursive], { recursiveScan: true }),
      "Open the gate.",
    );

    const budgeted = applyTokenBudget(activated, {
      budgetTokens: 1,
      approxTokens: () => 1,
    });

    expect(budgeted.map((item) => item.entry.title)).toEqual(["Direct"]);
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

    expect(budgeted.map((item) => item.entry.title)).toEqual(["High", "Medium", "Constant"]);
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
    const firstLorebookEntries = activateLorebookEntries(lorebook([firstEntry, secondEntry]), "", {
      sourceOrder: 0,
    });
    const secondLorebookEntries = activateLorebookEntries(lorebook([secondSource]), "", {
      sourceOrder: 1,
    });

    const budgeted = applyTokenBudget([...secondLorebookEntries, ...firstLorebookEntries], {
      budgetTokens: 2,
      approxTokens: () => 1,
    });

    expect(budgeted.map((item) => item.entry.title)).toEqual(["First Entry", "Second Entry"]);
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
