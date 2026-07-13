import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import {
  isRecord,
  normalizePromptPresetRecord,
  normalizePromptPresetSections,
  normalizeStringArray,
  parseJsonIfString,
  readNullableString,
  readString,
} from "./prompt-preset-normalization";
import {
  promptPresetPackageEnvelopeIsValid,
  readPromptPresetPackageData,
  type PromptPresetPackageRows,
} from "./prompt-preset-package-schema";
import { promptPresetSectionsInOrder } from "./prompt-preset-section-policy";

const DEKOI_PROMPT_PRESET_PACKAGE_TYPE = "dekoi_preset";
const DEKOI_PROMPT_PRESET_PACKAGE_VERSION = 1;
const COMPATIBLE_PROMPT_PRESET_PACKAGE_TYPES = new Set([
  DEKOI_PROMPT_PRESET_PACKAGE_TYPE,
  "marinara_preset",
]);

function normalizeUniqueStringArray(value: unknown): string[] {
  return [...new Set(normalizeStringArray(value))];
}

function systemPromptFromPackageSections(sectionsValue: unknown, sectionOrderValue: unknown) {
  const sections = normalizePromptPresetSections(sectionsValue);

  return promptPresetSectionsInOrder(sections, normalizeUniqueStringArray(sectionOrderValue))
    .filter((section) => section.enabled && !section.isMarker && section.content.trim())
    .map((section) => section.content.trim())
    .join("\n\n");
}

function stampPresetIdOnRows(rows: Record<string, unknown>[], presetId: string) {
  return rows.map((row) => ({ ...row, presetId }));
}

function mergedPackageParameters(parameters: unknown, sampling: unknown) {
  const parameterRecord = parseJsonIfString(parameters);
  const samplingRecord = parseJsonIfString(sampling);

  if (isRecord(parameterRecord) && isRecord(samplingRecord)) {
    return { ...samplingRecord, ...parameterRecord };
  }

  return parameters ?? sampling;
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
  if (
    !COMPATIBLE_PROMPT_PRESET_PACKAGE_TYPES.has(readString(value.type)) ||
    value.version !== DEKOI_PROMPT_PRESET_PACKAGE_VERSION ||
    !isRecord(value.data) ||
    !promptPresetPackageEnvelopeIsValid(value)
  ) {
    return null;
  }

  const packageData = readPromptPresetPackageData(value.data);
  if (!packageData) return null;

  const preset = packageData.preset;
  const id = readString(preset.id).trim() || readString(value.id).trim();
  const systemPrompt =
    readString(preset.systemPrompt).trim() ||
    systemPromptFromPackageSections(packageData.sections, preset.sectionOrder);
  if (!systemPrompt) return null;

  const normalized = normalizePromptPresetRecord({
    id,
    schemaVersion: 1,
    title: readString(preset.name).trim() || readString(preset.title).trim(),
    summary: readNullableString(preset.description) ?? readNullableString(preset.summary),
    systemPrompt,
    messengerPrompt:
      readNullableString(preset.messengerPrompt) ?? readNullableString(preset.conversationPrompt),
    parameters: mergedPackageParameters(preset.parameters, preset.sampling),
    sampling: preset.sampling,
    sectionOrder: preset.sectionOrder,
    groupOrder: preset.groupOrder,
    variableOrder: preset.variableOrder,
    variableGroups: preset.variableGroups,
    variableValues: preset.variableValues,
    defaultChoices: preset.defaultChoices,
    wrapFormat: readNullableString(preset.wrapFormat),
    author: readNullableString(preset.author),
    folderId: readNullableString(preset.folderId),
    sections: stampPresetIdOnRows(packageData.sections, id),
    groups: stampPresetIdOnRows(packageData.groups, id),
    choiceBlocks: stampPresetIdOnRows(packageData.choiceBlocks, id),
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  });
  return normalized && packageRowsWerePreserved(packageData, normalized) ? normalized : null;
}

export function createPromptPresetPackage(record: PromptPresetRecord, exportedAt: string) {
  return {
    type: DEKOI_PROMPT_PRESET_PACKAGE_TYPE,
    version: DEKOI_PROMPT_PRESET_PACKAGE_VERSION,
    exportedAt,
    data: {
      preset: {
        id: record.id,
        schemaVersion: record.schemaVersion,
        name: record.title,
        description: record.summary,
        systemPrompt: record.systemPrompt,
        messengerPrompt: record.messengerPrompt,
        sampling: record.sampling,
        parameters: record.parameters,
        sectionOrder: record.sectionOrder,
        groupOrder: record.groupOrder,
        variableOrder: record.variableOrder,
        variableGroups: record.variableGroups,
        variableValues: record.variableValues,
        defaultChoices: record.defaultChoices,
        wrapFormat: record.wrapFormat,
        author: record.author,
        folderId: record.folderId,
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
  return normalizePromptPresetPackageRecord(value) ?? normalizePromptPresetRecord(value);
}
