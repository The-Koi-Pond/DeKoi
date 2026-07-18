import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import {
  isRecord,
  normalizePromptPresetRecord,
  parseJsonIfString,
  readNullableString,
  readString,
} from "./prompt-preset-normalization";
import {
  promptPresetPackageEnvelopeIsValid,
  promptPresetPackageParametersAreValid,
  readPromptPresetPackageData,
  type PromptPresetPackageRows,
} from "./prompt-preset-package-schema";

const DEKOI_PROMPT_PRESET_PACKAGE_TYPE = "dekoi_preset";
const DEKOI_PROMPT_PRESET_PACKAGE_VERSION = 2;
const MARINARA_PROMPT_PRESET_PACKAGE_TYPE = "marinara_preset";
const MARINARA_PROMPT_PRESET_PACKAGE_VERSION = 1;
const COMPATIBLE_PROMPT_PRESET_PACKAGE_TYPES = new Set([
  DEKOI_PROMPT_PRESET_PACKAGE_TYPE,
  MARINARA_PROMPT_PRESET_PACKAGE_TYPE,
]);

function stampPresetIdOnRows(rows: Record<string, unknown>[], presetId: string) {
  return rows.map((row) => ({ ...row, presetId }));
}

function readPackageArray(value: unknown): unknown[] {
  const parsed = parseJsonIfString(value);
  return Array.isArray(parsed) ? parsed : [];
}

function readPackageRecord(value: unknown): Record<string, unknown> {
  const parsed = parseJsonIfString(value);
  return isRecord(parsed) ? parsed : {};
}

function canonicalizePackageRecord(
  value: unknown,
  canonicalizeValue: (entry: unknown) => unknown = (entry) => entry,
): Record<string, unknown> | null {
  const entries: [string, unknown][] = [];
  const seenKeys = new Set<string>();
  for (const [rawKey, entry] of Object.entries(readPackageRecord(value))) {
    const key = rawKey.trim();
    if (!key || seenKeys.has(key)) return null;
    seenKeys.add(key);
    entries.push([key, canonicalizeValue(entry)]);
  }
  return Object.fromEntries(entries);
}

function trimPackageChoiceSelection(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(trimPackageChoiceSelection);
  if (isRecord(value) && value.kind === "option" && typeof value.optionId === "string") {
    return { ...value, optionId: value.optionId.trim() };
  }
  return value;
}

function trimPackageChoiceBlockOptions(block: Record<string, unknown>) {
  const options = parseJsonIfString(block.options);
  if (!Array.isArray(options)) return block;
  return {
    ...block,
    options: options.map((option: unknown) =>
      isRecord(option) && typeof option.value === "string"
        ? { ...option, value: option.value.trim() }
        : option,
    ),
  };
}

function packageRowsWerePreserved(rows: PromptPresetPackageRows, normalized: PromptPresetRecord) {
  if (
    normalized.sections.length !== rows.sections.length ||
    normalized.groups.length !== rows.groups.length ||
    normalized.choiceBlocks.length !== rows.choiceBlocks.length
  ) {
    return false;
  }

  const choiceBlocksById = new Map(normalized.choiceBlocks.map((block) => [block.id, block]));
  return rows.choiceBlocks.every((row) => {
    const options = parseJsonIfString(row.options);
    const block = choiceBlocksById.get(readString(row.id).trim());
    return (
      Array.isArray(options) &&
      options.every(isRecord) &&
      block !== undefined &&
      block.options.length === options.length
    );
  });
}

function normalizePromptPresetPackageRecord(
  value: Record<string, unknown>,
): PromptPresetRecord | null {
  const packageType = readString(value.type);
  const supportedVersion =
    (packageType === DEKOI_PROMPT_PRESET_PACKAGE_TYPE &&
      value.version === DEKOI_PROMPT_PRESET_PACKAGE_VERSION) ||
    (packageType === MARINARA_PROMPT_PRESET_PACKAGE_TYPE &&
      value.version === MARINARA_PROMPT_PRESET_PACKAGE_VERSION);
  if (!supportedVersion || !isRecord(value.data) || !promptPresetPackageEnvelopeIsValid(value)) {
    return null;
  }

  const packageData = readPromptPresetPackageData(value.data, packageType);
  if (!packageData) return null;

  const preset = packageData.preset;
  if (
    packageType === DEKOI_PROMPT_PRESET_PACKAGE_TYPE &&
    (preset.schemaVersion !== 2 || typeof preset.messengerPrompt !== "string")
  ) {
    return null;
  }
  const id = readString(preset.id).trim() || readString(value.id).trim();
  const variableValues = canonicalizePackageRecord(preset.variableValues);
  const defaultChoices = canonicalizePackageRecord(
    preset.defaultChoices,
    trimPackageChoiceSelection,
  );
  if (!variableValues || !defaultChoices) return null;
  const normalized = normalizePromptPresetRecord({
    id,
    schemaVersion: 2,
    name: readString(preset.name).trim(),
    description: typeof preset.description === "string" ? preset.description : null,
    messengerPrompt:
      packageType === MARINARA_PROMPT_PRESET_PACKAGE_TYPE
        ? readString(preset.conversationPrompt)
        : readString(preset.messengerPrompt),
    parameters: preset.parameters,
    sectionOrder: readPackageArray(preset.sectionOrder),
    groupOrder: readPackageArray(preset.groupOrder),
    variableGroups: readPackageArray(preset.variableGroups),
    variableValues,
    defaultChoices,
    wrapFormat: readNullableString(preset.wrapFormat),
    author: readNullableString(preset.author),
    sections: stampPresetIdOnRows(packageData.sections, id),
    groups: stampPresetIdOnRows(packageData.groups, id),
    choiceBlocks: stampPresetIdOnRows(
      packageData.choiceBlocks.map(trimPackageChoiceBlockOptions),
      id,
    ),
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  });
  return normalized && packageRowsWerePreserved(packageData, normalized) ? normalized : null;
}

export function createPromptPresetPackage(record: PromptPresetRecord, exportedAt: string) {
  if (!promptPresetPackageParametersAreValid(record.parameters ?? null)) {
    throw new Error(
      "Prompt preset contains unsupported generation parameters and cannot be exported.",
    );
  }

  return {
    type: DEKOI_PROMPT_PRESET_PACKAGE_TYPE,
    version: DEKOI_PROMPT_PRESET_PACKAGE_VERSION,
    exportedAt,
    data: {
      preset: {
        id: record.id,
        schemaVersion: record.schemaVersion,
        name: record.name,
        description: record.description,
        messengerPrompt: record.messengerPrompt,
        parameters: record.parameters,
        sectionOrder: record.sectionOrder,
        groupOrder: record.groupOrder,
        variableGroups: record.variableGroups,
        variableValues: record.variableValues,
        defaultChoices: record.defaultChoices,
        wrapFormat: record.wrapFormat,
        author: record.author,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      sections: record.sections,
      groups: record.groups,
      choiceBlocks: record.choiceBlocks,
    },
  };
}

export function normalizePromptPresetPackage(value: unknown): PromptPresetRecord | null {
  return isRecord(value) ? normalizePromptPresetPackageRecord(value) : null;
}

export function normalizePromptPresetImportRecord(value: unknown): PromptPresetRecord | null {
  if (!isRecord(value)) return null;
  if (COMPATIBLE_PROMPT_PRESET_PACKAGE_TYPES.has(readString(value.type))) {
    return normalizePromptPresetPackageRecord(value);
  }
  return normalizePromptPresetRecord(value);
}
