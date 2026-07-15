import type {
  PromptPresetChoiceBlock,
  PromptPresetChoiceOptionSelection,
  PromptPresetChoiceSelection,
  PromptPresetChoiceSelectionValue,
  PromptPresetChoiceSelections,
  PromptPresetGroup,
  PromptPresetParameters,
  PromptPresetRecord,
  PromptPresetSection,
  PromptPresetSectionRole,
  PromptPresetThreadChoiceSelection,
  PromptPresetThreadChoiceSelections,
} from "../contracts/types/prompt-presets";
import {
  normalizeGenerationParameterEntries,
  normalizeGenerationParameterValueEntry,
  type GenerationJsonValue,
  type GenerationParameterEntry,
} from "../generation-core/generation-parameter-contract";
import {
  validateGenerationCustomParameter,
  validateGenerationCustomParameters,
  validateGenerationCustomParameterValue,
} from "../generation-core/generation-custom-parameter-policy";
import {
  PROMPT_PRESET_NUMERIC_CONSTRAINTS,
  promptPresetParametersAreValid,
  type PromptPresetNumericConstraint,
} from "./prompt-preset-parameter-contract";

function cleanNullableNumber(value: unknown, constraint: PromptPresetNumericConstraint) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.max(constraint.minimum, Math.min(constraint.maximum, value));
  return constraint.integer ? Math.round(normalized) : normalized;
}

function cleanNullableBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeCustomParameterEntries(
  value: unknown,
): Record<string, GenerationParameterEntry<GenerationJsonValue>> | null {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return null;

  const result: Record<string, GenerationParameterEntry<GenerationJsonValue>> = {};
  for (const [name, rawEntry] of Object.entries(source)) {
    const entry = normalizeGenerationParameterValueEntry(
      rawEntry,
      validateGenerationCustomParameterValue,
    );
    if (!entry || !validateGenerationCustomParameter(name, entry.value).valid) continue;
    result[name] = entry;
  }

  if (Object.keys(result).length === 0) return null;
  const effectiveValues = Object.fromEntries(
    Object.entries(result).map(([name, entry]) => [name, entry.value]),
  );
  return validateGenerationCustomParameters(effectiveValues) ? result : null;
}

export function normalizePromptPresetParameters(value: unknown): PromptPresetParameters | null {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return null;

  const parameters: PromptPresetParameters = normalizeGenerationParameterEntries(source);
  const maxContext = cleanNullableNumber(
    source.maxContext,
    PROMPT_PRESET_NUMERIC_CONSTRAINTS.maxContext,
  );
  const assistantPrefill = readNullableString(source.assistantPrefill);
  const customThinkingTags = readNullableString(source.customThinkingTags);
  const customParameters = normalizeCustomParameterEntries(source.customParameters);
  const squashSystemMessages = cleanNullableBoolean(source.squashSystemMessages);
  const showThoughts = cleanNullableBoolean(source.showThoughts);
  const useMaxContext = cleanNullableBoolean(source.useMaxContext);
  const strictRoleFormatting = cleanNullableBoolean(source.strictRoleFormatting);
  const singleUserMessage = cleanNullableBoolean(source.singleUserMessage);

  if (maxContext !== null) parameters.maxContext = maxContext;
  if (assistantPrefill !== null) parameters.assistantPrefill = assistantPrefill;
  if (customThinkingTags !== null) parameters.customThinkingTags = customThinkingTags;
  if (customParameters !== null) parameters.customParameters = customParameters;
  if (squashSystemMessages !== null) parameters.squashSystemMessages = squashSystemMessages;
  if (showThoughts !== null) parameters.showThoughts = showThoughts;
  if (useMaxContext !== null) parameters.useMaxContext = useMaxContext;
  if (strictRoleFormatting !== null) parameters.strictRoleFormatting = strictRoleFormatting;
  if (singleUserMessage !== null) parameters.singleUserMessage = singleUserMessage;

  return Object.keys(parameters).length > 0 ? parameters : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBooleanLike(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function readNullableString(value: unknown) {
  const trimmed = readString(value).trim();
  return trimmed ? trimmed : null;
}

function readNullableRawString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readTrimmedString(value: unknown) {
  return readString(value).trim();
}

function readTimestamp(value: unknown, fallback: string) {
  const timestamp = readString(value).trim();
  return timestamp && !Number.isNaN(Date.parse(timestamp)) ? timestamp : fallback;
}

export function normalizeStringArray(value: unknown): string[] {
  const source = parseJsonIfString(value);
  if (!Array.isArray(source)) return [];

  const strings: string[] = [];
  for (const item of source) {
    const stringValue = readTrimmedString(item);
    if (stringValue) strings.push(stringValue);
  }

  return strings;
}

export function normalizeStringRecord(value: unknown): Record<string, string> {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return {};

  const record: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim();
    if (!key || typeof rawValue !== "string") continue;
    record[key] = rawValue.trim();
  }

  return record;
}

function createPromptPresetChoiceOptionSelection(
  optionId: string,
): PromptPresetChoiceOptionSelection | null {
  const cleanOptionId = optionId.trim();
  return cleanOptionId ? { kind: "option", optionId: cleanOptionId } : null;
}

function normalizeChoiceSelectionValue(value: unknown): PromptPresetChoiceSelectionValue | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (isRecord(value) && value.kind === "option") {
    return createPromptPresetChoiceOptionSelection(readTrimmedString(value.optionId));
  }

  return null;
}

function choiceSelectionValueKey(value: PromptPresetChoiceSelectionValue) {
  return typeof value === "string" ? `value:${value}` : `option:${value.optionId}`;
}

function normalizeChoiceSelection(value: unknown): PromptPresetChoiceSelection | null {
  const singleSelection = normalizeChoiceSelectionValue(value);
  if (singleSelection !== null) return singleSelection;

  if (!Array.isArray(value)) return null;

  const selections: PromptPresetChoiceSelectionValue[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const selection = normalizeChoiceSelectionValue(item);
    if (selection === null) continue;

    const key = choiceSelectionValueKey(selection);
    if (seen.has(key)) continue;

    seen.add(key);
    selections.push(selection);
  }

  return selections.length > 0 ? selections : null;
}

export function normalizeChoiceSelectionRecord(value: unknown): PromptPresetChoiceSelections {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return {};

  const record: PromptPresetChoiceSelections = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey.trim();
    const selection = normalizeChoiceSelection(rawValue);
    if (key && selection !== null) record[key] = selection;
  }

  return record;
}

export function normalizeUnknownArray(value: unknown): unknown[] {
  const source = parseJsonIfString(value);
  return Array.isArray(source) ? [...source] : [];
}

function normalizeChoiceOptions(value: unknown): PromptPresetChoiceBlock["options"] {
  const source = parseJsonIfString(value);
  if (!Array.isArray(source)) return [];

  const seenOptionIds = new Set<string>();
  const options: PromptPresetChoiceBlock["options"] = [];

  for (const item of source) {
    if (!isRecord(item)) continue;

    const id = readTrimmedString(item.id);
    const label = readTrimmedString(item.label);
    if (!id || !label || seenOptionIds.has(id) || typeof item.value !== "string") continue;

    const option: PromptPresetChoiceBlock["options"][number] = {
      id,
      label,
      value: item.value.trim(),
    };
    const description = readNullableString(item.description);
    if (description !== null) option.description = description;

    seenOptionIds.add(id);
    options.push(option);
  }

  return options;
}

interface ChoiceOptionIndex {
  optionsById: Map<string, PromptPresetChoiceBlock["options"][number]>;
  optionsByValue: Map<string, PromptPresetChoiceBlock["options"][number]>;
}

function createChoiceOptionIndex(options: PromptPresetChoiceBlock["options"]): ChoiceOptionIndex {
  const optionsById = new Map<string, PromptPresetChoiceBlock["options"][number]>();
  const optionsByValue = new Map<string, PromptPresetChoiceBlock["options"][number]>();

  for (const option of options) {
    optionsById.set(option.id, option);
    if (!optionsByValue.has(option.value)) optionsByValue.set(option.value, option);
  }

  return { optionsById, optionsByValue };
}

function findChoiceSelectionOption(
  optionIndex: ChoiceOptionIndex,
  selection: PromptPresetChoiceSelectionValue,
) {
  if (typeof selection !== "string") {
    return optionIndex.optionsById.get(selection.optionId) ?? null;
  }

  const trimmed = selection.trim();
  if (!trimmed && selection.length > 0) return null;

  const optionByValue = optionIndex.optionsByValue.get(trimmed);
  if (optionByValue) return optionByValue;
  if (!trimmed) return null;

  return optionIndex.optionsById.get(trimmed) ?? null;
}

export function normalizePromptPresetChoiceBlocks(
  value: unknown,
  defaultChoices: PromptPresetChoiceSelections = {},
): PromptPresetChoiceBlock[] {
  if (!Array.isArray(value)) return [];

  const seenBlockIds = new Set<string>();
  const seenVariableNames = new Set<string>();
  const blocks: PromptPresetChoiceBlock[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;

    const id = readTrimmedString(item.id);
    const variableName = readTrimmedString(item.variableName);
    if (!id || !variableName || seenBlockIds.has(id) || seenVariableNames.has(variableName)) {
      continue;
    }

    const options = normalizeChoiceOptions(item.options);
    if (options.length === 0) continue;
    const optionIndex = createChoiceOptionIndex(options);

    const defaultChoiceValue = defaultChoices[variableName];
    const firstDefaultChoice = Array.isArray(defaultChoiceValue)
      ? defaultChoiceValue[0]
      : defaultChoiceValue;
    const defaultOptionByChoice =
      firstDefaultChoice !== undefined
        ? findChoiceSelectionOption(optionIndex, firstDefaultChoice)
        : null;
    const defaultOptionId = defaultOptionByChoice?.id ?? readTrimmedString(item.defaultOptionId);
    const normalizedDefaultOptionId = optionIndex.optionsById.has(defaultOptionId)
      ? defaultOptionId
      : options[0]?.id;

    seenBlockIds.add(id);
    seenVariableNames.add(variableName);
    const question = readNullableString(item.question);
    const label = readTrimmedString(item.label) || question || variableName;
    const block: PromptPresetChoiceBlock = {
      id,
      variableName,
      label,
      options,
    };
    const presetId = readNullableString(item.presetId);
    const separator = readNullableRawString(item.separator);
    const displayMode =
      item.displayMode === "buttons" ||
      item.displayMode === "listbox" ||
      item.displayMode === "auto"
        ? item.displayMode
        : null;
    const optionSort =
      item.optionSort === "alphabetical" || item.optionSort === "manual" ? item.optionSort : null;
    const sortOrder = cleanNullableNumber(
      item.sortOrder,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.choiceSortOrder,
    );
    const createdAt = readNullableString(item.createdAt);

    if (presetId !== null) block.presetId = presetId;
    if (question !== null) block.question = question;
    if (normalizedDefaultOptionId) block.defaultOptionId = normalizedDefaultOptionId;
    if (typeof item.multiSelect === "boolean" || typeof item.multiSelect === "string") {
      block.multiSelect = readBooleanLike(item.multiSelect, false);
    }
    if (separator !== null) block.separator = separator;
    if (displayMode !== null) block.displayMode = displayMode;
    if (optionSort !== null) block.optionSort = optionSort;
    if (sortOrder !== null) block.sortOrder = sortOrder;
    if (createdAt !== null) block.createdAt = createdAt;

    blocks.push(block);
  }

  return blocks;
}

function choiceSelectionIsValid(
  optionIndex: ChoiceOptionIndex,
  value: PromptPresetChoiceSelectionValue,
) {
  return findChoiceSelectionOption(optionIndex, value) !== null;
}

export function prunePromptPresetDefaultChoices(
  defaultChoices: PromptPresetChoiceSelections,
  choiceBlocks: PromptPresetChoiceBlock[],
): PromptPresetChoiceSelections {
  const blocksByVariableName = new Map(
    choiceBlocks.map(
      (block) => [block.variableName, createChoiceOptionIndex(block.options)] as const,
    ),
  );
  const prunedChoices: PromptPresetChoiceSelections = {};

  for (const [variableName, selection] of Object.entries(defaultChoices)) {
    const optionIndex = blocksByVariableName.get(variableName);
    if (!optionIndex) continue;

    if (Array.isArray(selection)) {
      const validSelections = selection.filter((value) =>
        choiceSelectionIsValid(optionIndex, value),
      );
      if (validSelections.length > 0) prunedChoices[variableName] = validSelections;
      continue;
    }

    if (choiceSelectionIsValid(optionIndex, selection)) {
      prunedChoices[variableName] = selection;
    }
  }

  return prunedChoices;
}

function normalizeThreadChoiceSelection(value: unknown): PromptPresetThreadChoiceSelection | null {
  if (isRecord(value) && value.kind === "option") {
    return createPromptPresetChoiceOptionSelection(readTrimmedString(value.optionId));
  }
  if (!Array.isArray(value)) return null;

  const selections: PromptPresetChoiceOptionSelection[] = [];
  const seenOptionIds = new Set<string>();
  for (const item of value) {
    if (!isRecord(item) || item.kind !== "option") continue;
    const selection = createPromptPresetChoiceOptionSelection(readTrimmedString(item.optionId));
    if (!selection || seenOptionIds.has(selection.optionId)) continue;
    seenOptionIds.add(selection.optionId);
    selections.push(selection);
  }
  return selections.length > 0 ? selections : null;
}

/** Normalizes the native block-ID/option-ID thread selection shape. */
export function normalizePromptPresetThreadChoiceSelections(
  value: unknown,
): PromptPresetThreadChoiceSelections {
  return normalizePromptPresetThreadChoiceSelectionsWithChange(value).selections;
}

function threadChoiceSelectionMatchesSource(
  selection: PromptPresetThreadChoiceSelection,
  source: unknown,
): boolean {
  if (Array.isArray(selection)) {
    return (
      Array.isArray(source) &&
      source.length === selection.length &&
      selection.every((item, index) => threadChoiceSelectionMatchesSource(item, source[index]))
    );
  }
  if (!isRecord(source) || Array.isArray(source)) return false;
  const keys = Object.keys(source);
  return keys.length === 2 && source.kind === "option" && source.optionId === selection.optionId;
}

function threadChoiceSelectionsMatchSource(
  selections: PromptPresetThreadChoiceSelections,
  source: unknown,
) {
  if (!isRecord(source)) return false;
  const sourceEntries = Object.entries(source);
  const selectionBlockIds = Object.keys(selections);
  return (
    sourceEntries.length === selectionBlockIds.length &&
    sourceEntries.every(
      ([blockId, selection]) =>
        Object.prototype.hasOwnProperty.call(selections, blockId) &&
        threadChoiceSelectionMatchesSource(selections[blockId]!, selection),
    )
  );
}

/** Also reports whether normalization changed the supplied durable value. */
export function normalizePromptPresetThreadChoiceSelectionsWithChange(value: unknown): {
  selections: PromptPresetThreadChoiceSelections;
  changed: boolean;
} {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) {
    return { selections: {}, changed: value !== undefined };
  }

  const selections: PromptPresetThreadChoiceSelections = Object.create(null);
  for (const [rawBlockId, rawSelection] of Object.entries(source)) {
    const blockId = rawBlockId.trim();
    const selection = normalizeThreadChoiceSelection(rawSelection);
    if (blockId && selection) selections[blockId] = selection;
  }
  return {
    selections,
    changed: typeof value === "string" || !threadChoiceSelectionsMatchSource(selections, source),
  };
}

/** Removes selections that do not resolve to a block and option in the preset. */
export function prunePromptPresetThreadChoiceSelections(
  preset: PromptPresetRecord,
  value: unknown,
): PromptPresetThreadChoiceSelections {
  const selections = normalizePromptPresetThreadChoiceSelections(value);
  const pruned: PromptPresetThreadChoiceSelections = Object.create(null);

  for (const block of preset.choiceBlocks) {
    const selection = selections[block.id];
    const candidates = selection ? (Array.isArray(selection) ? selection : [selection]) : [];
    const validOptionIds = new Set(block.options.map((option) => option.id));
    const validSelections = candidates.filter((candidate) =>
      validOptionIds.has(candidate.optionId),
    );
    if (validSelections.length === 0) continue;

    pruned[block.id] = block.multiSelect === true ? validSelections : validSelections[0]!;
  }

  return pruned;
}

/** Materializes the stable thread selection shape using preset default, block default, or first option. */
export function materializePromptPresetThreadChoiceSelections(
  preset: PromptPresetRecord,
  value: unknown,
): PromptPresetThreadChoiceSelections {
  const existing = prunePromptPresetThreadChoiceSelections(preset, value);
  const materialized: PromptPresetThreadChoiceSelections = Object.assign(
    Object.create(null),
    existing,
  );
  for (const block of preset.choiceBlocks) {
    if (Object.prototype.hasOwnProperty.call(materialized, block.id)) continue;
    const configured = preset.defaultChoices[block.variableName];
    const candidates =
      configured === undefined ? (block.defaultOptionId ?? block.options[0]?.id) : configured;
    const values = Array.isArray(candidates) ? candidates : [candidates];
    const optionIds = values
      .map((candidate) => {
        if (typeof candidate === "object" && candidate !== null && "optionId" in candidate) {
          return typeof candidate.optionId === "string" ? candidate.optionId : null;
        }
        const text = typeof candidate === "string" ? candidate : "";
        return (
          block.options.find((option) => option.value === text || option.id === text)?.id ?? null
        );
      })
      .filter((optionId): optionId is string => optionId !== null);
    if (optionIds.length > 0) {
      materialized[block.id] = block.multiSelect
        ? optionIds.map((optionId) => ({ kind: "option" as const, optionId }))
        : { kind: "option", optionId: optionIds[0]! };
    }
  }
  return materialized;
}

/** A variable-bearing preset is confirmed only after its preset id has a durable history key. */
export function promptPresetChoiceSelectionsAreConfirmed(
  preset: PromptPresetRecord | null | undefined,
  selectionsByPresetId: Record<string, PromptPresetThreadChoiceSelections> | null | undefined,
): boolean {
  if (!preset || !Array.isArray(preset.choiceBlocks) || preset.choiceBlocks.length === 0)
    return true;
  const presetId = preset.id.trim();
  return Boolean(
    presetId &&
    selectionsByPresetId &&
    Object.prototype.hasOwnProperty.call(selectionsByPresetId, presetId),
  );
}

interface PromptPresetChoiceControlOption {
  id: string;
  label: string;
  value: string;
  selection: PromptPresetChoiceOptionSelection;
  description?: string | null;
}

/** UI-ready projection shared by Messenger and Roleplay thread settings. */
export interface PromptPresetChoiceControl {
  id: string;
  variableName: string;
  label: string;
  question?: string;
  multiSelect: boolean;
  displayMode: "auto" | "buttons" | "listbox";
  defaultLabel: string;
  selectedOptionIds: string[];
  selectedValues: string[];
  options: PromptPresetChoiceControlOption[];
}

function choiceControlOptions(block: PromptPresetChoiceBlock) {
  const options = block.options.map((option) => ({
    id: option.id,
    label: option.label,
    value: option.value,
    selection: createPromptPresetChoiceOptionSelection(option.id) ?? {
      kind: "option" as const,
      optionId: option.id,
    },
    ...(option.description ? { description: option.description } : {}),
  }));
  if (block.optionSort !== "alphabetical") return options;

  return options.sort(
    (left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" }) ||
      left.label.localeCompare(right.label),
  );
}

function getPromptPresetChoiceBlocksInOrder(preset: PromptPresetRecord) {
  if (preset.variableOrder.length === 0) return preset.choiceBlocks;

  const orderByBlockId = new Map(preset.variableOrder.map((blockId, index) => [blockId, index]));
  return [...preset.choiceBlocks].sort((left, right) => {
    const leftOrder = orderByBlockId.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = orderByBlockId.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function choiceSelectionOptions(
  block: PromptPresetChoiceBlock,
  selection: PromptPresetChoiceSelection | null | undefined,
): PromptPresetChoiceBlock["options"] {
  const candidates = Array.isArray(selection)
    ? selection
    : selection === null || selection === undefined
      ? []
      : [selection];
  const seen = new Set<string>();
  const options: PromptPresetChoiceBlock["options"] = [];
  const optionIndex = createChoiceOptionIndex(block.options);

  for (const candidate of candidates) {
    const option = findChoiceSelectionOption(optionIndex, candidate);
    if (!option || seen.has(option.id)) continue;

    seen.add(option.id);
    options.push(option);
  }

  return options;
}

function choiceSelectionValues(
  block: PromptPresetChoiceBlock,
  selection: PromptPresetChoiceSelection | null | undefined,
): string[] {
  const values: string[] = [];
  const seenValues = new Set<string>();

  for (const option of choiceSelectionOptions(block, selection)) {
    if (seenValues.has(option.value)) continue;

    seenValues.add(option.value);
    values.push(option.value);
  }

  return values;
}

function choiceSelectionOptionIds(
  block: PromptPresetChoiceBlock,
  selection: PromptPresetChoiceSelection | null | undefined,
): string[] {
  return choiceSelectionOptions(block, selection).map((option) => option.id);
}

function defaultChoiceSelection(
  preset: PromptPresetRecord,
  block: PromptPresetChoiceBlock,
): PromptPresetChoiceSelection | null {
  const presetDefault = preset.defaultChoices[block.variableName];
  if (presetDefault !== undefined) return presetDefault;
  if (block.defaultOptionId) return createPromptPresetChoiceOptionSelection(block.defaultOptionId);
  return block.options[0]?.value ?? null;
}

function resolvePromptPresetChoiceValues({
  block,
  preset,
  selection,
}: {
  block: PromptPresetChoiceBlock;
  preset: PromptPresetRecord;
  selection: PromptPresetChoiceSelection | null | undefined;
}) {
  const selectedValues = choiceSelectionValues(block, selection);
  if (selectedValues.length > 0) return selectedValues;

  const defaultValues = choiceSelectionValues(block, defaultChoiceSelection(preset, block));
  return defaultValues.length > 0
    ? defaultValues
    : block.options[0]
      ? [block.options[0].value]
      : [];
}

function defaultChoiceLabel(preset: PromptPresetRecord, block: PromptPresetChoiceBlock) {
  const labels = choiceSelectionOptions(block, defaultChoiceSelection(preset, block)).map(
    (option) => option.label,
  );
  return labels.length > 0 ? `Preset default: ${labels.join(", ")}` : "Preset default";
}

export function resolvePromptPresetChoiceControls({
  preset,
  selections,
}: {
  preset: PromptPresetRecord | null | undefined;
  selections?: PromptPresetThreadChoiceSelections | null;
}): PromptPresetChoiceControl[] {
  if (!preset) return [];

  const normalizedSelections = prunePromptPresetThreadChoiceSelections(preset, selections);
  return getPromptPresetChoiceBlocksInOrder(preset).map((block) => ({
    id: block.id,
    variableName: block.variableName,
    label: block.label,
    ...(block.question?.trim() ? { question: block.question.trim() } : {}),
    multiSelect: block.multiSelect === true,
    displayMode: block.displayMode ?? "auto",
    defaultLabel: defaultChoiceLabel(preset, block),
    selectedOptionIds: choiceSelectionOptionIds(block, normalizedSelections[block.id]),
    selectedValues: choiceSelectionValues(block, normalizedSelections[block.id]),
    options: choiceControlOptions(block),
  }));
}

/** Updates one block selection, then re-prunes the complete native selection map. */
export function updatePromptPresetChoiceSelections(
  preset: PromptPresetRecord,
  selections: PromptPresetThreadChoiceSelections,
  blockId: string,
  selection: PromptPresetThreadChoiceSelection | null,
): PromptPresetThreadChoiceSelections {
  const nextSelections = prunePromptPresetThreadChoiceSelections(preset, selections);
  const cleanBlockId = blockId.trim();
  if (!preset.choiceBlocks.some((block) => block.id === cleanBlockId)) return nextSelections;

  const cleanSelection = normalizeThreadChoiceSelection(selection);
  if (cleanSelection) nextSelections[cleanBlockId] = cleanSelection;
  else delete nextSelections[cleanBlockId];
  return prunePromptPresetThreadChoiceSelections(preset, nextSelections);
}

function normalizeSectionRole(value: unknown): PromptPresetSectionRole {
  return value === "user" || value === "assistant" || value === "system" ? value : "system";
}

function normalizeMarkerConfig(value: unknown) {
  const source = parseJsonIfString(value);
  if (!isRecord(source)) return null;

  const type = readTrimmedString(source.type);
  return type ? { type } : null;
}

export function normalizePromptPresetSections(value: unknown): PromptPresetSection[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const sections: PromptPresetSection[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;

    const id = readTrimmedString(item.id);
    if (!id || seenIds.has(id)) continue;

    const name = readTrimmedString(item.name) || id;
    const section: PromptPresetSection = {
      id,
      identifier: readTrimmedString(item.identifier) || id,
      name,
      content: readString(item.content).trim(),
      role: normalizeSectionRole(item.role),
      enabled: readBooleanLike(item.enabled, true),
      isMarker: readBooleanLike(item.isMarker, false),
    };
    const presetId = readNullableString(item.presetId);
    const groupId = readNullableString(item.groupId);
    const markerConfig = normalizeMarkerConfig(item.markerConfig);
    const injectionPosition = readNullableString(item.injectionPosition);
    const injectionDepth = cleanNullableNumber(
      item.injectionDepth,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.sectionInjectionDepth,
    );
    const injectionOrder = cleanNullableNumber(
      item.injectionOrder,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.sectionInjectionOrder,
    );
    const xmlTagName = readNullableString(item.xmlTagName);

    if (presetId !== null) section.presetId = presetId;
    if (groupId !== null) section.groupId = groupId;
    if (markerConfig !== null) section.markerConfig = markerConfig;
    if (injectionPosition !== null) section.injectionPosition = injectionPosition;
    if (injectionDepth !== null) section.injectionDepth = injectionDepth;
    if (injectionOrder !== null) section.injectionOrder = injectionOrder;
    if (typeof item.wrapInXml === "boolean" || typeof item.wrapInXml === "string") {
      section.wrapInXml = readBooleanLike(item.wrapInXml, false);
    }
    if (!section.isMarker && xmlTagName !== null) section.xmlTagName = xmlTagName;
    if (typeof item.forbidOverrides === "boolean" || typeof item.forbidOverrides === "string") {
      section.forbidOverrides = readBooleanLike(item.forbidOverrides, false);
    }

    seenIds.add(id);
    sections.push(section);
  }

  return sections;
}

export function normalizePromptPresetGroups(value: unknown): PromptPresetGroup[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const groups: PromptPresetGroup[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;

    const id = readTrimmedString(item.id);
    if (!id || seenIds.has(id)) continue;

    const group: PromptPresetGroup = {
      id,
      name: readTrimmedString(item.name) || id,
    };
    const presetId = readNullableString(item.presetId);
    const parentGroupId = readNullableString(item.parentGroupId);
    const order = cleanNullableNumber(item.order, PROMPT_PRESET_NUMERIC_CONSTRAINTS.groupOrder);
    const createdAt = readNullableString(item.createdAt);

    if (presetId !== null || item.presetId === null) group.presetId = presetId;
    if (parentGroupId !== null || item.parentGroupId === null) {
      group.parentGroupId = parentGroupId;
    }
    if (order !== null || item.order === null) group.order = order;
    if (typeof item.enabled === "boolean" || typeof item.enabled === "string") {
      group.enabled = readBooleanLike(item.enabled, true);
    }
    if (createdAt !== null || item.createdAt === null) group.createdAt = createdAt;

    seenIds.add(id);
    groups.push(group);
  }

  return groups;
}

function normalizePromptPresetRecordFromParts({
  choiceBlocks,
  createdAt,
  defaultChoices,
  folderId = null,
  groupOrder,
  groups,
  id,
  parameters,
  schemaVersion = 1,
  sectionOrder,
  sections,
  summary,
  systemPrompt,
  title,
  updatedAt,
  variableGroups,
  variableOrder,
  variableValues,
  wrapFormat = null,
  author = null,
  messengerPrompt = null,
}: {
  id: string;
  schemaVersion?: 1;
  title: string;
  summary?: string | null;
  systemPrompt: string;
  messengerPrompt?: string | null;
  parameters?: PromptPresetParameters | null;
  sectionOrder: string[];
  groupOrder: string[];
  variableOrder: string[];
  variableGroups: unknown[];
  variableValues: Record<string, string>;
  defaultChoices: PromptPresetChoiceSelections;
  wrapFormat?: string | null;
  author?: string | null;
  folderId?: string | null;
  sections: PromptPresetSection[];
  groups: PromptPresetGroup[];
  choiceBlocks: PromptPresetChoiceBlock[];
  createdAt: string;
  updatedAt: string;
}): PromptPresetRecord | null {
  if (!id) return null;

  const normalizedParameters = parameters ?? null;
  const resolvedMessengerPrompt = messengerPrompt?.trim() || null;
  const resolvedSystemPrompt = systemPrompt.trim();

  return {
    id,
    schemaVersion,
    title: title.trim(),
    summary: summary?.trim() || null,
    systemPrompt: resolvedSystemPrompt,
    messengerPrompt: resolvedMessengerPrompt,
    parameters: normalizedParameters,
    sectionOrder,
    groupOrder,
    variableOrder,
    variableGroups,
    variableValues,
    defaultChoices,
    wrapFormat,
    author,
    folderId,
    sections,
    groups,
    choiceBlocks,
    createdAt,
    updatedAt,
  };
}

export function resolvePromptPresetChoiceVariables({
  preset,
  selections,
}: {
  preset: PromptPresetRecord | null | undefined;
  selections?: PromptPresetThreadChoiceSelections | null;
}) {
  const variables: Record<string, string> = { ...(preset?.variableValues ?? {}) };
  const variableNames: string[] = [];
  if (!preset) return { variables, variableNames };

  variableNames.push(...Object.keys(preset.variableValues));
  const normalizedSelections = prunePromptPresetThreadChoiceSelections(preset, selections);
  for (const block of getPromptPresetChoiceBlocksInOrder(preset)) {
    const selectedValues = resolvePromptPresetChoiceValues({
      block,
      preset,
      selection: normalizedSelections[block.id],
    });
    if (selectedValues.length === 0) continue;

    variables[block.variableName] = block.multiSelect
      ? selectedValues.join(block.separator ?? ", ")
      : (selectedValues[0] ?? "");
    variableNames.push(block.variableName);
  }

  return { variables, variableNames };
}

export function normalizePromptPresetRecord(value: unknown): PromptPresetRecord | null {
  if (!isRecord(value)) return null;

  if (value.schemaVersion !== 1) return null;
  if (Object.prototype.hasOwnProperty.call(value, "sampling")) return null;
  if (
    value.parameters !== undefined &&
    value.parameters !== null &&
    !promptPresetParametersAreValid(value.parameters)
  ) {
    return null;
  }

  if (
    value.systemPrompt !== undefined &&
    value.systemPrompt !== null &&
    typeof value.systemPrompt !== "string"
  ) {
    return null;
  }

  const id = readString(value.id).trim();
  const systemPrompt = readString(value.systemPrompt).trim();
  const title = readString(value.title).trim();
  if (!id || !title) return null;

  if (
    [value.sections, value.groups, value.choiceBlocks].some(
      (collection) => collection !== undefined && !Array.isArray(collection),
    )
  ) {
    return null;
  }

  const now = new Date().toISOString();
  const parameters = normalizePromptPresetParameters(value.parameters);
  const sectionOrder = normalizeStringArray(value.sectionOrder);
  const groupOrder = normalizeStringArray(value.groupOrder);
  const variableOrder = normalizeStringArray(value.variableOrder);
  const variableGroups = normalizeUnknownArray(value.variableGroups);
  const variableValues = normalizeStringRecord(value.variableValues);
  const rawDefaultChoices = normalizeChoiceSelectionRecord(value.defaultChoices);
  const sections = normalizePromptPresetSections(value.sections);
  const groups = normalizePromptPresetGroups(value.groups);
  const messengerPrompt = readNullableString(value.messengerPrompt);
  const choiceBlocks = normalizePromptPresetChoiceBlocks(value.choiceBlocks, rawDefaultChoices);
  const defaultChoices = prunePromptPresetDefaultChoices(rawDefaultChoices, choiceBlocks);

  return normalizePromptPresetRecordFromParts({
    id,
    schemaVersion: 1,
    title,
    summary: readNullableString(value.summary),
    systemPrompt,
    messengerPrompt,
    parameters,
    sectionOrder,
    groupOrder,
    variableOrder,
    variableGroups,
    variableValues,
    defaultChoices,
    wrapFormat: readNullableString(value.wrapFormat),
    author: readNullableString(value.author),
    folderId: readNullableString(value.folderId),
    sections,
    groups,
    choiceBlocks,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  });
}
