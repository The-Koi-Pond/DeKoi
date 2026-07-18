import { describe, expect, it } from "vitest";

import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import {
  addPromptPresetChoiceBlock,
  addPromptPresetChoiceOption,
  choiceDraftFromPromptPreset,
  movePromptPresetChoiceBlock,
  movePromptPresetChoiceOption,
  promptPresetChoiceDraftToInput,
  removePromptPresetChoiceBlock,
  removePromptPresetChoiceOption,
  renamePromptPresetChoiceVariable,
  setPromptPresetChoiceDefault,
  updatePromptPresetChoiceBlock,
  updatePromptPresetChoiceOption,
  validatePromptPresetChoiceDraft,
} from "./prompt-preset-choice-draft";

const now = "2026-07-10T00:00:00.000Z";

function promptPresetRecord(input: Partial<PromptPresetRecord> = {}): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 2,
    name: "Choice Preset",
    description: null,
    messengerPrompt: "Stay in character.",
    parameters: null,
    sectionOrder: [],
    groupOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {
      tags: [
        { kind: "option", optionId: "tag-vivid" },
        { kind: "option", optionId: "tag-concise" },
      ],
      tone: { kind: "option", optionId: "tone-warm" },
    },
    wrapFormat: null,
    author: null,
    sections: [],
    groups: [],
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
          { id: "tag-concise", label: "Concise", value: "concise" },
        ],
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

describe("prompt preset choice drafts", () => {
  it("preserves authoring order and defaults", () => {
    const draft = choiceDraftFromPromptPreset(promptPresetRecord());
    expect(draft.choiceBlocks.map((block) => block.id)).toEqual(["choice-tone", "choice-tags"]);
    expect(draft.defaultOptionIdsByBlockId).toEqual({
      "choice-tags": ["tag-vivid", "tag-concise"],
      "choice-tone": ["tone-warm"],
    });

    const input = promptPresetChoiceDraftToInput(draft);

    expect(input.defaultChoices).toEqual({
      tags: [
        { kind: "option", optionId: "tag-vivid" },
        { kind: "option", optionId: "tag-concise" },
      ],
      tone: { kind: "option", optionId: "tone-warm" },
    });
  });

  it("rejects deselecting the final multi-select default", () => {
    const draft = choiceDraftFromPromptPreset(promptPresetRecord());
    const oneDefault = setPromptPresetChoiceDefault(draft, "choice-tags", "tag-concise", false);
    const attemptedEmptyDefault = setPromptPresetChoiceDefault(
      oneDefault,
      "choice-tags",
      "tag-vivid",
      false,
    );

    expect(attemptedEmptyDefault.defaultOptionIdsByBlockId["choice-tags"]).toEqual(["tag-vivid"]);
    expect(promptPresetChoiceDraftToInput(attemptedEmptyDefault).defaultChoices?.tags).toEqual({
      kind: "option",
      optionId: "tag-vivid",
    });
  });

  it("removes blank optional fields when serializing a draft", () => {
    const draft = choiceDraftFromPromptPreset(promptPresetRecord());
    const withBlankBlockFields = updatePromptPresetChoiceBlock(draft, "choice-tone", (block) => ({
      ...block,
      question: "   ",
      separator: "   ",
    }));
    const withBlankOptionDescription = updatePromptPresetChoiceOption(
      withBlankBlockFields,
      "choice-tone",
      "tone-warm",
      (option) => ({ ...option, description: "   " }),
    );

    const tone = promptPresetChoiceDraftToInput(withBlankOptionDescription).choiceBlocks?.find(
      (block) => block.id === "choice-tone",
    );

    expect(tone).not.toHaveProperty("question");
    expect(tone).not.toHaveProperty("separator");
    expect(tone?.options.find((option) => option.id === "tone-warm")).not.toHaveProperty(
      "description",
    );
  });

  it("keeps only the first default when changing a choice to single-select", () => {
    const draft = choiceDraftFromPromptPreset(promptPresetRecord());
    const singleSelect = updatePromptPresetChoiceBlock(draft, "choice-tags", (block) => ({
      ...block,
      multiSelect: false,
    }));

    expect(singleSelect.defaultOptionIdsByBlockId["choice-tags"]).toEqual(["tag-vivid"]);
    expect(promptPresetChoiceDraftToInput(singleSelect).defaultChoices?.tags).toEqual({
      kind: "option",
      optionId: "tag-vivid",
    });
  });

  it("supports adding, moving, editing, and removing choices", () => {
    let draft = choiceDraftFromPromptPreset(promptPresetRecord());
    draft = addPromptPresetChoiceBlock(draft);
    const addedId = draft.choiceBlocks.at(-1)?.id;
    expect(addedId).toBeTruthy();
    draft = addPromptPresetChoiceOption(draft, addedId!);
    const addedBlock = () => draft.choiceBlocks.find((block) => block.id === addedId)!;
    const firstOptionId = addedBlock().options[0]!.id;
    const secondOptionId = addedBlock().options[1]!.id;

    draft = movePromptPresetChoiceBlock(draft, addedId!, -1);
    expect(draft.choiceBlocks.map((block) => block.id)).toEqual([
      "choice-tone",
      addedId,
      "choice-tags",
    ]);

    draft = movePromptPresetChoiceOption(draft, addedId!, firstOptionId, 1);
    expect(addedBlock().options.map((option) => option.id)).toEqual([
      secondOptionId,
      firstOptionId,
    ]);

    draft = renamePromptPresetChoiceVariable(draft, addedId!, "new_choice");
    expect(addedBlock().variableName).toBe("new_choice");

    draft = updatePromptPresetChoiceBlock(draft, addedId!, (block) => ({ ...block, label: "New" }));
    expect(addedBlock().label).toBe("New");

    draft = updatePromptPresetChoiceOption(draft, addedId!, secondOptionId, (option) => ({
      ...option,
      label: "Edited",
    }));
    expect(addedBlock().options.find((option) => option.id === secondOptionId)?.label).toBe(
      "Edited",
    );

    draft = setPromptPresetChoiceDefault(draft, addedId!, secondOptionId, true);
    expect(draft.defaultOptionIdsByBlockId[addedId!]).toEqual([secondOptionId]);

    draft = removePromptPresetChoiceOption(draft, addedId!, firstOptionId);
    expect(addedBlock().options.map((option) => option.id)).toEqual([secondOptionId]);

    draft = removePromptPresetChoiceBlock(draft, addedId!);
    expect(draft.choiceBlocks.map((block) => block.id)).toEqual(["choice-tone", "choice-tags"]);
    expect(draft.defaultOptionIdsByBlockId).not.toHaveProperty(addedId!);
  });

  it("reports ordinary authoring validation issues only", () => {
    const draft = choiceDraftFromPromptPreset(
      promptPresetRecord({
        choiceBlocks: [
          {
            id: "choice-a",
            variableName: "same",
            label: "",
            options: [{ id: "a", label: "", value: "a" }],
          },
          {
            id: "choice-b",
            variableName: "same",
            label: "B",
            options: [{ id: "b", label: "B", value: "b" }],
          },
        ],
      }),
    );
    expect(validatePromptPresetChoiceDraft(draft).map((issue) => issue.code)).toEqual([
      "label-required",
      "option-label-required",
      "variable-duplicate",
    ]);
  });
});
