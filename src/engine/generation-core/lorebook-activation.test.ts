import { describe, expect, it, vi } from "vitest";

import {
  activateLorebookEntries,
  activateLorebookEntriesWithWarnings,
  applyTokenBudget,
  buildMatchSources,
  buildScanBuffer,
  matchKey,
  sortActivatedEntries,
} from "./lorebook-activation";
import { createLorebookEntryRecord, createLorebookRecord } from "../catalog/lorebook-actions";
import type { LorebookRecord } from "../contracts/types/lorebook";
import type { CharacterRecord } from "../contracts/types/character";
import type { PersonaRecord } from "../contracts/types/persona";

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
      sortActivatedEntries([...firstLorebookEntries, ...secondLorebookEntries]).map(
        (item) => item.entry.title,
      ),
    ).toEqual(["High Other Source", "Tied First", "Tied Second", "Low"]);
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
