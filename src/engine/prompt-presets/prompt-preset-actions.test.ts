import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPromptPresetRecord,
  createImportedPromptPresetRecord,
  duplicatePromptPresetRecord,
  materializePromptPresetThreadChoiceSelections,
  normalizePromptPresetRecord as normalizePromptPresetRecordRaw,
  normalizePromptPresetThreadChoiceSelections,
  normalizePromptPresetThreadChoiceSelectionsWithChange,
  prunePromptPresetThreadChoiceSelections,
  resolvePromptPresetChoiceControls,
  resolvePromptPresetChoiceVariables,
  updatePromptPresetChoiceSelections,
  updatePromptPresetRecord,
} from "./prompt-preset-actions";

const now = "2026-07-08T00:00:00.000Z";

function validPromptPresetRecord(input: Record<string, unknown>) {
  return normalizePromptPresetRecordRaw({
    id: "preset-test",
    schemaVersion: 2,
    name: "Test preset",
    messengerPrompt: "",
    sectionOrder: [],
    groupOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    sections: [],
    groups: [],
    choiceBlocks: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  });
}

describe("normalizePromptPresetRecord", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects obsolete native v1 and unknown fields", () => {
    expect(normalizePromptPresetRecordRaw({ schemaVersion: 1 })).toBeNull();
    expect(normalizePromptPresetRecordRaw({ unknownField: "unsupported field" })).toBeNull();
  });

  it("rejects an omitted required Messenger prompt", () => {
    expect(
      normalizePromptPresetRecordRaw({
        id: "promptless",
        schemaVersion: 2,
        name: "Promptless",
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeNull();
  });

  it("normalizes a blank Messenger prompt to an empty persisted prompt", () => {
    const record = validPromptPresetRecord({
      id: "promptless",
      schemaVersion: 2,
      name: "Promptless",
      messengerPrompt: "   ",
      createdAt: now,
      updatedAt: now,
    });

    expect(record?.messengerPrompt).toBe("");
  });

  it("rejects a null flat Messenger prompt", () => {
    expect(validPromptPresetRecord({ messengerPrompt: null })).toBeNull();
  });

  it.each([42, {}, [], true])("rejects malformed prompt value %j", (messengerPrompt) => {
    expect(
      validPromptPresetRecord({
        id: "malformed-prompt",
        schemaVersion: 2,
        name: "Malformed Prompt",
        messengerPrompt,
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeNull();
  });

  it("rejects the removed sampling source instead of silently erasing it", () => {
    expect(
      validPromptPresetRecord({
        id: "removed-sampling",
        schemaVersion: 2,
        name: "Removed Sampling",
        sampling: { temperature: 0.7 },
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeNull();
  });

  it.each([
    ["scalar parameters", { temperature: 0.7 }],
    ["removed enabledParameters", { enabledParameters: { temperature: true } }],
    ["JSON-string standard entry", { temperature: '{"send":true,"value":0.7}' }],
    ["noncanonical stop value", { stopSequences: { send: true, value: ["  END  "] } }],
  ])("rejects malformed native %s", (_label, parameters) => {
    expect(
      validPromptPresetRecord({
        id: "malformed-parameters",
        schemaVersion: 2,
        name: "Malformed Parameters",
        parameters,
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeNull();
  });

  it.each([[undefined], [null]])("accepts omitted or null parameters: %j", (parameters) => {
    const value: Record<string, unknown> = {
      id: "empty-parameters",
      schemaVersion: 2,
      name: "Empty Parameters",
      createdAt: now,
      updatedAt: now,
    };
    if (parameters !== undefined) value.parameters = parameters;

    expect(validPromptPresetRecord(value)?.parameters).toBeNull();
  });

  it("rejects omitted required recipe arrays", () => {
    const record = normalizePromptPresetRecordRaw({
      id: "minimal-promptless",
      schemaVersion: 2,
      name: "Minimal Promptless",
      createdAt: now,
      updatedAt: now,
    });

    expect(record).toBeNull();
  });

  it.each(["sections", "groups", "choiceBlocks"])(
    "rejects an explicitly malformed %s collection",
    (field) => {
      expect(
        validPromptPresetRecord({
          id: "malformed-recipe",
          schemaVersion: 2,
          name: "Malformed Recipe",
          [field]: {},
          createdAt: now,
          updatedAt: now,
        }),
      ).toBeNull();
    },
  );

  it.each([
    [
      "section",
      (base: Record<string, unknown>) => ({
        ...base,
        sections: [
          {
            id: "section",
            identifier: "section",
            name: "Section",
            content: "",
            role: "system",
            enabled: true,
            isMarker: false,
            unexpected: true,
          },
        ],
      }),
    ],
    [
      "group",
      (base: Record<string, unknown>) => ({
        ...base,
        groups: [{ id: "group", name: "Group", unexpected: true }],
      }),
    ],
    [
      "choice block",
      (base: Record<string, unknown>) => ({
        ...base,
        choiceBlocks: [
          {
            id: "choice",
            variableName: "tone",
            options: [{ id: "warm", label: "Warm", value: "warm" }],
            unexpected: true,
          },
        ],
      }),
    ],
    [
      "choice option",
      (base: Record<string, unknown>) => ({
        ...base,
        choiceBlocks: [
          {
            id: "choice",
            variableName: "tone",
            options: [{ id: "warm", label: "Warm", value: "warm", unexpected: true }],
          },
        ],
      }),
    ],
    [
      "marker config",
      (base: Record<string, unknown>) => ({
        ...base,
        sections: [
          {
            id: "section",
            identifier: "section",
            name: "Section",
            content: "",
            role: "system",
            enabled: true,
            isMarker: true,
            markerConfig: { type: "chat_history", unexpected: true },
          },
        ],
      }),
    ],
    [
      "default option selection",
      (base: Record<string, unknown>) => ({
        ...base,
        defaultChoices: { tone: { kind: "option", optionId: "warm", unexpected: true } },
        choiceBlocks: [
          {
            id: "choice",
            variableName: "tone",
            options: [{ id: "warm", label: "Warm", value: "warm" }],
          },
        ],
      }),
    ],
  ])("rejects unknown nested %s fields", (_label, mutate) => {
    const base: Record<string, unknown> = {
      id: "nested-unknown",
      schemaVersion: 2,
      name: "Nested Unknown",
      messengerPrompt: "",
      sectionOrder: [],
      groupOrder: [],
      variableGroups: [],
      variableValues: {},
      defaultChoices: {},
      sections: [],
      groups: [],
      choiceBlocks: [],
      createdAt: now,
      updatedAt: now,
    };
    expect(validPromptPresetRecord(mutate(base))).toBeNull();
  });

  it.each([
    [
      "section role",
      {
        sections: [
          {
            id: "section",
            identifier: "section",
            name: "Section",
            content: "",
            role: "narrator",
            enabled: true,
            isMarker: false,
          },
        ],
      },
    ],
    [
      "marker configuration",
      {
        sections: [
          {
            id: "section",
            identifier: "history",
            name: "History",
            content: "",
            role: "system",
            enabled: true,
            isMarker: true,
            markerConfig: {
              type: "chat_history",
              chatHistoryOptions: { includeSystemMessages: "true" },
            },
          },
        ],
      },
    ],
    [
      "section boolean",
      {
        sections: [
          {
            id: "section",
            identifier: "section",
            name: "Section",
            content: "",
            role: "system",
            enabled: "true",
            isMarker: false,
          },
        ],
      },
    ],
    [
      "choice option",
      {
        choiceBlocks: [
          {
            id: "choice",
            variableName: "tone",
            label: "Tone",
            options: [{ id: "warm", label: "Warm", value: 42 }],
          },
        ],
      },
    ],
    [
      "default option selection",
      {
        defaultChoices: { tone: { kind: "option", optionId: "" } },
      },
    ],
  ])("rejects malformed native nested %s values", (_label, nested) => {
    expect(validPromptPresetRecord(nested)).toBeNull();
  });

  it("preserves the full marker config shape", () => {
    const record = validPromptPresetRecord({
      sections: [
        {
          id: "marker",
          identifier: "marker",
          name: "Marker",
          content: "",
          role: "system",
          enabled: true,
          isMarker: true,
          markerConfig: {
            type: "chat_history",
            characterFields: ["name"],
            lorebookFormat: "full",
            chatHistoryOptions: { maxMessages: 12, includeSystemMessages: true },
            agentType: "npc",
          },
        },
      ],
    });
    expect(record?.sections[0]?.markerConfig).toEqual({
      type: "chat_history",
      characterFields: ["name"],
      lorebookFormat: "full",
      chatHistoryOptions: { maxMessages: 12, includeSystemMessages: true },
      agentType: "npc",
    });
  });

  it.each([undefined, null, "", "   "])("rejects missing or blank name %j", (name) => {
    const base = validPromptPresetRecord({ id: "missing-name" });
    expect(normalizePromptPresetRecordRaw({ ...base, name })).toBeNull();
  });

  it("creates and updates promptless records without injecting fallback text", () => {
    const created = createPromptPresetRecord({
      id: "promptless",
      input: { name: "Promptless" },
      now,
    });

    expect(created.messengerPrompt).toBe("");
    expect(
      updatePromptPresetRecord(created, { name: "Promptless", messengerPrompt: "" }, now)
        .messengerPrompt,
    ).toBe("");
  });

  it("rejects malformed prompt preset timestamps", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Write the next response.",
      createdAt: "not-a-date",
      updatedAt: "also-not-a-date",
    });

    expect(record).toBeNull();
  });

  it("rejects native references that normalization would otherwise drop", () => {
    expect(
      validPromptPresetRecord({
        sections: [
          {
            id: "section",
            identifier: "section",
            name: "Section",
            content: "",
            role: "system",
            enabled: true,
            isMarker: false,
            groupId: "missing-group",
          },
        ],
      }),
    ).toBeNull();
    expect(validPromptPresetRecord({ sectionOrder: ["missing-section"] })).toBeNull();
  });

  it.each([
    ["non-string variable value", { variableValues: { tone: 42 } }],
    [
      "duplicate choice block id",
      {
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [{ id: "warm", label: "Warm", value: "warm" }],
          },
          {
            id: "choice-tone",
            variableName: "tone-copy",
            label: "Tone copy",
            options: [{ id: "cool", label: "Cool", value: "cool" }],
          },
        ],
      },
    ],
    [
      "nested default selection array",
      {
        defaultChoices: { tone: [["warm"]] },
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [{ id: "warm", label: "Warm", value: "warm" }],
          },
        ],
      },
    ],
  ])("rejects native %s", (_label, invalid) => {
    expect(validPromptPresetRecord(invalid)).toBeNull();
  });

  it("accepts an intentionally empty top-level multi-select default", () => {
    const record = validPromptPresetRecord({
      defaultChoices: { tones: [] },
      choiceBlocks: [
        {
          id: "choice-tones",
          variableName: "tones",
          label: "Tones",
          multiSelect: true,
          options: [{ id: "warm", label: "Warm", value: "warm" }],
        },
      ],
    });
    expect(record?.defaultChoices).toEqual({ tones: [] });
  });

  it("rejects duplicate native choice option IDs", () => {
    expect(
      validPromptPresetRecord({
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [
              { id: "warm", label: "Warm", value: "warm" },
              { id: "warm", label: "Also warm", value: "warm-2" },
            ],
          },
        ],
      }),
    ).toBeNull();
  });

  it("removes whitespace-only choice separators", () => {
    const record = validPromptPresetRecord({
      id: "preset-whitespace-separator",
      schemaVersion: 2,
      name: "Whitespace separator",
      messengerPrompt: "Write the next response.",
      choiceBlocks: [
        {
          id: "choice-tags",
          variableName: "tags",
          label: "Tags",
          options: [{ id: "tag-vivid", label: "Vivid", value: "vivid" }],
          separator: "   ",
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record?.choiceBlocks[0]).not.toHaveProperty("separator");
  });

  it("normalizes XML tag names only for non-marker sections", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Write the next response.",
      sections: [
        {
          id: "section-marker",
          identifier: "world_info_before",
          name: "World Info Before",
          content: "",
          role: "system",
          enabled: true,
          isMarker: true,
          markerConfig: { type: "world_info_before" },
          xmlTagName: "legacy_before",
        },
        {
          id: "section-role",
          identifier: "role",
          name: "Role",
          content: "Stay in character.",
          role: "system",
          enabled: true,
          isMarker: false,
          xmlTagName: "role_tag",
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record?.sections[0]).not.toHaveProperty("xmlTagName");
    expect(record?.sections[1]?.xmlTagName).toBe("role_tag");
  });

  it("rejects duplicate choice options", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Write with {{pacing}}.",
      choiceBlocks: [
        {
          id: "choice-pacing",
          variableName: "pacing",
          label: "Pacing",
          options: [
            { id: "slow", label: "Slow", value: "slow burn" },
            { id: "fast", label: "Fast", value: "snappy" },
            { id: "fast", label: "Duplicate", value: "ignored" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).toBeNull();
  });

  it("resolves default and selected choice values by variable name", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Write with {{pacing}} and {{tone}}.",
      defaultChoices: { pacing: { kind: "option", optionId: "fast" } },
      choiceBlocks: [
        {
          id: "choice-pacing",
          variableName: "pacing",
          label: "Pacing",
          options: [
            { id: "fast", label: "Fast", value: "snappy" },
            { id: "slow", label: "Slow", value: "slow burn" },
          ],
        },
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          options: [{ id: "warm", label: "Warm", value: "warm" }],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections: {
          "choice-pacing": { kind: "option", optionId: "slow" },
          "choice-tone": { kind: "option", optionId: "missing" },
        },
      }),
    ).toEqual({
      variables: {
        pacing: "slow burn",
        tone: "warm",
      },
      variableNames: ["pacing", "tone"],
    });
  });

  it("rejects default choices that normalization would otherwise prune", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Write with {{tone}}.",
      defaultChoices: {
        skipped: "ghost",
        tone: ["warm prose", "missing", "tone-cold"],
      },
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          options: [
            { id: "tone-warm", label: "Warm", value: "warm prose" },
            { id: "tone-cold", label: "Cold", value: "cold prose" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).toBeNull();
  });

  it("resolves preset variables and multi-select choice values", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Use {{baseTone}} and {{motifs}}.",
      variableValues: {
        baseTone: "grounded",
      },
      choiceBlocks: [
        {
          id: "choice-motifs",
          variableName: "motifs",
          label: "Motifs",
          options: [
            { id: "rain", label: "Rain", value: "rain on glass" },
            { id: "neon", label: "Neon", value: "neon signs" },
          ],
          multiSelect: true,
          separator: " / ",
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections: {
          "choice-motifs": [
            { kind: "option", optionId: "rain" },
            { kind: "option", optionId: "neon" },
          ],
        },
      }),
    ).toEqual({
      variables: {
        baseTone: "grounded",
        motifs: "rain on glass / neon signs",
      },
      variableNames: ["baseTone", "motifs"],
    });
  });

  it("builds ordered visible choice controls for thread settings UI", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Use {{boundary}} and {{motifs}}.",
      defaultChoices: {
        boundary: "sfw",
        hiddenTone: "soft",
        motifs: ["rain", "neon"],
      },
      choiceBlocks: [
        {
          id: "choice-hidden",
          variableName: "hiddenTone",
          label: "Hidden tone",
          options: [
            { id: "soft", label: "Soft", value: "soft" },
            { id: "direct", label: "Direct", value: "direct" },
          ],
        },
        {
          id: "choice-motifs",
          variableName: "motifs",
          label: "Motifs",
          options: [
            { id: "rain", label: "Rain", value: "rain" },
            { id: "neon", label: "Neon", value: "neon" },
            { id: "static", label: "Static", value: "static" },
          ],
          multiSelect: true,
        },
        {
          id: "choice-boundary",
          variableName: "boundary",
          label: "Boundary",
          options: [
            { id: "sfw", label: "SFW", value: "SFW" },
            { id: "adult", label: "Adult", value: "Adult" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).not.toBeNull();
    if (!record) throw new Error("Expected prompt preset record.");

    expect(
      resolvePromptPresetChoiceControls({
        preset: record,
        selections: {
          "choice-boundary": { kind: "option", optionId: "sfw" },
          "choice-hidden": { kind: "option", optionId: "direct" },
          "choice-motifs": [
            { kind: "option", optionId: "static" },
            { kind: "option", optionId: "missing" },
          ],
        },
      }),
    ).toEqual([
      {
        id: "choice-hidden",
        variableName: "hiddenTone",
        label: "Hidden tone",
        multiSelect: false,
        displayMode: "auto",
        defaultLabel: "Preset default: Soft",
        selectedOptionIds: ["direct"],
        selectedValues: ["direct"],
        options: [
          {
            id: "soft",
            label: "Soft",
            value: "soft",
            selection: { kind: "option", optionId: "soft" },
          },
          {
            id: "direct",
            label: "Direct",
            value: "direct",
            selection: { kind: "option", optionId: "direct" },
          },
        ],
      },
      {
        id: "choice-motifs",
        variableName: "motifs",
        label: "Motifs",
        multiSelect: true,
        displayMode: "auto",
        defaultLabel: "Preset default: Rain, Neon",
        selectedOptionIds: ["static"],
        selectedValues: ["static"],
        options: [
          {
            id: "rain",
            label: "Rain",
            value: "rain",
            selection: { kind: "option", optionId: "rain" },
          },
          {
            id: "neon",
            label: "Neon",
            value: "neon",
            selection: { kind: "option", optionId: "neon" },
          },
          {
            id: "static",
            label: "Static",
            value: "static",
            selection: { kind: "option", optionId: "static" },
          },
        ],
      },
      {
        id: "choice-boundary",
        variableName: "boundary",
        label: "Boundary",
        multiSelect: false,
        displayMode: "auto",
        defaultLabel: "Preset default: SFW",
        selectedOptionIds: ["sfw"],
        selectedValues: ["SFW"],
        options: [
          { id: "sfw", label: "SFW", value: "SFW", selection: { kind: "option", optionId: "sfw" } },
          {
            id: "adult",
            label: "Adult",
            value: "Adult",
            selection: { kind: "option", optionId: "adult" },
          },
        ],
      },
    ]);
  });

  it("keeps option identity when a selected choice value is empty", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Use {{tone}}.",
      defaultChoices: { tone: { kind: "option", optionId: "none" } },
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          options: [
            { id: "none", label: "None", value: "" },
            { id: "loud", label: "Loud", value: "loud" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).not.toBeNull();
    if (!record) throw new Error("Expected prompt preset record.");

    expect(
      resolvePromptPresetChoiceControls({
        preset: record,
        selections: { "choice-tone": { kind: "option", optionId: "none" } },
      }),
    ).toEqual([
      {
        id: "choice-tone",
        variableName: "tone",
        label: "Tone",
        multiSelect: false,
        displayMode: "auto",
        defaultLabel: "Preset default: None",
        selectedOptionIds: ["none"],
        selectedValues: [""],
        options: [
          { id: "none", label: "None", value: "", selection: { kind: "option", optionId: "none" } },
          {
            id: "loud",
            label: "Loud",
            value: "loud",
            selection: { kind: "option", optionId: "loud" },
          },
        ],
      },
    ]);
    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections: { "choice-tone": { kind: "option", optionId: "none" } },
      }),
    ).toEqual({
      variables: {
        tone: "",
      },
      variableNames: ["tone"],
    });
  });

  it("projects choice display mode and alphabetical option order without changing identity", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Use {{tone}}.",
      defaultChoices: { tone: { kind: "option", optionId: "alpha" } },
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          question: "How should the reply feel?",
          displayMode: "buttons",
          optionSort: "alphabetical",
          options: [
            { id: "zebra", label: "Zebra", value: "zebra" },
            { id: "alpha", label: "alpha", value: "alpha" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).not.toBeNull();
    if (!record) throw new Error("Expected prompt preset record.");

    const [control] = resolvePromptPresetChoiceControls({ preset: record, selections: {} });

    expect(control?.question).toBe("How should the reply feel?");
    expect(control?.displayMode).toBe("buttons");
    expect(control?.options.map((option) => [option.id, option.label])).toEqual([
      ["alpha", "alpha"],
      ["zebra", "Zebra"],
    ]);
  });

  it("resolves non-empty value-based selections before option ids", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Use {{tone}}.",
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          options: [
            { id: "soft", label: "Soft", value: "quiet" },
            { id: "quiet", label: "Loud", value: "loud" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).not.toBeNull();
    if (!record) throw new Error("Expected prompt preset record.");

    expect(
      resolvePromptPresetChoiceControls({
        preset: record,
        selections: { "choice-tone": { kind: "option", optionId: "soft" } },
      })[0]?.selectedOptionIds,
    ).toEqual(["soft"]);
    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections: { "choice-tone": { kind: "option", optionId: "soft" } },
      }).variables,
    ).toEqual({ tone: "quiet" });
  });

  it("resolves control selections as option ids", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Use {{tone}}.",
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          options: [
            { id: "none", label: "None", value: "" },
            { id: "loud", label: "Loud", value: "loud" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).not.toBeNull();
    if (!record) throw new Error("Expected prompt preset record.");

    const noneSelection = resolvePromptPresetChoiceControls({ preset: record, selections: {} })
      .flatMap((control) => control.options)
      .find((option) => option.id === "none")?.selection;

    expect(noneSelection).toEqual({ kind: "option", optionId: "none" });
    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections: noneSelection ? { "choice-tone": noneSelection } : {},
      }),
    ).toEqual({
      variables: {
        tone: "",
      },
      variableNames: ["tone"],
    });
  });

  it("deduplicates generated values without collapsing selected option ids", () => {
    const record = validPromptPresetRecord({
      id: "preset-1",
      schemaVersion: 2,
      name: "Preset One",
      messengerPrompt: "Use {{tags}}.",
      choiceBlocks: [
        {
          id: "choice-tags",
          variableName: "tags",
          label: "Tags",
          multiSelect: true,
          options: [
            { id: "left", label: "Left", value: "shared" },
            { id: "right", label: "Right", value: "shared" },
            { id: "sharp", label: "Sharp", value: "sharp" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).not.toBeNull();
    if (!record) throw new Error("Expected prompt preset record.");

    const selections = {
      "choice-tags": [
        { kind: "option" as const, optionId: "left" },
        { kind: "option" as const, optionId: "right" },
        { kind: "option" as const, optionId: "sharp" },
      ],
    };

    expect(
      resolvePromptPresetChoiceControls({
        preset: record,
        selections,
      })[0]?.selectedOptionIds,
    ).toEqual(["left", "right", "sharp"]);
    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections,
      }),
    ).toEqual({
      variables: {
        tags: "shared, sharp",
      },
      variableNames: ["tags"],
    });
  });

  it("updates prompt preset choice selections without mutating the input record", () => {
    const preset = createPromptPresetRecord({
      id: "preset-selections",
      now,
      input: {
        name: "Selections",
        messengerPrompt: "Use choices.",
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [
              { id: "soft", label: "Soft", value: "soft" },
              { id: "none", label: "None", value: "" },
            ],
          },
          {
            id: "choice-motifs",
            variableName: "motifs",
            label: "Motifs",
            multiSelect: true,
            options: [
              { id: "rain", label: "Rain", value: "rain" },
              { id: "neon", label: "Neon", value: "neon" },
              { id: "static", label: "Static", value: "static" },
            ],
          },
        ],
      },
    });
    const selections = {
      "choice-motifs": [
        { kind: "option" as const, optionId: "rain" },
        { kind: "option" as const, optionId: "neon" },
      ],
      "choice-tone": { kind: "option" as const, optionId: "soft" },
    };

    expect(updatePromptPresetChoiceSelections(preset, selections, " choice-tone ", null)).toEqual({
      "choice-motifs": [
        { kind: "option", optionId: "rain" },
        { kind: "option", optionId: "neon" },
      ],
    });
    expect(
      updatePromptPresetChoiceSelections(preset, selections, " choice-motifs ", [
        { kind: "option", optionId: " static " },
      ]),
    ).toEqual({
      "choice-motifs": [{ kind: "option", optionId: "static" }],
      "choice-tone": { kind: "option", optionId: "soft" },
    });
    expect(selections).toEqual({
      "choice-motifs": [
        { kind: "option", optionId: "rain" },
        { kind: "option", optionId: "neon" },
      ],
      "choice-tone": { kind: "option", optionId: "soft" },
    });
  });
});

describe("updatePromptPresetRecord", () => {
  it("preserves typed parameters, including omission tombstones, when omitted", () => {
    const record = createPromptPresetRecord({
      id: "preset-1",
      now,
      input: {
        name: "Preset One",
        description: "Rich preset",
        messengerPrompt: "Write the next response.",
        parameters: {
          maxTokens: { send: true, value: 400 },
          temperature: { send: false, value: 0.8 },
          topP: { send: true, value: 0.9 },
          topK: { send: true, value: 42 },
          maxContext: 100_000,
          stopSequences: { send: true, value: ["END"] },
          strictRoleFormatting: true,
        },
      },
    });

    const updated = updatePromptPresetRecord(
      record,
      {
        name: record.name,
        description: record.description,
        messengerPrompt: record.messengerPrompt,
      },
      "2026-07-08T01:00:00.000Z",
    );

    expect(updated.parameters).toEqual({
      maxTokens: { send: true, value: 400 },
      temperature: { send: false, value: 0.8 },
      topP: { send: true, value: 0.9 },
      topK: { send: true, value: 42 },
      maxContext: 100_000,
      stopSequences: { send: true, value: ["END"] },
      strictRoleFormatting: true,
    });
  });

  it("replaces rich parameters when parameters are provided", () => {
    const record = createPromptPresetRecord({
      id: "preset-1",
      now,
      input: {
        name: "Preset One",
        messengerPrompt: "Write the next response.",
        parameters: {
          temperature: { send: true, value: 0.8 },
          topK: { send: true, value: 42 },
          stopSequences: { send: true, value: ["END"] },
        },
      },
    });

    const updated = updatePromptPresetRecord(
      record,
      {
        name: record.name,
        description: record.description,
        messengerPrompt: record.messengerPrompt,
        parameters: {
          temperature: { send: false, value: 1.1 },
        },
      },
      "2026-07-08T01:00:00.000Z",
    );

    expect(updated.parameters).toEqual({
      temperature: { send: false, value: 1.1 },
    });
  });
});

describe("duplicatePromptPresetRecord", () => {
  it("rewrites nested prompt preset ids to the duplicate id", () => {
    const record = createPromptPresetRecord({
      id: "preset-original",
      now,
      input: {
        name: "Preset One",
        messengerPrompt: "Write the next response.",
        sections: [
          {
            id: "section-system",
            presetId: "preset-original",
            identifier: "system",
            name: "System",
            content: "Write clearly.",
            role: "system",
            enabled: true,
            isMarker: false,
          },
        ],
        groups: [
          {
            id: "group-core",
            presetId: "preset-original",
            name: "Core",
          },
        ],
        choiceBlocks: [
          {
            id: "choice-tone",
            presetId: "preset-original",
            variableName: "tone",
            label: "Tone",
            options: [{ id: "warm", label: "Warm", value: "warm" }],
          },
        ],
      },
    });

    const duplicate = duplicatePromptPresetRecord(
      record,
      "preset-copy",
      "2026-07-08T01:00:00.000Z",
    );

    expect(duplicate.sections.map((section) => section.presetId)).toEqual(["preset-copy"]);
    expect(duplicate.groups.map((group) => group.presetId)).toEqual(["preset-copy"]);
    expect(duplicate.choiceBlocks.map((choiceBlock) => choiceBlock.presetId)).toEqual([
      "preset-copy",
    ]);
    expect(record.sections.map((section) => section.presetId)).toEqual(["preset-original"]);
    expect(record.groups.map((group) => group.presetId)).toEqual(["preset-original"]);
    expect(record.choiceBlocks.map((choiceBlock) => choiceBlock.presetId)).toEqual([
      "preset-original",
    ]);
  });
});

describe("createImportedPromptPresetRecord", () => {
  it("keeps portable content while assigning one fresh native preset identity", () => {
    const record = createPromptPresetRecord({
      id: "preset-package-id",
      now,
      input: {
        name: "Portable Preset",
        messengerPrompt: "Write the next response.",
        sections: [
          {
            id: "section-system",
            presetId: "preset-package-id",
            identifier: "system",
            name: "System",
            content: "Write clearly.",
            role: "system",
            enabled: true,
            isMarker: false,
          },
        ],
        groups: [{ id: "group-core", presetId: "preset-package-id", name: "Core" }],
        choiceBlocks: [
          {
            id: "choice-tone",
            presetId: "preset-package-id",
            variableName: "tone",
            label: "Tone",
            options: [{ id: "tone-warm", label: "Warm", value: "warm" }],
          },
        ],
      },
    });

    const imported = createImportedPromptPresetRecord(
      record,
      "prompt-preset-imported",
      "2026-07-11T01:00:00.000Z",
    );

    expect(imported).toMatchObject({
      id: "prompt-preset-imported",
      name: "Portable Preset",
      createdAt: "2026-07-11T01:00:00.000Z",
      updatedAt: "2026-07-11T01:00:00.000Z",
    });
    expect(imported.sections).toEqual([
      expect.objectContaining({ id: "section-system", presetId: "prompt-preset-imported" }),
    ]);
    expect(imported.groups).toEqual([
      expect.objectContaining({ id: "group-core", presetId: "prompt-preset-imported" }),
    ]);
    expect(imported.choiceBlocks).toEqual([
      expect.objectContaining({ id: "choice-tone", presetId: "prompt-preset-imported" }),
    ]);
    expect(record.sections[0]?.presetId).toBe("preset-package-id");
    expect(record.groups[0]?.presetId).toBe("preset-package-id");
    expect(record.choiceBlocks[0]?.presetId).toBe("preset-package-id");
  });
});

describe("native thread prompt preset choices", () => {
  it("materializes untouched defaults into a stable confirmed history copy", () => {
    const preset = createPromptPresetRecord({
      id: "preset-default-copy",
      now,
      input: {
        name: "Default copy",
        messengerPrompt: "Use {{tone}} and {{pace}}.",
        defaultChoices: {
          tone: { kind: "option", optionId: "tone-warm" },
          pace: { kind: "option", optionId: "pace-slow" },
        },
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [
              { id: "tone-warm", label: "Warm", value: "warm" },
              { id: "tone-dry", label: "Dry", value: "dry" },
            ],
          },
          {
            id: "choice-pace",
            variableName: "pace",
            label: "Pace",
            options: [
              { id: "pace-slow", label: "Slow", value: "slow" },
              { id: "pace-fast", label: "Fast", value: "fast" },
            ],
          },
        ],
      },
    });
    const confirmed = materializePromptPresetThreadChoiceSelections(preset, {
      "choice-tone": { kind: "option", optionId: "tone-dry" },
    });
    const editedPreset = updatePromptPresetRecord(
      preset,
      {
        ...preset,
        defaultChoices: {
          ...preset.defaultChoices,
          pace: { kind: "option", optionId: "pace-fast" },
        },
      },
      "2026-07-08T01:00:00.000Z",
    );

    expect(confirmed).toEqual({
      "choice-tone": { kind: "option", optionId: "tone-dry" },
      "choice-pace": { kind: "option", optionId: "pace-slow" },
    });
    expect(
      resolvePromptPresetChoiceVariables({ preset: editedPreset, selections: confirmed }),
    ).toEqual(
      expect.objectContaining({
        variables: expect.objectContaining({ tone: "dry", pace: "slow" }),
      }),
    );
  });

  it("reports when legacy selections change during normalization", () => {
    expect(normalizePromptPresetThreadChoiceSelectionsWithChange({ pacing: "slow" })).toEqual({
      selections: {},
      changed: true,
    });
    expect(normalizePromptPresetThreadChoiceSelectionsWithChange({})).toEqual({
      selections: {},
      changed: false,
    });
  });

  it("keeps only stable block and option ids with the block's effective cardinality", () => {
    const preset = createPromptPresetRecord({
      id: "preset-native-choices",
      now,
      input: {
        name: "Native choices",
        messengerPrompt: "Use the selected choices.",
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [
              { id: "tone-warm", label: "Warm", value: "warm" },
              { id: "tone-dry", label: "Dry", value: "dry" },
            ],
          },
          {
            id: "choice-tags",
            variableName: "tags",
            label: "Tags",
            multiSelect: true,
            options: [
              { id: "tag-vivid", label: "Vivid", value: "vivid" },
              { id: "tag-brief", label: "Brief", value: "brief" },
            ],
          },
        ],
      },
    });
    const normalized = normalizePromptPresetThreadChoiceSelections({
      " choice-tone ": [
        { kind: "option", optionId: " tone-dry " },
        { kind: "option", optionId: "missing" },
        { kind: "option", optionId: "tone-warm" },
      ],
      "choice-tags": [
        { kind: "option", optionId: "tag-brief" },
        { kind: "option", optionId: "missing" },
        { kind: "option", optionId: "tag-vivid" },
      ],
      "choice-unknown": { kind: "option", optionId: "unknown" },
      tone: "legacy-value",
    });

    expect(prunePromptPresetThreadChoiceSelections(preset, normalized)).toEqual({
      "choice-tone": { kind: "option", optionId: "tone-dry" },
      "choice-tags": [
        { kind: "option", optionId: "tag-brief" },
        { kind: "option", optionId: "tag-vivid" },
      ],
    });
  });
});
