import { describe, expect, it } from "vitest";

import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import {
  createPromptPresetPackage,
  normalizePromptPresetImportRecord,
  normalizePromptPresetPackage,
} from "./prompt-preset-package";

const createdAt = "2026-07-08T00:00:00.000Z";
const exportedAt = "2026-07-11T00:00:00.000Z";

function richPromptPreset(): PromptPresetRecord {
  return {
    id: "prompt-preset-rich",
    schemaVersion: 1,
    title: "Rich Preset",
    summary: "Exercises the portable prompt-preset contract.",
    systemPrompt: "Write the next response.",
    messengerPrompt: "Reply like a private message.",
    sampling: {
      maxTokens: 2048,
      temperature: 0.8,
      topP: 0.9,
    },
    parameters: {
      maxTokens: 2048,
      temperature: 0.8,
      topP: 0.9,
      topK: 40,
      minP: 0.05,
      maxContext: 32_768,
      frequencyPenalty: 0.2,
      presencePenalty: 0.1,
      reasoningEffort: "medium",
      verbosity: "low",
      serviceTier: "priority",
      assistantPrefill: "<reply>",
      customThinkingTags: "<think></think>",
      customParameters: { repetition_penalty: 1.1 },
      enabledParameters: { topK: true },
      squashSystemMessages: true,
      showThoughts: false,
      useMaxContext: true,
      stopSequences: ["</reply>"],
      strictRoleFormatting: true,
      singleUserMessage: false,
    },
    sectionOrder: ["section-system", "section-history"],
    groupOrder: ["group-core"],
    variableOrder: ["register", "tone", "compatibility-slot"],
    variableGroups: [{ id: "variables-style", label: "Style" }],
    variableValues: { register: "plain" },
    defaultChoices: { tone: { kind: "option", optionId: "tone-warm" } },
    wrapFormat: "<prompt>{{prompt}}</prompt>",
    author: "DeKoi",
    folderId: "folder-roleplay",
    sections: [
      {
        id: "section-system",
        presetId: "prompt-preset-rich",
        identifier: "system",
        name: "System",
        content: "Write carefully.",
        role: "system",
        enabled: true,
        isMarker: false,
        groupId: "group-core",
        injectionPosition: "relative",
        injectionDepth: 2,
        injectionOrder: 1,
        wrapInXml: true,
        xmlTagName: "instructions",
        forbidOverrides: true,
      },
      {
        id: "section-history",
        presetId: "prompt-preset-rich",
        identifier: "history",
        name: "History",
        content: "",
        role: "user",
        enabled: true,
        isMarker: true,
        markerConfig: { type: "chat_history" },
      },
    ],
    groups: [
      {
        id: "group-core",
        presetId: "prompt-preset-rich",
        name: "Core",
        parentGroupId: null,
        order: 1,
        enabled: true,
        createdAt,
      },
    ],
    choiceBlocks: [
      {
        id: "choice-tone",
        presetId: "prompt-preset-rich",
        variableName: "tone",
        question: "Which tone?",
        label: "Tone",
        options: [
          {
            id: "tone-warm",
            label: "Warm",
            value: "warm",
            description: "Use a warm tone.",
          },
        ],
        defaultOptionId: "tone-warm",
        multiSelect: false,
        separator: ", ",
        displayMode: "buttons",
        optionSort: "manual",
        sortOrder: 1,
        createdAt,
      },
      {
        id: "choice-register",
        presetId: "prompt-preset-rich",
        variableName: "register",
        question: "Which register?",
        label: "Register",
        options: [{ id: "register-plain", label: "Plain", value: "plain" }],
        defaultOptionId: "register-plain",
        multiSelect: false,
        separator: ", ",
        displayMode: "buttons",
        optionSort: "manual",
        sortOrder: 0,
        createdAt,
      },
    ],
    createdAt,
    updatedAt: createdAt,
  };
}

describe("prompt preset packages", () => {
  it("round-trips a promptless native package without injecting prompt text", () => {
    const promptless = {
      ...richPromptPreset(),
      id: "prompt-preset-empty",
      title: "Promptless Preset",
      summary: null,
      systemPrompt: "",
      messengerPrompt: null,
      sampling: null,
      parameters: null,
      sectionOrder: [],
      groupOrder: [],
      variableOrder: [],
      variableGroups: [],
      variableValues: {},
      defaultChoices: {},
      wrapFormat: null,
      author: null,
      folderId: null,
      sections: [],
      groups: [],
      choiceBlocks: [],
    } satisfies PromptPresetRecord;

    const packageValue = createPromptPresetPackage(promptless, exportedAt);
    expect(normalizePromptPresetImportRecord(JSON.parse(JSON.stringify(packageValue)))).toEqual(
      promptless,
    );
  });

  it("normalizes omitted optional recipe arrays in a minimal promptless package", () => {
    const record = normalizePromptPresetImportRecord({
      type: "dekoi_preset",
      version: 1,
      exportedAt,
      data: {
        preset: {
          id: "prompt-preset-minimal",
          name: "Minimal Promptless",
          createdAt,
          updatedAt: createdAt,
        },
      },
    });

    expect(record).toMatchObject({
      id: "prompt-preset-minimal",
      title: "Minimal Promptless",
      systemPrompt: "",
      sections: [],
      groups: [],
      choiceBlocks: [],
    });
  });

  it.each([{}, { name: null }, { name: "   " }])(
    "rejects a promptless package without a nonblank title",
    (titleFields) => {
      expect(
        normalizePromptPresetImportRecord({
          type: "dekoi_preset",
          version: 1,
          exportedAt,
          data: {
            preset: {
              id: "prompt-preset-missing-title",
              ...titleFields,
              createdAt,
              updatedAt: createdAt,
            },
          },
        }),
      ).toBeNull();
    },
  );

  it("round-trips every supported native prompt-preset field through the stable package", () => {
    const preset = richPromptPreset();

    const packageValue = createPromptPresetPackage(preset, exportedAt);

    expect(packageValue).toMatchObject({
      type: "dekoi_preset",
      version: 1,
      exportedAt,
      data: {
        preset: {
          id: preset.id,
          name: preset.title,
          description: preset.summary,
          systemPrompt: preset.systemPrompt,
          messengerPrompt: preset.messengerPrompt,
        },
      },
    });
    const serializedPackage = JSON.parse(JSON.stringify(packageValue)) as unknown;
    expect(normalizePromptPresetImportRecord(serializedPackage)).toEqual(preset);
  });

  it("merges compatible sampling fields into parameters without overriding parameters", () => {
    const packageValue = createPromptPresetPackage(richPromptPreset(), exportedAt);

    const record = normalizePromptPresetPackage({
      ...packageValue,
      data: {
        ...packageValue.data,
        preset: {
          ...packageValue.data.preset,
          sampling: { maxTokens: 1024, temperature: 0.4 },
          parameters: { temperature: 0.7, topK: 40 },
        },
      },
    });

    expect(record?.parameters).toMatchObject({ maxTokens: 1024, temperature: 0.7, topK: 40 });
    expect(record?.sampling).toEqual({ maxTokens: 1024, temperature: 0.7 });
  });

  it("resolves whitespace-wrapped compatible default values after canonical trimming", () => {
    const packageValue = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const [firstBlock, ...remainingBlocks] = packageValue.data.choiceBlocks;
    const [firstOption, ...remainingOptions] = firstBlock.options;

    const record = normalizePromptPresetPackage({
      ...packageValue,
      data: {
        ...packageValue.data,
        preset: {
          ...packageValue.data.preset,
          defaultChoices: { tone: " warm " },
        },
        choiceBlocks: [
          {
            ...firstBlock,
            options: [{ ...firstOption, value: " warm " }, ...remainingOptions],
          },
          ...remainingBlocks,
        ],
      },
    });

    expect(record?.defaultChoices).toEqual({ tone: "warm" });
    expect(record?.choiceBlocks[0]?.options[0]?.value).toBe("warm");
  });

  it("accepts default selections by value, id, and option object", () => {
    const packageValue = createPromptPresetPackage(richPromptPreset(), exportedAt);

    expect(
      normalizePromptPresetPackage({
        ...packageValue,
        data: {
          ...packageValue.data,
          preset: {
            ...packageValue.data.preset,
            defaultChoices: {
              tone: ["warm", "tone-warm", { kind: "option", optionId: "tone-warm" }],
            },
          },
        },
      }),
    ).not.toBeNull();
  });

  it("imports compatible package sections without copying them into the shared prompt", () => {
    const record = normalizePromptPresetImportRecord({
      type: "marinara_preset",
      version: 1,
      exportedAt,
      data: {
        preset: {
          id: "preset-compatible",
          name: "Compatible Preset",
          sectionOrder: ["section-role", "section-history"],
          createdAt,
          updatedAt: createdAt,
        },
        sections: [
          {
            id: "section-role",
            presetId: "preset-compatible",
            identifier: "role",
            name: "Role",
            content: "Write in character.",
            role: "system",
            enabled: true,
            isMarker: false,
          },
          {
            id: "section-history",
            presetId: "preset-compatible",
            identifier: "history",
            name: "History",
            content: "",
            role: "user",
            enabled: true,
            isMarker: true,
            markerConfig: { type: "chat_history" },
          },
        ],
        groups: [],
        choiceBlocks: [],
      },
    });

    expect(record?.systemPrompt).toBe("");
    expect(record?.sections.map((section) => section.presetId)).toEqual([
      "preset-compatible",
      "preset-compatible",
    ]);
  });

  it.each([
    {
      label: "prefers the packaged preset id",
      envelopeId: "package-export-id",
      presetId: "preset-native-id",
      expectedId: "preset-native-id",
    },
    {
      label: "uses the envelope id when the packaged preset id is blank",
      envelopeId: "package-export-id",
      presetId: " ",
      expectedId: "package-export-id",
    },
  ])("$label and stamps child rows with it", ({ envelopeId, presetId, expectedId }) => {
    const record = normalizePromptPresetImportRecord({
      id: envelopeId,
      type: "dekoi_preset",
      version: 1,
      exportedAt,
      data: {
        preset: {
          id: presetId,
          name: "Identity Preset",
          systemPrompt: "Write the next response.",
          createdAt,
          updatedAt: createdAt,
        },
        sections: [
          {
            id: "section-system",
            presetId: "stale-id",
            identifier: "system",
            name: "System",
            content: "Write clearly.",
            role: "system",
            enabled: true,
            isMarker: false,
          },
        ],
        groups: [{ id: "group-core", presetId: "stale-id", name: "Core" }],
        choiceBlocks: [
          {
            id: "choice-tone",
            presetId: "stale-id",
            variableName: "tone",
            label: "Tone",
            options: [{ id: "warm", label: "Warm", value: "warm" }],
          },
        ],
      },
    });

    expect(record?.id).toBe(expectedId);
    expect(record?.sections[0]?.presetId).toBe(expectedId);
    expect(record?.groups[0]?.presetId).toBe(expectedId);
    expect(record?.choiceBlocks[0]?.presetId).toBe(expectedId);
  });

  it("round-trips native sections without copying them into a blank shared prompt", () => {
    const preset = { ...richPromptPreset(), systemPrompt: "" };
    const packageValue = createPromptPresetPackage(preset, exportedAt);

    const record = normalizePromptPresetImportRecord(
      JSON.parse(JSON.stringify(packageValue)) as unknown,
    );

    expect(record?.systemPrompt).toBe("");
    expect(record?.sections).toEqual(preset.sections);
  });

  it("rejects unsupported envelopes while accepting promptless packages", () => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);

    expect(normalizePromptPresetImportRecord({ ...validPackage, type: "dekoi_bundle" })).toBeNull();
    expect(normalizePromptPresetImportRecord({ ...validPackage, version: 2 })).toBeNull();
    expect(
      normalizePromptPresetImportRecord({
        type: "dekoi_preset",
        version: 1,
        exportedAt,
        data: {
          preset: {
            id: "preset-empty",
            name: "Empty Preset",
            createdAt,
            updatedAt: createdAt,
          },
          sections: [],
          groups: [],
          choiceBlocks: [],
        },
      })?.systemPrompt,
    ).toBe("");
    expect(
      normalizePromptPresetImportRecord({
        type: "dekoi_preset",
        version: 1,
        exportedAt,
        data: {
          preset: {
            id: "preset-marker-only",
            name: "Marker-only Preset",
            systemPrompt: "   ",
            sectionOrder: ["section-history"],
            createdAt,
            updatedAt: createdAt,
          },
          sections: [
            {
              id: "section-history",
              identifier: "history",
              name: "History",
              content: "",
              role: "user",
              enabled: true,
              isMarker: true,
              markerConfig: { type: "chat_history" },
            },
          ],
          groups: [],
          choiceBlocks: [],
        },
      })?.systemPrompt,
    ).toBe("");
  });

  it.each([
    ["non-string envelope id", { id: 42 }],
    ["non-timestamp export metadata", { exportedAt: "yesterday-ish" }],
    ["non-string export metadata", { exportedAt: 42 }],
  ])("rejects %s", (_label, malformedEnvelope) => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);

    expect(normalizePromptPresetPackage({ ...validPackage, ...malformedEnvelope })).toBeNull();
  });

  it.each([
    [
      "a default for an unknown choice block",
      (validPackage: ReturnType<typeof createPromptPresetPackage>) => ({
        ...validPackage,
        data: {
          ...validPackage.data,
          preset: {
            ...validPackage.data.preset,
            defaultChoices: { missing: { kind: "option", optionId: "tone-warm" } },
          },
        },
      }),
    ],
    [
      "a default choice for an unknown option",
      (validPackage: ReturnType<typeof createPromptPresetPackage>) => ({
        ...validPackage,
        data: {
          ...validPackage.data,
          preset: {
            ...validPackage.data.preset,
            defaultChoices: { tone: { kind: "option", optionId: "missing" } },
          },
        },
      }),
    ],
    [
      "a choice block default for an unknown option",
      (validPackage: ReturnType<typeof createPromptPresetPackage>) => ({
        ...validPackage,
        data: {
          ...validPackage.data,
          choiceBlocks: validPackage.data.choiceBlocks.map((block, index) =>
            index === 0 ? { ...block, defaultOptionId: "missing" } : block,
          ),
        },
      }),
    ],
  ])("rejects %s", (_label, mutatePackage) => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);

    expect(normalizePromptPresetPackage(mutatePackage(validPackage))).toBeNull();
  });

  it.each([
    [
      "more than 1,000 options in a choice block",
      (validPackage: ReturnType<typeof createPromptPresetPackage>) => ({
        ...validPackage,
        data: {
          ...validPackage.data,
          choiceBlocks: validPackage.data.choiceBlocks.map((block, index) =>
            index === 0
              ? {
                  ...block,
                  options: Array.from({ length: 1_001 }, (_, optionIndex) => ({
                    id: `option-${optionIndex}`,
                    label: `Option ${optionIndex}`,
                    value: `option-${optionIndex}`,
                  })),
                }
              : block,
          ),
        },
      }),
    ],
    [
      "more than 1,000 default selections",
      (validPackage: ReturnType<typeof createPromptPresetPackage>) => ({
        ...validPackage,
        data: {
          ...validPackage.data,
          preset: {
            ...validPackage.data.preset,
            defaultChoices: { tone: Array.from({ length: 1_001 }, () => "warm") },
          },
        },
      }),
    ],
  ])("rejects %s", (_label, mutatePackage) => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);

    expect(normalizePromptPresetPackage(mutatePackage(validPackage))).toBeNull();
  });

  it("accepts exactly 1,000 options and default selections", () => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const options = Array.from({ length: 1_000 }, (_, optionIndex) => ({
      id: `option-${optionIndex}`,
      label: `Option ${optionIndex}`,
      value: `value-${optionIndex}`,
    }));
    const defaultChoices = Array.from(
      { length: 1_000 },
      (_, optionIndex) => `option-${optionIndex}`,
    );

    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: {
          ...validPackage.data,
          preset: {
            ...validPackage.data.preset,
            defaultChoices: { tone: defaultChoices },
          },
          choiceBlocks: validPackage.data.choiceBlocks.map((block, index) =>
            index === 0
              ? { ...block, options, defaultOptionId: "option-0", multiSelect: true }
              : block,
          ),
        },
      }),
    ).not.toBeNull();
  });

  it("rejects malformed package rows instead of silently dropping supported data", () => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);

    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: { ...validPackage.data, sections: "corrupt" },
      }),
    ).toBeNull();
    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: { ...validPackage.data, groups: 42 },
      }),
    ).toBeNull();
    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: {
          ...validPackage.data,
          choiceBlocks: [
            {
              id: "choice-invalid",
              variableName: "invalid",
              options: [{ id: "valid", label: "Valid", value: "valid" }, null],
            },
          ],
        },
      }),
    ).toBeNull();
  });

  it.each([
    ["sections", "sections"],
    ["groups", "groups"],
    ["choiceBlocks", "choiceBlocks"],
  ])("rejects a JSON-string top-level %s collection", (_label, field) => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const collection = validPackage.data[field as keyof typeof validPackage.data];

    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: { ...validPackage.data, [field]: JSON.stringify(collection) },
      }),
    ).toBeNull();
  });

  it("retains JSON-string compatibility for nested choice-block options", () => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const [firstBlock, ...remainingBlocks] = validPackage.data.choiceBlocks;

    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: {
          ...validPackage.data,
          choiceBlocks: [
            { ...firstBlock, options: JSON.stringify(firstBlock.options) },
            ...remainingBlocks,
          ],
        },
      }),
    ).not.toBeNull();
  });

  it("rejects malformed required section fields that survive row-count checks", () => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const [firstSection, ...remainingSections] = validPackage.data.sections;

    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: {
          ...validPackage.data,
          sections: [{ ...firstSection, content: 42 }, ...remainingSections],
        },
      }),
    ).toBeNull();
  });

  it("rejects malformed retained fields across the supported package schema", () => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const [firstSection, ...remainingSections] = validPackage.data.sections;
    const [firstGroup, ...remainingGroups] = validPackage.data.groups;
    const [firstBlock, ...remainingBlocks] = validPackage.data.choiceBlocks;
    const [firstOption, ...remainingOptions] = firstBlock.options;
    const malformedPackages: Array<[string, unknown]> = [
      [
        "preset metadata",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            preset: { ...validPackage.data.preset, name: 42 },
          },
        },
      ],
      [
        "parameters",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            preset: {
              ...validPackage.data.preset,
              parameters: { ...(validPackage.data.preset.parameters ?? {}), temperature: "hot" },
            },
          },
        },
      ],
      [
        "ordering",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            preset: {
              ...validPackage.data.preset,
              sectionOrder: ["section-system", 42],
            },
          },
        },
      ],
      [
        "static variables",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            preset: { ...validPackage.data.preset, variableValues: { register: 42 } },
          },
        },
      ],
      [
        "default choices",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            preset: {
              ...validPackage.data.preset,
              defaultChoices: { tone: { kind: "option", optionId: 42 } },
            },
          },
        },
      ],
      [
        "section role",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            sections: [{ ...firstSection, role: "narrator" }, ...remainingSections],
          },
        },
      ],
      [
        "group enabled",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            groups: [{ ...firstGroup, enabled: "yes" }, ...remainingGroups],
          },
        },
      ],
      [
        "choice display mode",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            choiceBlocks: [{ ...firstBlock, displayMode: "grid" }, ...remainingBlocks],
          },
        },
      ],
      [
        "choice option description",
        {
          ...validPackage,
          data: {
            ...validPackage.data,
            choiceBlocks: [
              {
                ...firstBlock,
                options: [{ ...firstOption, description: 42 }, ...remainingOptions],
              },
              ...remainingBlocks,
            ],
          },
        },
      ],
    ];

    for (const [label, packageValue] of malformedPackages) {
      expect(normalizePromptPresetPackage(packageValue), label).toBeNull();
    }
  });

  it.each<[string, "sampling" | "parameters", string, number]>([
    ["sampling maxTokens below range", "sampling", "maxTokens", 0],
    ["sampling maxTokens above range", "sampling", "maxTokens", 131_073],
    ["sampling maxTokens fraction", "sampling", "maxTokens", 1.5],
    ["sampling temperature below range", "sampling", "temperature", -0.1],
    ["sampling temperature above range", "sampling", "temperature", 2.1],
    ["sampling topP below range", "sampling", "topP", -0.1],
    ["sampling topP above range", "sampling", "topP", 1.1],
    ["parameters maxTokens above range", "parameters", "maxTokens", 131_073],
    ["parameters maxTokens fraction", "parameters", "maxTokens", 1.5],
    ["parameters temperature above range", "parameters", "temperature", 2.1],
    ["parameters topP above range", "parameters", "topP", 1.1],
    ["parameters topK below range", "parameters", "topK", -1],
    ["parameters topK above range", "parameters", "topK", 1_001],
    ["parameters topK fraction", "parameters", "topK", 0.5],
    ["parameters minP below range", "parameters", "minP", -0.1],
    ["parameters minP above range", "parameters", "minP", 1.1],
    ["parameters maxContext below range", "parameters", "maxContext", 0],
    ["parameters maxContext above range", "parameters", "maxContext", 2_000_001],
    ["parameters maxContext fraction", "parameters", "maxContext", 1.5],
    ["parameters frequencyPenalty below range", "parameters", "frequencyPenalty", -2.1],
    ["parameters frequencyPenalty above range", "parameters", "frequencyPenalty", 2.1],
    ["parameters presencePenalty below range", "parameters", "presencePenalty", -2.1],
    ["parameters presencePenalty above range", "parameters", "presencePenalty", 2.1],
  ])("rejects %s before normalization", (_label, target, field, value) => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const preset = validPackage.data.preset;

    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: {
          ...validPackage.data,
          preset: {
            ...preset,
            [target]: { ...(preset[target] ?? {}), [field]: value },
          },
        },
      }),
    ).toBeNull();
  });

  it.each([
    [
      "section injectionDepth",
      (value: number) => ({
        sections: [{ ...richPromptPreset().sections[0], injectionDepth: value }],
      }),
    ],
    [
      "section injectionOrder",
      (value: number) => ({
        sections: [{ ...richPromptPreset().sections[0], injectionOrder: value }],
      }),
    ],
    [
      "group order",
      (value: number) => ({ groups: [{ ...richPromptPreset().groups[0], order: value }] }),
    ],
    [
      "choice sortOrder",
      (value: number) => ({
        choiceBlocks: [{ ...richPromptPreset().choiceBlocks[0], sortOrder: value }],
      }),
    ],
  ])("rejects unsafe or fractional %s before normalization", (_label, createRows) => {
    for (const value of [0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);

      expect(
        normalizePromptPresetPackage({
          ...validPackage,
          data: { ...validPackage.data, ...createRows(value) },
        }),
      ).toBeNull();
    }
  });

  it("rejects a negative choice sort order before normalization", () => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const [firstBlock, ...remainingBlocks] = validPackage.data.choiceBlocks;

    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: {
          ...validPackage.data,
          choiceBlocks: [{ ...firstBlock, sortOrder: -1 }, ...remainingBlocks],
        },
      }),
    ).toBeNull();
  });

  it.each([
    [
      "lower",
      {
        sampling: { maxTokens: 1, temperature: 0, topP: 0 },
        parameters: {
          maxTokens: 1,
          temperature: 0,
          topP: 0,
          topK: 0,
          minP: 0,
          maxContext: 1,
          frequencyPenalty: -2,
          presencePenalty: -2,
        },
        injectionOrder: Number.MIN_SAFE_INTEGER,
        injectionDepth: Number.MIN_SAFE_INTEGER,
        groupOrder: Number.MIN_SAFE_INTEGER,
        sortOrder: 0,
      },
    ],
    [
      "upper",
      {
        sampling: { maxTokens: 131_072, temperature: 2, topP: 1 },
        parameters: {
          maxTokens: 131_072,
          temperature: 2,
          topP: 1,
          topK: 1_000,
          minP: 1,
          maxContext: 2_000_000,
          frequencyPenalty: 2,
          presencePenalty: 2,
        },
        injectionOrder: Number.MAX_SAFE_INTEGER,
        injectionDepth: Number.MAX_SAFE_INTEGER,
        groupOrder: Number.MAX_SAFE_INTEGER,
        sortOrder: Number.MAX_SAFE_INTEGER,
      },
    ],
  ])("accepts %s canonical numeric boundaries before normalization", (_label, values) => {
    const validPackage = createPromptPresetPackage(richPromptPreset(), exportedAt);
    const [firstSection, ...remainingSections] = validPackage.data.sections;
    const [firstGroup, ...remainingGroups] = validPackage.data.groups;
    const [firstBlock, ...remainingBlocks] = validPackage.data.choiceBlocks;

    expect(
      normalizePromptPresetPackage({
        ...validPackage,
        data: {
          ...validPackage.data,
          preset: {
            ...validPackage.data.preset,
            sampling: values.sampling,
            parameters: values.parameters,
          },
          sections: [
            {
              ...firstSection,
              injectionDepth: values.injectionDepth,
              injectionOrder: values.injectionOrder,
            },
            ...remainingSections,
          ],
          groups: [{ ...firstGroup, order: values.groupOrder }, ...remainingGroups],
          choiceBlocks: [{ ...firstBlock, sortOrder: values.sortOrder }, ...remainingBlocks],
        },
      }),
    ).not.toBeNull();
  });
});
