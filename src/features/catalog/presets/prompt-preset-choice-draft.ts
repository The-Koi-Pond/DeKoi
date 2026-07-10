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
  visibilityControllerIdsByBlockId: Record<string, string>;
}

export interface PromptPresetChoiceDraftIssue {
  blockId: string;
  code:
    | "variable-required"
    | "variable-duplicate"
    | "label-required"
    | "option-required"
    | "option-label-required"
    | "visibility-controller-missing"
    | "visibility-values-required";
  message: string;
}

export interface PromptPresetChoiceVisibilityOption {
  label: string;
  value: string;
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
    visibilityRule: block.visibilityRule
      ? { ...block.visibilityRule, values: [...block.visibilityRule.values] }
      : block.visibilityRule,
  }));
}

function choiceBlocksInOrder(
  choiceBlocks: readonly PromptPresetChoiceBlock[],
  variableOrder: readonly string[],
) {
  const blockById = new Map(choiceBlocks.map((block) => [block.id, block] as const));
  const seen = new Set<string>();
  const orderedBlocks: PromptPresetChoiceBlock[] = [];

  for (const blockId of variableOrder) {
    if (seen.has(blockId)) continue;
    const block = blockById.get(blockId);
    if (!block) continue;
    seen.add(blockId);
    orderedBlocks.push(block);
  }

  for (const block of choiceBlocks) {
    if (seen.has(block.id)) continue;
    seen.add(block.id);
    orderedBlocks.push(block);
  }

  return orderedBlocks;
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
  const fallbackOptionId = block.options.some((option) => option.id === block.defaultOptionId)
    ? block.defaultOptionId
    : block.options[0]?.id;

  if (uniqueOptionIds.length > 0) {
    return block.multiSelect ? uniqueOptionIds : uniqueOptionIds.slice(0, 1);
  }
  return fallbackOptionId ? [fallbackOptionId] : [];
}

export function choiceDraftFromPromptPreset(
  preset: PromptPresetRecord,
): PromptPresetChoiceDraftState {
  const choiceBlocks = cloneChoiceBlocks(
    choiceBlocksInOrder(preset.choiceBlocks, preset.variableOrder),
  );
  const defaultOptionIdsByBlockId = Object.fromEntries(
    choiceBlocks.map((block) => [
      block.id,
      defaultOptionIds(block, preset.defaultChoices[block.variableName]),
    ]),
  );
  const visibilityControllerIdsByBlockId = Object.fromEntries(
    choiceBlocks.flatMap((block) => {
      const controller = choiceBlocks.find(
        (candidate) =>
          candidate.id !== block.id &&
          candidate.variableName === block.visibilityRule?.variableName,
      );
      return controller ? [[block.id, controller.id] as const] : [];
    }),
  );

  return { choiceBlocks, defaultOptionIdsByBlockId, visibilityControllerIdsByBlockId };
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
    defaultOptionId: option.id,
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
    choiceBlocks: draft.choiceBlocks.map((block) =>
      block.id === blockId ? { ...nextBlock, defaultOptionId: repairedDefaults[0] ?? null } : block,
    ),
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

  return {
    ...draft,
    choiceBlocks: draft.choiceBlocks.map((choiceBlock) =>
      choiceBlock.id === blockId
        ? { ...choiceBlock, defaultOptionId: nextDefaults[0] ?? null }
        : choiceBlock,
    ),
    defaultOptionIdsByBlockId: {
      ...draft.defaultOptionIdsByBlockId,
      [blockId]: nextDefaults,
    },
  };
}

function normalizedVisibilityValues(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function promptPresetChoiceVisibilityOptions(
  block: PromptPresetChoiceBlock,
): PromptPresetChoiceVisibilityOption[] {
  const seenValues = new Set<string>();
  const options: PromptPresetChoiceVisibilityOption[] = [];

  for (const option of block.options) {
    const value = option.value.trim();
    if (!value || seenValues.has(value)) continue;
    seenValues.add(value);
    options.push({ label: option.label.trim() || value, value });
  }

  return options;
}

export function setPromptPresetChoiceVisibilityController(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  controllerId: string | null,
): PromptPresetChoiceDraftState {
  const block = draft.choiceBlocks.find((candidate) => candidate.id === blockId);
  if (!block) return draft;

  const controller = controllerId
    ? draft.choiceBlocks.find(
        (candidate) => candidate.id === controllerId && candidate.id !== blockId,
      )
    : null;
  if (controllerId && !controller) return draft;

  const nextDraft = updatePromptPresetChoiceBlock(draft, blockId, (currentBlock) => {
    if (!controller) {
      const nextBlock = { ...currentBlock };
      delete nextBlock.visibilityRule;
      return nextBlock;
    }

    const firstValue = promptPresetChoiceVisibilityOptions(controller)[0]?.value;
    return {
      ...currentBlock,
      visibilityRule: {
        variableName: controller.variableName,
        values: firstValue ? [firstValue] : [],
      },
    };
  });
  const visibilityControllerIdsByBlockId = {
    ...nextDraft.visibilityControllerIdsByBlockId,
  };
  if (controller) visibilityControllerIdsByBlockId[blockId] = controller.id;
  else delete visibilityControllerIdsByBlockId[blockId];
  return { ...nextDraft, visibilityControllerIdsByBlockId };
}

export function setPromptPresetChoiceVisibilityValue(
  draft: PromptPresetChoiceDraftState,
  blockId: string,
  value: string,
  selected: boolean,
): PromptPresetChoiceDraftState {
  const block = draft.choiceBlocks.find((candidate) => candidate.id === blockId);
  const controllerId = draft.visibilityControllerIdsByBlockId[blockId];
  const controller = draft.choiceBlocks.find(
    (candidate) => candidate.id === controllerId && candidate.id !== blockId,
  );
  const normalizedValue = value.trim();
  if (
    !block?.visibilityRule ||
    !controller ||
    !promptPresetChoiceVisibilityOptions(controller).some(
      (option) => option.value === normalizedValue,
    )
  ) {
    return draft;
  }

  const currentValues = normalizedVisibilityValues(block.visibilityRule.values);
  const values = selected
    ? [...new Set([...currentValues, normalizedValue])]
    : currentValues.filter((currentValue) => currentValue !== normalizedValue);

  return updatePromptPresetChoiceBlock(draft, blockId, (currentBlock) => ({
    ...currentBlock,
    visibilityRule: {
      variableName: controller.variableName,
      values,
    },
  }));
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

    if (block.visibilityRule) {
      const controllerId = draft.visibilityControllerIdsByBlockId[block.id];
      const controller = draft.choiceBlocks.find(
        (candidate) => candidate.id === controllerId && candidate.id !== block.id,
      );
      if (!controller || controller.id === block.id) {
        issues.push({
          blockId: block.id,
          code: "visibility-controller-missing",
          message: "Choose another valid choice as the visibility controller.",
        });
      } else {
        const controllerValues = new Set(
          promptPresetChoiceVisibilityOptions(controller).map((option) => option.value),
        );
        const visibilityValues = block.visibilityRule.values.map((value) => value.trim());
        const hasOnlyValidValues =
          visibilityValues.length > 0 &&
          visibilityValues.every((value) => Boolean(value) && controllerValues.has(value));
        if (!hasOnlyValidValues) {
          issues.push({
            blockId: block.id,
            code: "visibility-values-required",
            message: "Choose at least one controller value for visibility.",
          });
        }
      }
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
    choiceBlocks: draft.choiceBlocks.map((choiceBlock) => {
      if (choiceBlock.id === blockId) return { ...choiceBlock, variableName };
      if (draft.visibilityControllerIdsByBlockId[choiceBlock.id] !== blockId) return choiceBlock;
      if (!choiceBlock.visibilityRule) return choiceBlock;

      return {
        ...choiceBlock,
        visibilityRule: { ...choiceBlock.visibilityRule, variableName },
      };
    }),
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
  const currentValue = currentOption.value.trim();
  const nextValue = nextOption.value.trim();
  const currentValueStillExists = nextControllerOptions.some(
    (option) => option.id !== optionId && option.value.trim() === currentValue,
  );
  const nextBlocks = draft.choiceBlocks.map((block) => {
    if (block.id === blockId) {
      return {
        ...block,
        options: nextControllerOptions,
      };
    }
    if (
      !currentValue ||
      !nextValue ||
      currentValue === nextValue ||
      currentValueStillExists ||
      draft.visibilityControllerIdsByBlockId[block.id] !== controller.id ||
      !block.visibilityRule ||
      !block.visibilityRule.values.some((value) => value.trim() === currentValue)
    ) {
      return block;
    }

    return {
      ...block,
      visibilityRule: {
        ...block.visibilityRule,
        values: [
          ...new Set(
            block.visibilityRule.values.map((value) =>
              value.trim() === currentValue ? nextValue : value.trim(),
            ),
          ),
        ],
      },
    };
  });

  return { ...draft, choiceBlocks: nextBlocks };
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
  const removedValue = removedOption.value.trim();
  const removedValueStillExists = remainingOptions.some(
    (option) => option.value.trim() === removedValue,
  );
  const currentDefaults = draft.defaultOptionIdsByBlockId[blockId] ?? [];
  const remainingDefaults = currentDefaults.filter((defaultId) => defaultId !== optionId);
  const repairedDefaults =
    remainingDefaults.length > 0
      ? remainingDefaults
      : remainingOptions[0]
        ? [remainingOptions[0].id]
        : [];
  const clearedVisibilityBlockIds = new Set<string>();
  const choiceBlocks = draft.choiceBlocks.map((block) => {
    if (block.id === blockId) {
      return {
        ...block,
        options: remainingOptions,
        defaultOptionId: repairedDefaults[0] ?? null,
      };
    }
    if (
      !removedValue ||
      removedValueStillExists ||
      draft.visibilityControllerIdsByBlockId[block.id] !== controller.id ||
      !block.visibilityRule
    ) {
      return block;
    }

    const values = block.visibilityRule.values.filter((value) => value.trim() !== removedValue);
    if (values.length === block.visibilityRule.values.length) return block;
    if (values.length === 0) {
      clearedVisibilityBlockIds.add(block.id);
      const nextBlock = { ...block };
      delete nextBlock.visibilityRule;
      return nextBlock;
    }
    return { ...block, visibilityRule: { ...block.visibilityRule, values } };
  });

  return {
    ...draft,
    choiceBlocks,
    defaultOptionIdsByBlockId: {
      ...draft.defaultOptionIdsByBlockId,
      [blockId]: repairedDefaults,
    },
    visibilityControllerIdsByBlockId: Object.fromEntries(
      Object.entries(draft.visibilityControllerIdsByBlockId).filter(
        ([dependentBlockId]) => !clearedVisibilityBlockIds.has(dependentBlockId),
      ),
    ),
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
  const visibilityControllerIdsByBlockId = {
    ...draft.visibilityControllerIdsByBlockId,
  };
  delete visibilityControllerIdsByBlockId[blockId];
  for (const [dependentBlockId, controllerId] of Object.entries(visibilityControllerIdsByBlockId)) {
    if (controllerId === blockId) delete visibilityControllerIdsByBlockId[dependentBlockId];
  }

  return {
    ...draft,
    choiceBlocks: draft.choiceBlocks
      .filter((block) => block.id !== blockId)
      .map((block) => {
        if (draft.visibilityControllerIdsByBlockId[block.id] !== removedBlock.id) return block;
        const nextBlock = { ...block };
        delete nextBlock.visibilityRule;
        return nextBlock;
      }),
    defaultOptionIdsByBlockId,
    visibilityControllerIdsByBlockId,
  };
}

function cleanChoiceBlock(block: PromptPresetChoiceBlock, defaultOptionIds: readonly string[]) {
  const options = block.options.map((option) => ({
    ...option,
    id: option.id.trim(),
    label: option.label.trim(),
    value: option.value.trim(),
    ...(option.description?.trim() ? { description: option.description.trim() } : {}),
  }));
  const validDefaultOptionIds = defaultOptionIds.filter((optionId) =>
    options.some((option) => option.id === optionId),
  );
  const firstDefaultOptionId = validDefaultOptionIds[0] ?? options[0]?.id ?? null;

  return {
    ...block,
    id: block.id.trim(),
    variableName: block.variableName.trim(),
    label: block.label.trim(),
    options,
    defaultOptionId: firstDefaultOptionId,
  } satisfies PromptPresetChoiceBlock;
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
): Pick<PromptPresetInput, "choiceBlocks" | "defaultChoices" | "variableOrder"> {
  const choiceBlocks = draft.choiceBlocks.map((block) => {
    const controllerId = draft.visibilityControllerIdsByBlockId[block.id];
    const controller = draft.choiceBlocks.find(
      (candidate) => candidate.id === controllerId && candidate.id !== block.id,
    );
    const blockWithController =
      block.visibilityRule && controller
        ? {
            ...block,
            visibilityRule: {
              ...block.visibilityRule,
              variableName: controller.variableName,
            },
          }
        : block;
    return cleanChoiceBlock(blockWithController, draft.defaultOptionIdsByBlockId[block.id] ?? []);
  });
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
    variableOrder: choiceBlocks.map((block) => block.id),
  };
}
