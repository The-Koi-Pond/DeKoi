import { describe, expect, it } from "vitest";

import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import {
  addPromptPresetChoiceBlock,
  addPromptPresetChoiceOption,
  choiceDraftFromPromptPreset,
  movePromptPresetChoiceBlock,
  movePromptPresetChoiceOption,
  promptPresetChoiceVisibilityOptions,
  promptPresetChoiceDraftToInput,
  removePromptPresetChoiceBlock,
  removePromptPresetChoiceOption,
  renamePromptPresetChoiceVariable,
  setPromptPresetChoiceDefault,
  setPromptPresetChoiceVisibilityController,
  setPromptPresetChoiceVisibilityValue,
  updatePromptPresetChoiceBlock,
  updatePromptPresetChoiceOption,
  validatePromptPresetChoiceDraft,
} from "./prompt-preset-choice-draft";

const now = "2026-07-10T00:00:00.000Z";

function promptPresetRecord(input: Partial<PromptPresetRecord> = {}): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Choice Preset",
    summary: null,
    systemPrompt: "Stay in character.",
    messengerPrompt: null,
    sampling: null,
    parameters: null,
    sectionOrder: [],
    groupOrder: [],
    variableOrder: ["choice-tags", "choice-tone"],
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
    isDefault: false,
    author: null,
    folderId: null,
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
        defaultOptionId: "tone-warm",
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
        defaultOptionId: "tag-vivid",
      },
    ],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

describe("prompt preset choice drafts", () => {
  it("keeps block order and stable option defaults across an edit round trip", () => {
    const draft = choiceDraftFromPromptPreset(promptPresetRecord());

    expect(draft.choiceBlocks.map((block) => block.id)).toEqual(["choice-tags", "choice-tone"]);
    expect(draft.defaultOptionIdsByBlockId).toEqual({
      "choice-tags": ["tag-vivid", "tag-concise"],
      "choice-tone": ["tone-warm"],
    });

    const input = promptPresetChoiceDraftToInput(draft);

    expect(input.variableOrder).toEqual(["choice-tags", "choice-tone"]);
    expect(input.defaultChoices).toEqual({
      tags: [
        { kind: "option", optionId: "tag-vivid" },
        { kind: "option", optionId: "tag-concise" },
      ],
      tone: { kind: "option", optionId: "tone-warm" },
    });
  });

  it("renames dependent visibility rules without losing the block default", () => {
    const draft = choiceDraftFromPromptPreset(
      promptPresetRecord({
        variableOrder: ["choice-tone", "choice-style"],
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [
              { id: "tone-warm", label: "Warm", value: "warm" },
              { id: "tone-dry", label: "Dry", value: "dry" },
            ],
            defaultOptionId: "tone-warm",
          },
          {
            id: "choice-style",
            variableName: "style",
            label: "Style",
            options: [{ id: "style-direct", label: "Direct", value: "direct" }],
            visibilityRule: { variableName: "tone", values: ["warm"] },
          },
        ],
        defaultChoices: {
          tone: { kind: "option", optionId: "tone-warm" },
        },
      }),
    );

    const renamed = renamePromptPresetChoiceVariable(draft, "choice-tone", "mood");
    const input = promptPresetChoiceDraftToInput(renamed);

    expect(renamed.choiceBlocks[1]?.visibilityRule).toEqual({
      variableName: "mood",
      values: ["warm"],
    });
    expect(renamed.defaultOptionIdsByBlockId["choice-tone"]).toEqual(["tone-warm"]);
    expect(input.defaultChoices).toEqual({
      mood: { kind: "option", optionId: "tone-warm" },
      style: { kind: "option", optionId: "style-direct" },
    });
  });

  it("keeps visibility bound to a stable controller during transient duplicate names", () => {
    const draft = choiceDraftFromPromptPreset(
      promptPresetRecord({
        variableOrder: ["choice-alpha", "choice-beta", "choice-dependent"],
        choiceBlocks: [
          {
            id: "choice-alpha",
            variableName: "alpha",
            label: "Alpha",
            options: [{ id: "alpha-on", label: "On", value: "on" }],
          },
          {
            id: "choice-beta",
            variableName: "beta",
            label: "Beta",
            options: [{ id: "beta-on", label: "On", value: "on" }],
          },
          {
            id: "choice-dependent",
            variableName: "dependent",
            label: "Dependent",
            options: [{ id: "dependent-on", label: "On", value: "on" }],
            visibilityRule: { variableName: "alpha", values: ["on"] },
          },
        ],
      }),
    );

    const temporarilyDuplicated = renamePromptPresetChoiceVariable(draft, "choice-alpha", "beta");
    const renamed = renamePromptPresetChoiceVariable(temporarilyDuplicated, "choice-beta", "gamma");

    expect(renamed.choiceBlocks[2]?.visibilityRule).toEqual({
      variableName: "beta",
      values: ["on"],
    });
    expect(promptPresetChoiceDraftToInput(renamed).choiceBlocks?.[2]?.visibilityRule).toEqual({
      variableName: "beta",
      values: ["on"],
    });
  });

  it("repairs defaults and visibility values when controller options change", () => {
    const draft = choiceDraftFromPromptPreset(
      promptPresetRecord({
        variableOrder: ["choice-tone", "choice-style"],
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [
              { id: "tone-warm", label: "Warm", value: "warm" },
              { id: "tone-dry", label: "Dry", value: "dry" },
            ],
            defaultOptionId: "tone-warm",
          },
          {
            id: "choice-style",
            variableName: "style",
            label: "Style",
            options: [{ id: "style-direct", label: "Direct", value: "direct" }],
            visibilityRule: { variableName: "tone", values: ["warm", "dry"] },
          },
        ],
        defaultChoices: {
          tone: { kind: "option", optionId: "tone-warm" },
        },
      }),
    );

    const renamedValue = updatePromptPresetChoiceOption(
      draft,
      "choice-tone",
      "tone-warm",
      (option) => ({ ...option, value: "cozy" }),
    );
    expect(renamedValue.choiceBlocks[1]?.visibilityRule?.values).toEqual(["cozy", "dry"]);

    const removedDefault = removePromptPresetChoiceOption(renamedValue, "choice-tone", "tone-warm");
    const input = promptPresetChoiceDraftToInput(removedDefault);

    expect(removedDefault.defaultOptionIdsByBlockId["choice-tone"]).toEqual(["tone-dry"]);
    expect(removedDefault.choiceBlocks[1]?.visibilityRule).toEqual({
      variableName: "tone",
      values: ["dry"],
    });
    expect(input.defaultChoices?.tone).toEqual({ kind: "option", optionId: "tone-dry" });
  });

  it("keeps duplicate controller values valid and blocks blank or stale visibility values", () => {
    const draft = choiceDraftFromPromptPreset(
      promptPresetRecord({
        variableOrder: ["choice-tone", "choice-style"],
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [
              { id: "tone-warm-a", label: "Warm A", value: "warm" },
              { id: "tone-warm-b", label: "Warm B", value: " warm " },
            ],
          },
          {
            id: "choice-style",
            variableName: "style",
            label: "Style",
            options: [{ id: "style-direct", label: "Direct", value: "direct" }],
            visibilityRule: { variableName: "tone", values: ["warm"] },
          },
        ],
      }),
    );

    expect(promptPresetChoiceVisibilityOptions(draft.choiceBlocks[0]!)).toEqual([
      { label: "Warm A", value: "warm" },
    ]);

    const oneDuplicateRemoved = removePromptPresetChoiceOption(draft, "choice-tone", "tone-warm-a");
    expect(oneDuplicateRemoved.choiceBlocks[1]?.visibilityRule?.values).toEqual(["warm"]);
    expect(validatePromptPresetChoiceDraft(oneDuplicateRemoved)).toEqual([]);

    const oneDuplicateEdited = updatePromptPresetChoiceOption(
      draft,
      "choice-tone",
      "tone-warm-a",
      (option) => ({ ...option, value: "hot" }),
    );
    expect(oneDuplicateEdited.choiceBlocks[1]?.visibilityRule?.values).toEqual(["warm"]);

    const lastDuplicateBlanked = updatePromptPresetChoiceOption(
      oneDuplicateEdited,
      "choice-tone",
      "tone-warm-b",
      (option) => ({ ...option, value: " " }),
    );
    expect(lastDuplicateBlanked.choiceBlocks[1]?.visibilityRule?.values).toEqual(["warm"]);
    expect(validatePromptPresetChoiceDraft(lastDuplicateBlanked)).toEqual([
      expect.objectContaining({
        blockId: "choice-style",
        code: "visibility-values-required",
      }),
    ]);

    const staleValue = {
      ...draft,
      choiceBlocks: draft.choiceBlocks.map((block) =>
        block.id === "choice-style"
          ? { ...block, visibilityRule: { variableName: "tone", values: ["warm", "stale"] } }
          : block,
      ),
    };
    expect(validatePromptPresetChoiceDraft(staleValue)).toEqual([
      expect.objectContaining({
        blockId: "choice-style",
        code: "visibility-values-required",
      }),
    ]);
  });

  it("owns visibility controller selection and value toggles in the draft helper", () => {
    const draft = choiceDraftFromPromptPreset(
      promptPresetRecord({
        variableOrder: ["choice-tone", "choice-style"],
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [
              { id: "tone-warm", label: "Warm", value: " warm " },
              { id: "tone-dry", label: "Dry", value: "dry" },
            ],
          },
          {
            id: "choice-style",
            variableName: "style",
            label: "Style",
            options: [{ id: "style-direct", label: "Direct", value: "direct" }],
          },
        ],
      }),
    );

    const selectedController = setPromptPresetChoiceVisibilityController(
      draft,
      "choice-style",
      "choice-tone",
    );
    expect(selectedController.choiceBlocks[1]?.visibilityRule).toEqual({
      variableName: "tone",
      values: ["warm"],
    });

    const addedValue = setPromptPresetChoiceVisibilityValue(
      selectedController,
      "choice-style",
      "dry",
      true,
    );
    expect(addedValue.choiceBlocks[1]?.visibilityRule?.values).toEqual(["warm", "dry"]);

    const removedValues = setPromptPresetChoiceVisibilityValue(
      setPromptPresetChoiceVisibilityValue(addedValue, "choice-style", "warm", false),
      "choice-style",
      "dry",
      false,
    );
    expect(validatePromptPresetChoiceDraft(removedValues)).toEqual([
      expect.objectContaining({
        blockId: "choice-style",
        code: "visibility-values-required",
      }),
    ]);

    const clearedController = setPromptPresetChoiceVisibilityController(
      removedValues,
      "choice-style",
      null,
    );
    expect(clearedController.choiceBlocks[1]).not.toHaveProperty("visibilityRule");
  });

  it("removes block defaults and dependent visibility rules together", () => {
    const draft = choiceDraftFromPromptPreset(
      promptPresetRecord({
        variableOrder: ["choice-tone", "choice-style"],
        choiceBlocks: [
          {
            id: "choice-tone",
            variableName: "tone",
            label: "Tone",
            options: [{ id: "tone-warm", label: "Warm", value: "warm" }],
          },
          {
            id: "choice-style",
            variableName: "style",
            label: "Style",
            options: [{ id: "style-direct", label: "Direct", value: "direct" }],
            visibilityRule: { variableName: "tone", values: ["warm"] },
          },
        ],
        defaultChoices: {
          tone: { kind: "option", optionId: "tone-warm" },
        },
      }),
    );

    const removed = removePromptPresetChoiceBlock(draft, "choice-tone");
    const input = promptPresetChoiceDraftToInput(removed);

    expect(removed.choiceBlocks).toHaveLength(1);
    expect(removed.choiceBlocks[0]).not.toHaveProperty("visibilityRule");
    expect(removed.defaultOptionIdsByBlockId).not.toHaveProperty("choice-tone");
    expect(input.defaultChoices).toEqual({
      style: { kind: "option", optionId: "style-direct" },
    });
  });

  it("creates, reorders, and repairs single or multi-select defaults", () => {
    let draft = addPromptPresetChoiceBlock({
      choiceBlocks: [],
      defaultOptionIdsByBlockId: {},
      visibilityControllerIdsByBlockId: {},
    });
    draft = addPromptPresetChoiceBlock(draft);

    const firstBlock = draft.choiceBlocks[0];
    const secondBlock = draft.choiceBlocks[1];
    expect(firstBlock?.variableName).toBe("choice_1");
    expect(secondBlock?.variableName).toBe("choice_2");
    if (!firstBlock || !secondBlock) throw new Error("expected two draft choice blocks");

    draft = movePromptPresetChoiceBlock(draft, secondBlock.id, -1);
    draft = addPromptPresetChoiceOption(draft, secondBlock.id);
    const addedOption = draft.choiceBlocks[0]?.options[1];
    if (!addedOption) throw new Error("expected a second draft choice option");
    draft = movePromptPresetChoiceOption(draft, secondBlock.id, addedOption.id, -1);
    expect(draft.choiceBlocks[0]?.options[0]?.id).toBe(addedOption.id);

    draft = updatePromptPresetChoiceBlock(draft, secondBlock.id, (block) => ({
      ...block,
      multiSelect: true,
    }));
    draft = setPromptPresetChoiceDefault(draft, secondBlock.id, addedOption.id, true);
    expect(draft.defaultOptionIdsByBlockId[secondBlock.id]).toHaveLength(2);

    draft = updatePromptPresetChoiceBlock(draft, secondBlock.id, (block) => ({
      ...block,
      multiSelect: false,
    }));

    expect(draft.choiceBlocks.map((block) => block.id)).toEqual([secondBlock.id, firstBlock.id]);
    expect(draft.defaultOptionIdsByBlockId[secondBlock.id]).toEqual([secondBlock.options[0]?.id]);
  });

  it("reports invalid labels, duplicate variables, and broken visibility controllers", () => {
    const issues = validatePromptPresetChoiceDraft({
      choiceBlocks: [
        {
          id: "choice-tone",
          variableName: "tone",
          label: "",
          options: [{ id: "tone-warm", label: "", value: "warm" }],
        },
        {
          id: "choice-style",
          variableName: " tone ",
          label: "Style",
          options: [{ id: "style-direct", label: "Direct", value: "direct" }],
          visibilityRule: { variableName: "missing", values: ["enabled"] },
        },
      ],
      defaultOptionIdsByBlockId: {},
      visibilityControllerIdsByBlockId: {},
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      "label-required",
      "option-label-required",
      "variable-duplicate",
      "visibility-controller-missing",
    ]);
  });
});
