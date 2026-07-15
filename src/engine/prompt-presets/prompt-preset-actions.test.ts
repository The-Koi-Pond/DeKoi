import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPromptPresetRecord,
  createImportedPromptPresetRecord,
  duplicatePromptPresetRecord,
  materializePromptPresetThreadChoiceSelections,
  normalizePromptPresetRecord,
  normalizePromptPresetThreadChoiceSelections,
  normalizePromptPresetThreadChoiceSelectionsWithChange,
  prunePromptPresetThreadChoiceSelections,
  resolvePromptPresetChoiceControls,
  resolvePromptPresetChoiceVariables,
  updatePromptPresetChoiceSelections,
  updatePromptPresetRecord,
} from "./prompt-preset-actions";

const now = "2026-07-08T00:00:00.000Z";

describe("normalizePromptPresetRecord", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["omitted", {}],
    ["null", { systemPrompt: null }],
    ["blank", { systemPrompt: "   " }],
  ])("normalizes a %s prompt to a blank persisted prompt", (_label, promptField) => {
    const record = normalizePromptPresetRecord({
      id: "promptless",
      schemaVersion: 1,
      title: "Promptless",
      ...promptField,
      createdAt: now,
      updatedAt: now,
    });

    expect(record?.systemPrompt).toBe("");
  });

  it.each([42, {}, [], true])("rejects malformed prompt value %j", (systemPrompt) => {
    expect(
      normalizePromptPresetRecord({
        id: "malformed-prompt",
        schemaVersion: 1,
        title: "Malformed Prompt",
        systemPrompt,
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeNull();
  });

  it("rejects the removed sampling source instead of silently erasing it", () => {
    expect(
      normalizePromptPresetRecord({
        id: "removed-sampling",
        schemaVersion: 1,
        title: "Removed Sampling",
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
      normalizePromptPresetRecord({
        id: "malformed-parameters",
        schemaVersion: 1,
        title: "Malformed Parameters",
        parameters,
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeNull();
  });

  it.each([[undefined], [null]])("accepts omitted or null parameters: %j", (parameters) => {
    const value: Record<string, unknown> = {
      id: "empty-parameters",
      schemaVersion: 1,
      title: "Empty Parameters",
      createdAt: now,
      updatedAt: now,
    };
    if (parameters !== undefined) value.parameters = parameters;

    expect(normalizePromptPresetRecord(value)?.parameters).toBeNull();
  });

  it("normalizes omitted recipe arrays to empty arrays", () => {
    const record = normalizePromptPresetRecord({
      id: "minimal-promptless",
      schemaVersion: 1,
      title: "Minimal Promptless",
      createdAt: now,
      updatedAt: now,
    });

    expect(record).toMatchObject({
      sections: [],
      groups: [],
      choiceBlocks: [],
    });
  });

  it.each(["sections", "groups", "choiceBlocks"])(
    "rejects an explicitly malformed %s collection",
    (field) => {
      expect(
        normalizePromptPresetRecord({
          id: "malformed-recipe",
          schemaVersion: 1,
          title: "Malformed Recipe",
          [field]: {},
          createdAt: now,
          updatedAt: now,
        }),
      ).toBeNull();
    },
  );

  it.each([undefined, null, "", "   "])("rejects missing or blank title %j", (title) => {
    expect(
      normalizePromptPresetRecord({
        id: "missing-title",
        schemaVersion: 1,
        title,
        createdAt: now,
        updatedAt: now,
      }),
    ).toBeNull();
  });

  it("creates and updates promptless records without injecting fallback text", () => {
    const created = createPromptPresetRecord({
      id: "promptless",
      input: { title: "Promptless" },
      now,
    });

    expect(created.systemPrompt).toBe("");
    expect(
      updatePromptPresetRecord(created, { title: "Promptless", systemPrompt: "" }, now)
        .systemPrompt,
    ).toBe("");
  });

  it("falls back when prompt preset timestamps are malformed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));

    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Write the next response.",
      createdAt: "not-a-date",
      updatedAt: "also-not-a-date",
    });

    expect(record?.createdAt).toBe(now);
    expect(record?.updatedAt).toBe(now);
  });

  it("removes whitespace-only choice separators", () => {
    const record = normalizePromptPresetRecord({
      id: "preset-whitespace-separator",
      schemaVersion: 1,
      title: "Whitespace separator",
      systemPrompt: "Write the next response.",
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
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Write the next response.",
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

  it("normalizes choice blocks and falls back to the first valid option as default", () => {
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Write with {{pacing}}.",
      choiceBlocks: [
        {
          id: "choice-pacing",
          variableName: "pacing",
          label: "Pacing",
          defaultOptionId: "missing",
          options: [
            { id: "slow", label: "Slow", value: "slow burn" },
            { id: "fast", label: "Fast", value: "snappy" },
            { id: "fast", label: "Duplicate", value: "ignored" },
          ],
        },
        {
          id: "invalid",
          variableName: "",
          label: "Invalid",
          options: [{ id: "x", label: "X", value: "x" }],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record?.choiceBlocks).toEqual([
      {
        id: "choice-pacing",
        variableName: "pacing",
        label: "Pacing",
        defaultOptionId: "slow",
        options: [
          { id: "slow", label: "Slow", value: "slow burn" },
          { id: "fast", label: "Fast", value: "snappy" },
        ],
      },
    ]);
  });

  it("resolves default and selected choice values by variable name", () => {
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Write with {{pacing}} and {{tone}}.",
      choiceBlocks: [
        {
          id: "choice-pacing",
          variableName: "pacing",
          label: "Pacing",
          defaultOptionId: "fast",
          options: [
            { id: "fast", label: "Fast", value: "snappy" },
            { id: "slow", label: "Slow", value: "slow burn" },
          ],
        },
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          defaultOptionId: "warm",
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

  it("drops default choices for skipped blocks and invalid option values", () => {
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Write with {{tone}}.",
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
        {
          id: "choice-skipped",
          variableName: "skipped",
          label: "Skipped",
          options: [],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record?.defaultChoices).toEqual({
      tone: ["warm prose", "tone-cold"],
    });
  });

  it("resolves preset variables and multi-select choice values", () => {
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Use {{baseTone}} and {{motifs}}.",
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
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Use {{boundary}} and {{motifs}}.",
      variableOrder: ["choice-hidden", "choice-motifs", "choice-boundary"],
      defaultChoices: {
        motifs: ["rain", "neon"],
      },
      choiceBlocks: [
        {
          id: "choice-boundary",
          variableName: "boundary",
          label: "Boundary",
          defaultOptionId: "sfw",
          options: [
            { id: "sfw", label: "SFW", value: "SFW" },
            { id: "adult", label: "Adult", value: "Adult" },
          ],
        },
        {
          id: "choice-hidden",
          variableName: "hiddenTone",
          label: "Hidden tone",
          defaultOptionId: "soft",
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
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Use {{tone}}.",
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          defaultOptionId: "loud",
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
        defaultLabel: "Preset default: Loud",
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
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Use {{tone}}.",
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
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Use {{tone}}.",
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
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Use {{tone}}.",
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          defaultOptionId: "loud",
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
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Use {{tags}}.",
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
        title: "Selections",
        systemPrompt: "Use choices.",
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
        title: "Preset One",
        summary: "Rich preset",
        systemPrompt: "Write the next response.",
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
        title: record.title,
        summary: record.summary,
        systemPrompt: record.systemPrompt,
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
        title: "Preset One",
        systemPrompt: "Write the next response.",
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
        title: record.title,
        summary: record.summary,
        systemPrompt: record.systemPrompt,
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
        title: "Preset One",
        systemPrompt: "Write the next response.",
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
        title: "Portable Preset",
        systemPrompt: "Write the next response.",
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
      title: "Portable Preset",
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
        title: "Default copy",
        systemPrompt: "Use {{tone}} and {{pace}}.",
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            defaultOptionId: "tone-warm",
            options: [
              { id: "tone-warm", label: "Warm", value: "warm" },
              { id: "tone-dry", label: "Dry", value: "dry" },
            ],
          },
          {
            id: "choice-pace",
            variableName: "pace",
            label: "Pace",
            defaultOptionId: "pace-slow",
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
        choiceBlocks: preset.choiceBlocks.map((block) =>
          block.id === "choice-pace" ? { ...block, defaultOptionId: "pace-fast" } : block,
        ),
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
        title: "Native choices",
        systemPrompt: "Use the selected choices.",
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
