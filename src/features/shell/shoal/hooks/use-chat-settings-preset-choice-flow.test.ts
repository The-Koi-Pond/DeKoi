import { describe, expect, it } from "vitest";
import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import { projectPresetChoiceState } from "../../../modes";

function preset(): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Test",
    systemPrompt: "",
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    sections: [],
    groups: [],
    choiceBlocks: [
      {
        id: "tone",
        variableName: "tone",
        label: "Tone",
        options: [
          { id: "warm", label: "Warm", value: "warm" },
          { id: "cool", label: "Cool", value: "cool" },
        ],
      },
    ],
    createdAt: "",
    updatedAt: "",
  };
}

describe("projectPresetChoiceState", () => {
  it("projects absent history with materialized defaults", () => {
    const result = projectPresetChoiceState(preset(), {});

    expect(result.hasHistory).toBe(false);
    expect(result.storedSelections).toEqual({});
    expect(result.materializedSelections).toEqual({
      tone: { kind: "option", optionId: "warm" },
    });
    expect(result.repairReason).toBeNull();
    expect(result.controls[0]?.selectedOptionIds).toEqual([]);
  });

  it("recognizes valid history without repair", () => {
    const result = projectPresetChoiceState(preset(), {
      "preset-1": { tone: { kind: "option", optionId: "cool" } },
    });

    expect(result.hasHistory).toBe(true);
    expect(result.repairReason).toBeNull();
    expect(result.materializedSelections).toEqual(result.storedSelections);
    expect(result.controls[0]?.selectedOptionIds).toEqual(["cool"]);
  });

  it("ignores top-level choice-block key order when checking history", () => {
    const base = preset();
    const withSecondChoice = {
      ...base,
      choiceBlocks: [
        ...base.choiceBlocks,
        {
          id: "length",
          variableName: "length",
          label: "Length",
          options: [{ id: "short", label: "Short", value: "short" }],
        },
      ],
    } satisfies PromptPresetRecord;

    const result = projectPresetChoiceState(withSecondChoice, {
      "preset-1": {
        length: { kind: "option", optionId: "short" },
        tone: { kind: "option", optionId: "cool" },
      },
    });

    expect(result.repairReason).toBeNull();
  });

  it("flags invalid history and materializes valid defaults", () => {
    const result = projectPresetChoiceState(preset(), {
      "preset-1": { tone: { kind: "option", optionId: "missing" } },
    });

    expect(result.hasHistory).toBe(true);
    expect(result.repairReason).toBe("invalid-history");
    expect(result.materializedSelections).toEqual({
      tone: { kind: "option", optionId: "warm" },
    });
  });
});
