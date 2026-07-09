import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPromptPresetRecord,
  duplicatePromptPresetRecord,
  isPromptPresetChoiceBlockVisible,
  normalizePromptPresetRecord,
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
        selections: { pacing: "slow burn", tone: "missing" },
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

  it("applies choice visibility rules to UI visibility and hidden defaults", () => {
    const record = normalizePromptPresetRecord({
      id: "preset-1",
      schemaVersion: 1,
      title: "Preset One",
      systemPrompt: "Use {{boundary}} and {{tone}}.",
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
          id: "choice-tone",
          variableName: "tone",
          label: "Tone",
          defaultOptionId: "none",
          options: [
            { id: "none", label: "None", value: "none" },
            { id: "direct", label: "Direct", value: "direct" },
          ],
          visibilityRule: {
            variableName: "boundary",
            values: ["Adult"],
          },
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    expect(record).not.toBeNull();
    if (!record) throw new Error("Expected prompt preset record.");
    const toneBlock = record.choiceBlocks[1];
    expect(
      toneBlock &&
        isPromptPresetChoiceBlockVisible({
          block: toneBlock,
          preset: record,
          selections: { boundary: "SFW", tone: "direct" },
        }),
    ).toBe(false);
    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections: { boundary: "SFW", tone: "direct" },
      }).variables,
    ).toEqual({
      boundary: "SFW",
      tone: "none",
    });
    expect(
      toneBlock &&
        isPromptPresetChoiceBlockVisible({
          block: toneBlock,
          preset: record,
          selections: { boundary: "Adult" },
        }),
    ).toBe(true);
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
        selections: { motifs: ["rain on glass", "neon signs"] },
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
      variableOrder: ["choice-motifs", "choice-boundary", "choice-hidden"],
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
          visibilityRule: {
            variableName: "boundary",
            values: ["Adult"],
          },
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
          boundary: "SFW",
          hiddenTone: "direct",
          motifs: ["static", "missing"],
        },
      }),
    ).toEqual([
      {
        id: "choice-motifs",
        variableName: "motifs",
        label: "Motifs",
        multiSelect: true,
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
        selections: { tone: "none" },
      }),
    ).toEqual([
      {
        id: "choice-tone",
        variableName: "tone",
        label: "Tone",
        multiSelect: false,
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
        selections: { tone: "none" },
      }),
    ).toEqual({
      variables: {
        tone: "",
      },
      variableNames: ["tone"],
    });
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
        selections: { tone: "quiet" },
      })[0]?.selectedOptionIds,
    ).toEqual(["soft"]);
    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections: { tone: "quiet" },
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
        selections: { tone: noneSelection ?? "" },
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
      tags: [
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
    const selections = {
      motifs: ["rain", "neon"],
      tone: "soft",
    };

    expect(updatePromptPresetChoiceSelections(selections, " tone ", " ")).toEqual({
      motifs: ["rain", "neon"],
    });
    expect(updatePromptPresetChoiceSelections(selections, " motifs ", [" static ", ""])).toEqual({
      motifs: ["static"],
      tone: "soft",
    });
    expect(
      updatePromptPresetChoiceSelections(selections, " tone ", {
        kind: "option",
        optionId: " none ",
      }),
    ).toEqual({
      motifs: ["rain", "neon"],
      tone: { kind: "option", optionId: "none" },
    });
    expect(selections).toEqual({
      motifs: ["rain", "neon"],
      tone: "soft",
    });
  });

  it("randomizes unselected randomPick choices before default fallback", () => {
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
          defaultOptionId: "calm",
          randomPick: true,
          options: [
            { id: "calm", label: "Calm", value: "calm" },
            { id: "bright", label: "Bright", value: "bright" },
            { id: "sharp", label: "Sharp", value: "sharp" },
          ],
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    const random = vi.spyOn(Math, "random").mockReturnValue(0.8);

    expect(
      resolvePromptPresetChoiceVariables({
        preset: record,
        selections: {},
      }).variables,
    ).toEqual({ tone: "sharp" });
    random.mockRestore();
  });
});

describe("updatePromptPresetRecord", () => {
  it("preserves rich parameters when legacy sampling is edited", () => {
    const record = createPromptPresetRecord({
      id: "preset-1",
      now,
      input: {
        title: "Preset One",
        summary: "Rich preset",
        systemPrompt: "Write the next response.",
        parameters: {
          maxTokens: 400,
          temperature: 0.8,
          topP: 0.9,
          topK: 42,
          maxContext: 100_000,
          stopSequences: ["END"],
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
        sampling: {
          maxTokens: null,
          temperature: 0.7,
          topP: 0.95,
        },
      },
      "2026-07-08T01:00:00.000Z",
    );

    expect(updated.parameters).toEqual({
      temperature: 0.7,
      topP: 0.95,
      topK: 42,
      maxContext: 100_000,
      stopSequences: ["END"],
      strictRoleFormatting: true,
    });
    expect(updated.sampling).toEqual({
      temperature: 0.7,
      topP: 0.95,
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
          temperature: 0.8,
          topK: 42,
          stopSequences: ["END"],
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
          temperature: 1.1,
        },
        sampling: {
          maxTokens: 800,
        },
      },
      "2026-07-08T01:00:00.000Z",
    );

    expect(updated.parameters).toEqual({
      temperature: 1.1,
    });
    expect(updated.sampling).toEqual({
      temperature: 1.1,
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
