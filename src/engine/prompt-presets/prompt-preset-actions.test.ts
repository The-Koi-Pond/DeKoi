import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPromptPresetRecord,
  duplicatePromptPresetRecord,
  isPromptPresetChoiceBlockVisible,
  normalizePromptPresetRecord,
  resolvePromptPresetChoiceVariables,
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
