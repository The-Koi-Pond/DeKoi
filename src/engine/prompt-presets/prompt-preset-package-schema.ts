import {
  PROMPT_PRESET_NUMERIC_CONSTRAINTS,
  type PromptPresetNumericConstraint,
  promptPresetParametersAreValid,
} from "./prompt-preset-parameter-contract";
import { isRecord, parseJsonIfString } from "./prompt-preset-normalization";

export { promptPresetParametersAreValid as promptPresetPackageParametersAreValid } from "./prompt-preset-parameter-contract";

type FieldValidator = (value: unknown) => boolean;

const MAX_PROMPT_PRESET_CHOICE_OPTIONS = 1_000;
const MAX_PROMPT_PRESET_DEFAULT_SELECTIONS = 1_000;

export interface PromptPresetPackageRows {
  sections: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  choiceBlocks: Record<string, unknown>[];
}

export interface PromptPresetPackageData extends PromptPresetPackageRows {
  preset: Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function isNullableNumberWithinConstraint(
  value: unknown,
  constraint: PromptPresetNumericConstraint,
) {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= constraint.minimum &&
      value <= constraint.maximum &&
      (!constraint.integer || Number.isInteger(value)))
  );
}

function isBooleanLike(value: unknown) {
  return typeof value === "boolean" || value === "true" || value === "false";
}

function isNullableBooleanLike(value: unknown) {
  return value === null || isBooleanLike(value);
}

function isTimestamp(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function promptPresetPackageEnvelopeIsValid(value: Record<string, unknown>) {
  return hasValidOptionalFields(value, {
    id: (fieldValue) => typeof fieldValue === "string",
    exportedAt: isTimestamp,
  });
}

function readJsonRecord(value: unknown): Record<string, unknown> | null {
  const source = parseJsonIfString(value);
  return isRecord(source) ? source : null;
}

function readJsonArray(value: unknown): unknown[] | null {
  const source = parseJsonIfString(value);
  return Array.isArray(source) ? source : null;
}

function hasValidOptionalFields(
  record: Record<string, unknown>,
  validators: Record<string, FieldValidator>,
) {
  return Object.entries(validators).every(
    ([field, validate]) => record[field] === undefined || validate(record[field]),
  );
}

function isStringArrayValue(value: unknown, requireValue = false) {
  const source = readJsonArray(value);
  return source !== null && (!requireValue || source.length > 0) && source.every(isNonEmptyString);
}

function isUnknownArrayValue(value: unknown) {
  return readJsonArray(value) !== null;
}

function isStringRecordValue(value: unknown) {
  const source = readJsonRecord(value);
  return (
    source !== null &&
    Object.entries(source).every(
      ([key, fieldValue]) => key.trim().length > 0 && typeof fieldValue === "string",
    )
  );
}

function isChoiceSelectionValue(value: unknown) {
  return (
    isNonEmptyString(value) ||
    (isRecord(value) && value.kind === "option" && isNonEmptyString(value.optionId))
  );
}

function isChoiceSelection(value: unknown) {
  return (
    isChoiceSelectionValue(value) ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.length <= MAX_PROMPT_PRESET_DEFAULT_SELECTIONS &&
      value.every(isChoiceSelectionValue))
  );
}

function isChoiceSelectionRecordValue(value: unknown) {
  const source = readJsonRecord(value);
  return (
    source !== null &&
    Object.entries(source).every(
      ([key, fieldValue]) => key.trim().length > 0 && isChoiceSelection(fieldValue),
    )
  );
}

const PRESET_FIELD_VALIDATORS: Record<string, FieldValidator> = {
  id: (value) => typeof value === "string",
  schemaVersion: (value) => value === 1,
  name: isNullableString,
  title: isNullableString,
  description: isNullableString,
  summary: isNullableString,
  systemPrompt: isNullableString,
  messengerPrompt: isNullableString,
  conversationPrompt: isNullableString,
  parameters: promptPresetParametersAreValid,
  sectionOrder: isStringArrayValue,
  groupOrder: isStringArrayValue,
  variableOrder: isStringArrayValue,
  variableGroups: isUnknownArrayValue,
  variableValues: isStringRecordValue,
  defaultChoices: isChoiceSelectionRecordValue,
  wrapFormat: isNullableString,
  author: isNullableString,
  folderId: isNullableString,
  createdAt: isTimestamp,
  updatedAt: isTimestamp,
};

function promptPresetPackagePresetIsValid(preset: Record<string, unknown>) {
  return preset.sampling === undefined && hasValidOptionalFields(preset, PRESET_FIELD_VALIDATORS);
}

function markerConfigIsValid(value: unknown) {
  if (value === null) return true;
  const source = readJsonRecord(value);
  return source !== null && isNonEmptyString(source.type);
}

const SECTION_OPTIONAL_FIELD_VALIDATORS: Record<string, FieldValidator> = {
  presetId: isNullableString,
  groupId: isNullableString,
  markerConfig: markerConfigIsValid,
  injectionPosition: isNullableString,
  injectionDepth: (value) =>
    isNullableNumberWithinConstraint(
      value,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.sectionInjectionDepth,
    ),
  injectionOrder: (value) =>
    isNullableNumberWithinConstraint(
      value,
      PROMPT_PRESET_NUMERIC_CONSTRAINTS.sectionInjectionOrder,
    ),
  wrapInXml: isNullableBooleanLike,
  xmlTagName: isNullableString,
  forbidOverrides: isNullableBooleanLike,
};

function promptPresetPackageSectionIsValid(section: Record<string, unknown>) {
  return (
    isNonEmptyString(section.id) &&
    isNonEmptyString(section.identifier) &&
    isNonEmptyString(section.name) &&
    typeof section.content === "string" &&
    (section.role === "system" || section.role === "user" || section.role === "assistant") &&
    isBooleanLike(section.enabled) &&
    isBooleanLike(section.isMarker) &&
    hasValidOptionalFields(section, SECTION_OPTIONAL_FIELD_VALIDATORS)
  );
}

const GROUP_OPTIONAL_FIELD_VALIDATORS: Record<string, FieldValidator> = {
  presetId: isNullableString,
  parentGroupId: isNullableString,
  order: (value) =>
    isNullableNumberWithinConstraint(value, PROMPT_PRESET_NUMERIC_CONSTRAINTS.groupOrder),
  enabled: isNullableBooleanLike,
  createdAt: isNullableString,
};

function promptPresetPackageGroupIsValid(group: Record<string, unknown>) {
  return (
    isNonEmptyString(group.id) &&
    isNonEmptyString(group.name) &&
    hasValidOptionalFields(group, GROUP_OPTIONAL_FIELD_VALIDATORS)
  );
}

const OPTION_OPTIONAL_FIELD_VALIDATORS: Record<string, FieldValidator> = {
  description: isNullableString,
};

function promptPresetPackageOptionIsValid(option: Record<string, unknown>) {
  return (
    isNonEmptyString(option.id) &&
    isNonEmptyString(option.label) &&
    typeof option.value === "string" &&
    hasValidOptionalFields(option, OPTION_OPTIONAL_FIELD_VALIDATORS)
  );
}

function promptPresetPackageOptionsAreValid(value: unknown) {
  const options = readPackageRecordArray(value, promptPresetPackageOptionIsValid);
  return (
    options !== null && options.length > 0 && options.length <= MAX_PROMPT_PRESET_CHOICE_OPTIONS
  );
}

const CHOICE_BLOCK_OPTIONAL_FIELD_VALIDATORS: Record<string, FieldValidator> = {
  presetId: isNullableString,
  question: isNullableString,
  label: isNullableString,
  defaultOptionId: isNullableString,
  multiSelect: isNullableBooleanLike,
  separator: isNullableString,
  displayMode: (value) =>
    value === null || value === "auto" || value === "buttons" || value === "listbox",
  optionSort: (value) => value === null || value === "manual" || value === "alphabetical",
  sortOrder: (value) =>
    isNullableNumberWithinConstraint(value, PROMPT_PRESET_NUMERIC_CONSTRAINTS.choiceSortOrder),
  createdAt: isNullableString,
};

function promptPresetPackageChoiceBlockIsValid(block: Record<string, unknown>) {
  return (
    isNonEmptyString(block.id) &&
    isNonEmptyString(block.variableName) &&
    promptPresetPackageOptionsAreValid(block.options) &&
    hasValidOptionalFields(block, CHOICE_BLOCK_OPTIONAL_FIELD_VALIDATORS)
  );
}

interface PackageChoiceOptionIndex {
  optionIds: Set<string>;
  optionValues: Set<string>;
}

function packageChoiceOptionIndex(block: Record<string, unknown>): PackageChoiceOptionIndex {
  const optionIds = new Set<string>();
  const optionValues = new Set<string>();

  const options = readPackageRecordArray(block.options, promptPresetPackageOptionIsValid) ?? [];
  for (const option of options) {
    optionIds.add(String(option.id).trim());
    optionValues.add(String(option.value).trim());
  }

  return { optionIds, optionValues };
}

function packageChoiceSelectionMatchesOption(
  selection: unknown,
  optionIndex: PackageChoiceOptionIndex,
) {
  if (typeof selection === "string") {
    const value = selection.trim();
    return optionIndex.optionValues.has(value) || optionIndex.optionIds.has(value);
  }

  return (
    isRecord(selection) &&
    selection.kind === "option" &&
    optionIndex.optionIds.has(String(selection.optionId).trim())
  );
}

function packageChoiceDefaultsAreValid(
  preset: Record<string, unknown>,
  choiceBlocks: Record<string, unknown>[],
) {
  const optionIndexesByBlock = new Map(
    choiceBlocks.map((block) => [block, packageChoiceOptionIndex(block)] as const),
  );
  const blocksByVariableName = new Map(
    choiceBlocks.map(
      (block) =>
        [
          String(block.variableName).trim(),
          { optionIndex: optionIndexesByBlock.get(block)! },
        ] as const,
    ),
  );

  for (const block of choiceBlocks) {
    const defaultOptionId = block.defaultOptionId;
    if (defaultOptionId === undefined || defaultOptionId === null) continue;

    const optionIndex = optionIndexesByBlock.get(block);
    if (!isNonEmptyString(defaultOptionId) || !optionIndex?.optionIds.has(defaultOptionId.trim())) {
      return false;
    }
  }

  if (preset.defaultChoices === undefined) return true;
  const defaultChoices = readJsonRecord(preset.defaultChoices);
  if (!defaultChoices) return false;

  return Object.entries(defaultChoices).every(([variableName, rawSelection]) => {
    const block = blocksByVariableName.get(variableName.trim());
    if (!block) return false;

    const selections = Array.isArray(rawSelection) ? rawSelection : [rawSelection];
    return selections.every((selection) =>
      packageChoiceSelectionMatchesOption(selection, block.optionIndex),
    );
  });
}

function readPackageRecordArray(
  value: unknown,
  validate: (record: Record<string, unknown>) => boolean,
): Record<string, unknown>[] | null {
  const source = readJsonArray(value);
  if (source === null) return null;

  const records: Record<string, unknown>[] = [];
  for (const item of source) {
    if (!isRecord(item) || !validate(item)) return null;
    records.push(item);
  }
  return records;
}

function readTopLevelPackageRecordArray(
  value: unknown,
  validate: (record: Record<string, unknown>) => boolean,
): Record<string, unknown>[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;

  const records: Record<string, unknown>[] = [];
  for (const item of value) {
    if (!isRecord(item) || !validate(item)) return null;
    records.push(item);
  }
  return records;
}

export function readPromptPresetPackageData(value: unknown): PromptPresetPackageData | null {
  if (
    !isRecord(value) ||
    !isRecord(value.preset) ||
    !promptPresetPackagePresetIsValid(value.preset)
  ) {
    return null;
  }

  const sections = readTopLevelPackageRecordArray(
    value.sections,
    promptPresetPackageSectionIsValid,
  );
  const groups = readTopLevelPackageRecordArray(value.groups, promptPresetPackageGroupIsValid);
  const choiceBlocks = readTopLevelPackageRecordArray(
    value.choiceBlocks,
    promptPresetPackageChoiceBlockIsValid,
  );
  return sections !== null &&
    groups !== null &&
    choiceBlocks !== null &&
    packageChoiceDefaultsAreValid(value.preset, choiceBlocks)
    ? { preset: value.preset, sections, groups, choiceBlocks }
    : null;
}
