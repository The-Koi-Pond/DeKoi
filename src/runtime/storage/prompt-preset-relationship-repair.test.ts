import { describe, expect, it } from "vitest";

import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelections,
} from "../../engine/contracts/types/prompt-presets";
import {
  normalizePromptPresetThreadChoiceSelectionHistories,
  repairPromptPresetRelationships,
} from "./prompt-preset-relationship-repair";

const now = "2026-07-11T00:00:00.000Z";

function promptPreset(): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Preset",
    systemPrompt: "Use the choices.",
    sectionOrder: [],
    groupOrder: [],
    variableOrder: ["choice-a", "choice-b"],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    sections: [],
    groups: [],
    choiceBlocks: [
      {
        id: "choice-a",
        variableName: "a",
        label: "A",
        options: [{ id: "a-1", label: "A1", value: "a1" }],
      },
      {
        id: "choice-b",
        variableName: "b",
        label: "B",
        multiSelect: true,
        options: [
          { id: "b-1", label: "B1", value: "b1" },
          { id: "b-2", label: "B2", value: "b2" },
        ],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

describe("repairPromptPresetRelationships", () => {
  it("ignores selection map key order while preserving multi-select array order", () => {
    const record = {
      id: "thread-1",
      presetId: "preset-1",
      presetChoiceSelectionsByPresetId: {
        "preset-1": {
          "choice-b": [
            { kind: "option" as const, optionId: "b-2" },
            { kind: "option" as const, optionId: "b-1" },
          ],
          "choice-a": { kind: "option" as const, optionId: "a-1" },
        },
      },
    };

    const result = repairPromptPresetRelationships([record], [promptPreset()]);

    expect(result.records[0]).toBe(record);
    expect(result.repairedChoiceSelectionCount).toBe(0);
    expect(result.records[0]?.presetChoiceSelectionsByPresetId?.["preset-1"]?.["choice-b"]).toEqual(
      [
        { kind: "option", optionId: "b-2" },
        { kind: "option", optionId: "b-1" },
      ],
    );
  });

  it("materializes invalid confirmed histories while preserving the key", () => {
    const record = {
      id: "thread-1",
      presetId: null,
      presetChoiceSelectionsByPresetId: {
        "preset-1": {
          "choice-a": { kind: "option" as const, optionId: "removed-option" },
        },
      },
    };

    const result = repairPromptPresetRelationships([record], [promptPreset()]);

    expect(result.records[0]?.presetChoiceSelectionsByPresetId).toEqual({
      "preset-1": {
        "choice-a": { kind: "option", optionId: "a-1" },
      },
    });
    expect(result.repairedChoiceSelectionCount).toBe(1);
    expect(result.clearedPresetReferenceCount).toBe(0);
  });

  it("does not create a history entry when no history existed", () => {
    const record = { id: "thread-1", presetId: null, presetChoiceSelectionsByPresetId: {} };
    const result = repairPromptPresetRelationships([record], [promptPreset()]);
    expect(result.records[0]?.presetChoiceSelectionsByPresetId).toEqual({});
    expect(result.repairedChoiceSelectionCount).toBe(0);
  });

  it("uses typed legacy selections when the active preset history is absent", () => {
    const record: {
      id: string;
      presetId: string;
      presetChoiceSelections: PromptPresetThreadChoiceSelections;
      presetChoiceSelectionsByPresetId?: Record<string, PromptPresetThreadChoiceSelections>;
    } = {
      id: "thread-1",
      presetId: "preset-1",
      presetChoiceSelections: {
        "choice-a": { kind: "option" as const, optionId: "a-1" },
      },
    };

    const result = repairPromptPresetRelationships(
      [record],
      [promptPreset()],
      new Set([record.id]),
    );

    expect(result.records[0]?.presetChoiceSelectionsByPresetId).toEqual({
      "preset-1": {
        "choice-a": { kind: "option", optionId: "a-1" },
      },
    });
    expect(result.repairedChoiceSelectionCount).toBe(1);
  });

  it("merges legacy-only choices into an existing active preset history", () => {
    const result = normalizePromptPresetThreadChoiceSelectionHistories({
      presetId: "preset-1",
      histories: {
        "preset-1": {
          "choice-a": { kind: "option", optionId: "a-new" },
        },
        "preset-2": {
          "choice-c": { kind: "option", optionId: "c-1" },
        },
      },
      hasLegacySelections: true,
      legacySelections: {
        "choice-a": { kind: "option", optionId: "a-legacy" },
        "choice-b": [{ kind: "option", optionId: "b-1" }],
      },
    });

    expect(result.histories).toEqual({
      "preset-1": {
        "choice-a": { kind: "option", optionId: "a-new" },
        "choice-b": [{ kind: "option", optionId: "b-1" }],
      },
      "preset-2": {
        "choice-c": { kind: "option", optionId: "c-1" },
      },
    });
    expect(result.changed).toBe(true);
  });

  it("preserves reserved history IDs as serializable own properties", () => {
    const histories = JSON.parse('{"__proto__":{"choice-a":{"kind":"option","optionId":"a-1"}}}');

    const result = normalizePromptPresetThreadChoiceSelectionHistories({
      presetId: null,
      histories,
      hasLegacySelections: false,
      legacySelections: undefined,
    });

    expect(Object.prototype.hasOwnProperty.call(result.histories, "__proto__")).toBe(true);
    expect(JSON.parse(JSON.stringify(result.histories))["__proto__"]).toEqual({
      "choice-a": { kind: "option", optionId: "a-1" },
    });
  });
});
