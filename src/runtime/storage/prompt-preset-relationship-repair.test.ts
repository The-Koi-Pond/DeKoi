import { describe, expect, it } from "vitest";

import type { PromptPresetRecord } from "../../engine/contracts/types/prompt-presets";
import { repairPromptPresetRelationships } from "./prompt-preset-relationship-repair";

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
      presetChoiceSelections: {
        "choice-b": [
          { kind: "option" as const, optionId: "b-2" },
          { kind: "option" as const, optionId: "b-1" },
        ],
        "choice-a": { kind: "option" as const, optionId: "a-1" },
      },
    };

    const result = repairPromptPresetRelationships([record], [promptPreset()]);

    expect(result.records[0]).toBe(record);
    expect(result.repairedChoiceSelectionCount).toBe(0);
    expect(result.records[0]?.presetChoiceSelections["choice-b"]).toEqual([
      { kind: "option", optionId: "b-2" },
      { kind: "option", optionId: "b-1" },
    ]);
  });
});
