import type {
  PromptPresetChoiceBlock,
  PromptPresetChoiceSelection,
  PromptPresetChoiceSelectionValue,
  PromptPresetChoiceSelections,
  PromptPresetRecord,
} from "../../../engine/contracts/types/prompt-presets";
import type { PromptPresetInput } from "../../../engine/prompt-presets/prompt-preset-actions";

export interface PromptPresetChoiceDraftState {
  choiceBlocks: PromptPresetChoiceBlock[];
  defaultOptionIdsByBlockId: Record<string, string[]>;
}

export interface PromptPresetChoiceDraftIssue {
  blockId: string;
  code:
    | "variable-required"
    | "variable-duplicate"
    | "label-required"
    | "option-required"
    | "option-label-required";
  message: string;
}

let choiceDraftIdCounter = 0;

function createChoiceDraftId(prefix: string) {
  choiceDraftIdCounter += 1;
  return `${prefix}-${Date.now()}-${choiceDraftIdCounter}`;
}

function createChoiceDraftOption(label: string) {
  return {
    id: createChoiceDraftId("preset-choice-option"),
    label,
    value: "",
  } satisfies PromptPresetChoiceBlock["options"][number];
}

function cloneChoiceBlocks(choiceBlocks: readonly PromptPresetChoiceBlock[]) {
  return choiceBlocks.map((block) => ({
    ...block,
    options: block.options.map((option) => ({ ...option })),
  }));
}

function selectedOptionId(
  block: PromptPresetChoiceBlock,
  selection: PromptPresetChoiceSelectionValue,
) {
  if (typeof selection !== "string") {
    return block.options.some((option) => option.id === selection.optionId)
      ? selection.optionId
      : null;
  }

  const value = selection.trim();
  return (
    block.options.find((option) => option.value === value)?.id ??
    block.options.find((option) => option.id === value)?.id ??
    null
  );
}

function defaultOptionIds(
  block: PromptPresetChoiceBlock,
  selection: PromptPresetChoiceSelection | null | undefined,
) {
  const selections =
    selection === undefined || selection === null
      ? []
      : Array.isArray(selection)
        ? selection
        : [selection];
  const optionIds = selections.flatMap((value) => selectedOptionId(block, value) ?? []);
  const uniqueOptionIds = [...new Set(optionIds)];
  const fallbackOptionId = block.options[0]?.id;

  if (uniqueOptionIds.length > 0) {
    return block.multiSelect ? uniqueOptionIds : uniqueOptionIds.slice(0, 1);
  }
  return fallbackOptionId ? [fallbackOptionId] : [];
}

export function choiceDraftFromPromptPreset(
  preset: PromptPresetRecord,
): PromptPresetChoiceDraftState {
  const choiceBlocks = cloneChoiceBlocks(preset.choiceBlocks);
  const defaultOptionIdsByBlockId = Object.fromEntries(
    choiceBlocks.map((block) => [
      block.id,
      defaultOptionIds(block, preset.defaultChoices[block.variableName]),
    ]),
  );
  return { choiceBlocks, defaultOptionIdsByBlockId };
}

export function addPromptPresetChoiceBlock(
  draft: PromptPresetChoiceDraftState,
): PromptPresetChoiceDraftState {
  const usedVariableNames = new Set(draft.choiceBlocks.map((block) => block.variableName.trim()));
  let variableIndex = draft.choiceBlocks.length + 1;
  while (usedVariableNames.has(`choice_${variableIndex}`)) variableIndex += 1;

  const option = createChoiceDraftOption("Default");
  const block: PromptPresetChoiceBlock = {
    id: createChoiceDraftId("preset-choice-block"),
    variableName: `choice_${variableIndex}`,
    label: "New Choice",
    options: [option],
    displayMode: "auto",
    optionSort: "manual",
  };

  return {
    ...draft,
    choiceBlocks: [...draft.choiceBlocks, block],
    defaultOptionIdsByBlockId: {
      ...draft.defaultOptionIdsByBlockId,
      [block.id]: [option.id],
    },
  };
}

export function movePromptPresetChoiceBlock(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  direction: -1 | 1,
): PromptPresetChoiceDraftState {
  const currentIndex = draft.choiceBlocks.findIndex((block) => block.id === blockId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= draft.choiceBlocks.length) return draft;

  const choiceBlocks = [...draft.choiceBlocks];
  const [block] = choiceBlocks.splice(currentIndex, 1);
  if (!block) return draft;
  choiceBlocks.splice(nextIndex, 0, block);
  return { ...draft, choiceBlocks };
}

export function updatePromptPresetChoiceBlock(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  update: (block: PromptPresetChoiceBlock) => PromptPresetChoiceBlock,
): PromptPresetChoiceDraftState {
  const currentBlock = draft.choiceBlocks.find((block) => block.id === blockId);
  if (!currentBlock) return draft;

  const nextBlock = update(currentBlock);
  const validDefaults = (draft.defaultOptionIdsByBlockId[blockId] ?? []).filter((optionId) =>
    nextBlock.options.some((option) => option.id === optionId),
  );
  const repairedDefaults =
    validDefaults.length > 0
      ? nextBlock.multiSelect
        ? validDefaults
        : validDefaults.slice(0, 1)
      : nextBlock.options[0]
        ? [nextBlock.options[0].id]
        : [];

  return {
    ...draft,
    choiceBlocks: draft.choiceBlocks.map((block) => (block.id === blockId ? nextBlock : block)),
    defaultOptionIdsByBlockId: {
      ...draft.defaultOptionIdsByBlockId,
      [blockId]: repairedDefaults,
    },
  };
}

export function addPromptPresetChoiceOption(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
): PromptPresetChoiceDraftState {
  const block = draft.choiceBlocks.find((choiceBlock) => choiceBlock.id === blockId);
  if (!block) return draft;
  const option = createChoiceDraftOption(`Option ${block.options.length + 1}`);
  return updatePromptPresetChoiceBlock(draft, blockId, (currentBlock) => ({
    ...currentBlock,
    options: [...currentBlock.options, option],
  }));
}

export function movePromptPresetChoiceOption(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  optionId: string,
  direction: -1 | 1,
): PromptPresetChoiceDraftState {
  const block = draft.choiceBlocks.find((choiceBlock) => choiceBlock.id === blockId);
  if (!block) return draft;
  const currentIndex = block.options.findIndex((option) => option.id === optionId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= block.options.length) return draft;

  const options = [...block.options];
  const [option] = options.splice(currentIndex, 1);
  if (!option) return draft;
  options.splice(nextIndex, 0, option);
  return updatePromptPresetChoiceBlock(draft, blockId, (currentBlock) => ({
    ...currentBlock,
    options,
  }));
}

export function setPromptPresetChoiceDefault(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  optionId: string,
  selected: boolean,
): PromptPresetChoiceDraftState {
  const block = draft.choiceBlocks.find((choiceBlock) => choiceBlock.id === blockId);
  if (!block || !block.options.some((option) => option.id === optionId)) return draft;

  const currentDefaults = draft.defaultOptionIdsByBlockId[blockId] ?? [];
  const nextDefaults = block.multiSelect
    ? selected
      ? [...new Set([...currentDefaults, optionId])]
      : currentDefaults.filter((defaultId) => defaultId !== optionId)
    : selected
      ? [optionId]
      : [];
  if (block.multiSelect && nextDefaults.length === 0) return draft;

  return {
    ...draft,
    defaultOptionIdsByBlockId: {
      ...draft.defaultOptionIdsByBlockId,
      [blockId]: nextDefaults,
    },
  };
}

export function validatePromptPresetChoiceDraft(
  draft: PromptPresetChoiceDraftState,
): PromptPresetChoiceDraftIssue[] {
  const issues: PromptPresetChoiceDraftIssue[] = [];
  const seenVariableNames = new Set<string>();
  for (const block of draft.choiceBlocks) {
    const variableName = block.variableName.trim();
    if (!variableName) {
      issues.push({
        blockId: block.id,
        code: "variable-required",
        message: "Variable is required.",
      });
    } else if (seenVariableNames.has(variableName)) {
      issues.push({
        blockId: block.id,
        code: "variable-duplicate",
        message: `Variable “${variableName}” is already used by another choice.`,
      });
    }
    if (variableName) seenVariableNames.add(variableName);

    if (!block.label.trim()) {
      issues.push({
        blockId: block.id,
        code: "label-required",
        message: "Choice label is required.",
      });
    }
    if (block.options.length === 0) {
      issues.push({
        blockId: block.id,
        code: "option-required",
        message: "Add at least one option.",
      });
    } else if (block.options.some((option) => !option.label.trim())) {
      issues.push({
        blockId: block.id,
        code: "option-label-required",
        message: "Every option needs a label.",
      });
    }
  }

  return issues;
}

export function renamePromptPresetChoiceVariable(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  variableName: string,
): PromptPresetChoiceDraftState {
  const block = draft.choiceBlocks.find((choiceBlock) => choiceBlock.id === blockId);
  if (!block || block.variableName === variableName) return draft;

  return {
    ...draft,
    choiceBlocks: draft.choiceBlocks.map((choiceBlock) =>
      choiceBlock.id === blockId ? { ...choiceBlock, variableName } : choiceBlock,
    ),
  };
}

export function updatePromptPresetChoiceOption(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  optionId: string,
  update: (
    option: PromptPresetChoiceBlock["options"][number],
  ) => PromptPresetChoiceBlock["options"][number],
): PromptPresetChoiceDraftState {
  const controller = draft.choiceBlocks.find((block) => block.id === blockId);
  const currentOption = controller?.options.find((option) => option.id === optionId);
  if (!controller || !currentOption) return draft;

  const nextOption = update(currentOption);
  const nextControllerOptions = controller.options.map((option) =>
    option.id === optionId ? nextOption : option,
  );
  return {
    ...draft,
    choiceBlocks: draft.choiceBlocks.map((block) =>
      block.id === blockId ? { ...block, options: nextControllerOptions } : block,
    ),
  };
}

export function removePromptPresetChoiceOption(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  optionId: string,
): PromptPresetChoiceDraftState {
  const controller = draft.choiceBlocks.find((block) => block.id === blockId);
  const removedOption = controller?.options.find((option) => option.id === optionId);
  if (!controller || !removedOption || controller.options.length <= 1) return draft;

  const remainingOptions = controller.options.filter((option) => option.id !== optionId);
  const currentDefaults = draft.defaultOptionIdsByBlockId[blockId] ?? [];
  const remainingDefaults = currentDefaults.filter((defaultId) => defaultId !== optionId);
  const repairedDefaults =
    remainingDefaults.length > 0
      ? remainingDefaults
      : remainingOptions[0]
        ? [remainingOptions[0].id]
        : [];
  const choiceBlocks = draft.choiceBlocks.map((block) => {
    if (block.id === blockId) {
      return {
        ...block,
        options: remainingOptions,
      };
    }
    return block;
  });

  return {
    ...draft,
    choiceBlocks,
    defaultOptionIdsByBlockId: {
      ...draft.defaultOptionIdsByBlockId,
      [blockId]: repairedDefaults,
    },
  };
}

export function removePromptPresetChoiceBlock(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
): PromptPresetChoiceDraftState {
  const removedBlock = draft.choiceBlocks.find((block) => block.id === blockId);
  if (!removedBlock) return draft;

  const defaultOptionIdsByBlockId = { ...draft.defaultOptionIdsByBlockId };
  delete defaultOptionIdsByBlockId[blockId];
  return {
    ...draft,
    choiceBlocks: draft.choiceBlocks.filter((block) => block.id !== blockId),
    defaultOptionIdsByBlockId,
  };
}

function cleanChoiceBlock(block: PromptPresetChoiceBlock) {
  const options = block.options.map((option) => {
    const cleanedOption = {
      ...option,
      id: option.id.trim(),
      label: option.label.trim(),
      value: option.value.trim(),
    };
    const description = option.description?.trim();
    if (description) cleanedOption.description = description;
    else delete cleanedOption.description;
    return cleanedOption;
  });
  const cleanedBlock = {
    ...block,
    id: block.id.trim(),
    variableName: block.variableName.trim(),
    label: block.label.trim(),
    options,
  } satisfies PromptPresetChoiceBlock;
  const question = block.question?.trim();
  if (question) cleanedBlock.question = question;
  else delete cleanedBlock.question;
  if (!block.separator?.trim()) delete cleanedBlock.separator;
  return cleanedBlock;
}

function defaultChoiceSelection(optionIds: readonly string[]) {
  const selections = optionIds.map(
    (optionId) => ({ kind: "option", optionId }) satisfies PromptPresetChoiceSelectionValue,
  );
  if (selections.length === 0) return null;
  return selections.length === 1 ? selections[0] : selections;
}

export function promptPresetChoiceDraftToInput(
  draft: PromptPresetChoiceDraftState,
): Pick<PromptPresetInput, "choiceBlocks" | "defaultChoices"> {
  const choiceBlocks = draft.choiceBlocks.map(cleanChoiceBlock);
  const defaultChoices: PromptPresetChoiceSelections = {};

  for (const block of choiceBlocks) {
    const optionIds = defaultOptionIds(
      block,
      (draft.defaultOptionIdsByBlockId[block.id] ?? []).map((optionId) => ({
        kind: "option",
        optionId,
      })),
    );
    const selection = defaultChoiceSelection(block.multiSelect ? optionIds : optionIds.slice(0, 1));
    if (selection) defaultChoices[block.variableName] = selection;
  }

  return {
    choiceBlocks,
    defaultChoices,
  };
}
