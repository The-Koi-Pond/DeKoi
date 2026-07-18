import { promptPresetParametersAreValid } from "./prompt-preset-parameter-contract";
import { isRecord, parseJsonIfString } from "./prompt-preset-normalization";
import {
  promptPresetChoiceSelectionRecordIsValid,
  readPromptPresetNestedRecords,
} from "./prompt-preset-nested-schema";

export { promptPresetParametersAreValid as promptPresetPackageParametersAreValid } from "./prompt-preset-parameter-contract";

type FieldValidator = (value: unknown) => boolean;

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

function isBooleanLike(value: unknown) {
  return typeof value === "boolean" || value === "true" || value === "false";
}

function isTimestamp(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function promptPresetPackageEnvelopeIsValid(value: Record<string, unknown>) {
  return hasOnlyValidFields(
    value,
    {
      id: (fieldValue) => typeof fieldValue === "string",
      exportedAt: isTimestamp,
    },
    ["type", "version", "data"],
  );
}

function readJsonRecord(value: unknown, allowJsonString = true): Record<string, unknown> | null {
  const source = allowJsonString ? parseJsonIfString(value) : value;
  return isRecord(source) ? source : null;
}

function readJsonArray(value: unknown, allowJsonString: boolean): unknown[] | null {
  const source = allowJsonString ? parseJsonIfString(value) : value;
  return Array.isArray(source) ? source : null;
}

function hasOnlyValidFields(
  record: Record<string, unknown>,
  validators: Record<string, FieldValidator>,
  required: readonly string[] = [],
) {
  const allowed = new Set([...required, ...Object.keys(validators)]);
  return (
    Object.keys(record).every((field) => allowed.has(field)) &&
    Object.entries(validators).every(
      ([field, validate]) => record[field] === undefined || validate(record[field]),
    )
  );
}

function isStringArrayValue(value: unknown, allowJsonString: boolean, requireValue = false) {
  const source = readJsonArray(value, allowJsonString);
  return source !== null && (!requireValue || source.length > 0) && source.every(isNonEmptyString);
}

function isUnknownArrayValue(value: unknown, allowJsonString: boolean) {
  return readJsonArray(value, allowJsonString) !== null;
}

function isStringRecordValue(value: unknown, allowJsonString: boolean) {
  const source = readJsonRecord(value, allowJsonString);
  return (
    source !== null &&
    Object.entries(source).every(
      ([key, fieldValue]) => key.trim().length > 0 && typeof fieldValue === "string",
    )
  );
}

function commonPresetFieldValidators(allowJsonString: boolean): Record<string, FieldValidator> {
  return {
    id: (value) => typeof value === "string",
    name: isNullableString,
    description: isNullableString,
    parameters: promptPresetParametersAreValid,
    sectionOrder: (value) => isStringArrayValue(value, allowJsonString),
    groupOrder: (value) => isStringArrayValue(value, allowJsonString),
    variableGroups: (value) => isUnknownArrayValue(value, allowJsonString),
    variableValues: (value) => isStringRecordValue(value, allowJsonString),
    defaultChoices: (value) => promptPresetChoiceSelectionRecordIsValid(value, allowJsonString),
    wrapFormat: isNullableString,
    author: isNullableString,
    createdAt: isTimestamp,
    updatedAt: isTimestamp,
  };
}

const DEKOI_PRESET_FIELD_VALIDATORS: Record<string, FieldValidator> = {
  ...commonPresetFieldValidators(false),
  schemaVersion: (value) => value === 2,
  messengerPrompt: isNullableString,
};

const MARINARA_PRESET_FIELD_VALIDATORS: Record<string, FieldValidator> = {
  ...commonPresetFieldValidators(true),
  conversationPrompt: isNullableString,
  gamePrompt: isNullableString,
  isDefault: isBooleanLike,
};

function promptPresetPackagePresetIsValid(
  preset: Record<string, unknown>,
  packageType: "dekoi_preset" | "marinara_preset",
) {
  const validators =
    packageType === "marinara_preset"
      ? MARINARA_PRESET_FIELD_VALIDATORS
      : DEKOI_PRESET_FIELD_VALIDATORS;
  return hasOnlyValidFields(preset, validators) && preset.sampling === undefined;
}

interface PackageChoiceOptionIndex {
  optionIds: Set<string>;
  optionValues: Set<string>;
  multiSelect: boolean;
}

function packageChoiceOptionIndex(block: Record<string, unknown>): PackageChoiceOptionIndex {
  const optionIds = new Set<string>();
  const optionValues = new Set<string>();

  const options = Array.isArray(block.options) ? block.options : [];
  for (const option of options) {
    if (!isRecord(option)) continue;
    optionIds.add(String(option.id).trim());
    optionValues.add(String(option.value).trim());
  }

  return { optionIds, optionValues, multiSelect: block.multiSelect === true };
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
  const blocksByVariableName = new Map(
    choiceBlocks.map(
      (block) => [String(block.variableName).trim(), packageChoiceOptionIndex(block)] as const,
    ),
  );

  if (preset.defaultChoices === undefined) return true;
  const defaultChoices = readJsonRecord(preset.defaultChoices);
  if (!defaultChoices) return false;

  return Object.entries(defaultChoices).every(([variableName, rawSelection]) => {
    const block = blocksByVariableName.get(variableName.trim());
    if (!block) return false;
    if (Array.isArray(rawSelection) && rawSelection.length === 0) return block.multiSelect;

    const selections = Array.isArray(rawSelection) ? rawSelection : [rawSelection];
    return selections.every((selection) => packageChoiceSelectionMatchesOption(selection, block));
  });
}

export function readPromptPresetPackageData(
  value: unknown,
  packageType: "dekoi_preset" | "marinara_preset" = "dekoi_preset",
): PromptPresetPackageData | null {
  if (
    !isRecord(value) ||
    !hasOnlyValidFields(
      value,
      {
        sections: () => true,
        groups: () => true,
        choiceBlocks: () => true,
      },
      ["preset"],
    ) ||
    !isRecord(value.preset) ||
    !promptPresetPackagePresetIsValid(value.preset, packageType)
  ) {
    return null;
  }

  const sections = readPromptPresetNestedRecords(value.sections ?? [], "sections", packageType);
  const groups = readPromptPresetNestedRecords(value.groups ?? [], "groups", packageType);
  const choiceBlocks = readPromptPresetNestedRecords(
    value.choiceBlocks ?? [],
    "choiceBlocks",
    packageType,
  );
  return sections !== null &&
    groups !== null &&
    choiceBlocks !== null &&
    packageChoiceDefaultsAreValid(value.preset, choiceBlocks)
    ? { preset: value.preset, sections, groups, choiceBlocks }
    : null;
}
