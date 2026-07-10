import type {
  PromptPresetChoiceBlock,
  PromptPresetChoiceSelections,
  PromptPresetGroup,
  PromptPresetParameters,
  PromptPresetRecord,
  PromptPresetSampling,
  PromptPresetSection,
} from "../contracts/types/prompt-presets";
import { cleanNullableText, cleanText } from "../shared/text";
import {
  DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT,
  normalizeChoiceSelectionRecord,
  normalizePromptPresetChoiceBlocks,
  normalizePromptPresetGroups,
  normalizePromptPresetParameters,
  normalizePromptPresetSampling,
  normalizePromptPresetSections,
  normalizeStringArray,
  normalizeStringRecord,
  normalizeUnknownArray,
  prunePromptPresetDefaultChoices,
} from "./prompt-preset-normalization";

export {
  DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT,
  isPromptPresetChoiceBlockVisible,
  normalizePromptPresetChoiceSelections,
  normalizePromptPresetRecord,
  normalizePromptPresetSections,
  resolvePromptPresetChoiceControls,
  resolvePromptPresetChoiceVariables,
  updatePromptPresetChoiceSelections,
} from "./prompt-preset-normalization";
export type { PromptPresetChoiceControl } from "./prompt-preset-normalization";

export interface PromptPresetInput {
  title: string;
  summary?: string | null;
  systemPrompt: string;
  messengerPrompt?: string | null;
  sampling?: PromptPresetSampling | null;
  parameters?: PromptPresetParameters | null;
  choiceBlocks?: PromptPresetChoiceBlock[] | null;
  sectionOrder?: string[] | null;
  groupOrder?: string[] | null;
  variableOrder?: string[] | null;
  variableGroups?: unknown[] | null;
  variableValues?: Record<string, string> | null;
  defaultChoices?: PromptPresetChoiceSelections | null;
  wrapFormat?: string | null;
  isDefault?: boolean;
  author?: string | null;
  folderId?: string | null;
  sections?: PromptPresetSection[] | null;
  groups?: PromptPresetGroup[] | null;
}

type PromptPresetSamplingKey = keyof PromptPresetSampling;

const PROMPT_PRESET_SAMPLING_KEYS: PromptPresetSamplingKey[] = ["maxTokens", "temperature", "topP"];

function compactPromptPresetParameters(parameters: PromptPresetParameters) {
  return Object.keys(parameters).length > 0 ? parameters : null;
}

function recordPromptPresetParameters(record: PromptPresetRecord) {
  return record.parameters ?? normalizePromptPresetParameters(record.sampling);
}

function hasOwnProperty(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function mergePromptPresetSamplingParameters(
  record: PromptPresetRecord,
  sampling: PromptPresetSampling | null,
): PromptPresetParameters | null {
  const parameters: PromptPresetParameters = { ...(recordPromptPresetParameters(record) ?? {}) };

  if (sampling === null) {
    for (const key of PROMPT_PRESET_SAMPLING_KEYS) {
      delete parameters[key];
    }
    return compactPromptPresetParameters(parameters);
  }

  const normalizedSampling = normalizePromptPresetSampling(sampling);
  for (const key of PROMPT_PRESET_SAMPLING_KEYS) {
    if (!hasOwnProperty(sampling, key)) continue;

    const value = normalizedSampling?.[key];
    if (value === undefined) {
      delete parameters[key];
    } else {
      parameters[key] = value;
    }
  }

  return compactPromptPresetParameters(parameters);
}

function updatePromptPresetParameters(record: PromptPresetRecord, input: PromptPresetInput) {
  if (input.parameters !== undefined) return normalizePromptPresetParameters(input.parameters);
  if (input.sampling !== undefined)
    return mergePromptPresetSamplingParameters(record, input.sampling);
  return recordPromptPresetParameters(record);
}

export function createPromptPresetRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: PromptPresetInput;
  now: string;
}): PromptPresetRecord {
  const parameters =
    normalizePromptPresetParameters(input.parameters) ??
    normalizePromptPresetParameters(input.sampling);
  const messengerPrompt = cleanNullableText(input.messengerPrompt);
  const rawDefaultChoices = normalizeChoiceSelectionRecord(input.defaultChoices);
  const choiceBlocks = normalizePromptPresetChoiceBlocks(input.choiceBlocks, rawDefaultChoices);
  const defaultChoices = prunePromptPresetDefaultChoices(rawDefaultChoices, choiceBlocks);

  return {
    id,
    schemaVersion: 1,
    title: cleanText(input.title, "Untitled preset"),
    summary: cleanNullableText(input.summary),
    systemPrompt: cleanText(input.systemPrompt, DEFAULT_PROMPT_PRESET_SYSTEM_PROMPT),
    messengerPrompt,
    sampling: normalizePromptPresetSampling(parameters),
    parameters,
    sectionOrder: normalizeStringArray(input.sectionOrder),
    groupOrder: normalizeStringArray(input.groupOrder),
    variableOrder: normalizeStringArray(input.variableOrder),
    variableGroups: normalizeUnknownArray(input.variableGroups),
    variableValues: normalizeStringRecord(input.variableValues),
    defaultChoices,
    wrapFormat: cleanNullableText(input.wrapFormat),
    isDefault: input.isDefault ?? false,
    author: cleanNullableText(input.author),
    folderId: cleanNullableText(input.folderId),
    sections: normalizePromptPresetSections(input.sections),
    groups: normalizePromptPresetGroups(input.groups),
    choiceBlocks,
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePromptPresetRecord(
  record: PromptPresetRecord,
  input: PromptPresetInput,
  updatedAt: string,
): PromptPresetRecord {
  const parameters = updatePromptPresetParameters(record, input);
  const messengerPrompt =
    input.messengerPrompt === undefined
      ? record.messengerPrompt
      : cleanNullableText(input.messengerPrompt);
  const defaultChoices =
    input.defaultChoices === undefined
      ? record.defaultChoices
      : normalizeChoiceSelectionRecord(input.defaultChoices);
  const choiceBlocks =
    input.choiceBlocks === undefined
      ? record.choiceBlocks
      : normalizePromptPresetChoiceBlocks(input.choiceBlocks, defaultChoices);
  const prunedDefaultChoices =
    input.defaultChoices === undefined && input.choiceBlocks === undefined
      ? record.defaultChoices
      : prunePromptPresetDefaultChoices(defaultChoices, choiceBlocks);

  return {
    ...record,
    title: cleanText(input.title, record.title),
    summary: cleanNullableText(input.summary),
    systemPrompt: cleanText(input.systemPrompt, record.systemPrompt),
    messengerPrompt,
    sampling: normalizePromptPresetSampling(parameters),
    parameters,
    sectionOrder:
      input.sectionOrder === undefined
        ? record.sectionOrder
        : normalizeStringArray(input.sectionOrder),
    groupOrder:
      input.groupOrder === undefined ? record.groupOrder : normalizeStringArray(input.groupOrder),
    variableOrder:
      input.variableOrder === undefined
        ? record.variableOrder
        : normalizeStringArray(input.variableOrder),
    variableGroups:
      input.variableGroups === undefined
        ? record.variableGroups
        : normalizeUnknownArray(input.variableGroups),
    variableValues:
      input.variableValues === undefined
        ? record.variableValues
        : normalizeStringRecord(input.variableValues),
    defaultChoices: prunedDefaultChoices,
    wrapFormat:
      input.wrapFormat === undefined ? record.wrapFormat : cleanNullableText(input.wrapFormat),
    isDefault: input.isDefault === undefined ? record.isDefault : input.isDefault,
    author: input.author === undefined ? record.author : cleanNullableText(input.author),
    folderId: input.folderId === undefined ? record.folderId : cleanNullableText(input.folderId),
    sections:
      input.sections === undefined
        ? record.sections
        : normalizePromptPresetSections(input.sections),
    groups: input.groups === undefined ? record.groups : normalizePromptPresetGroups(input.groups),
    choiceBlocks,
    updatedAt,
  };
}

export function duplicatePromptPresetRecord(
  record: PromptPresetRecord,
  id: string,
  now: string,
): PromptPresetRecord {
  return {
    ...record,
    id,
    title: `${record.title} Copy`,
    sections: record.sections.map((section) => ({ ...section, presetId: id })),
    groups: record.groups.map((group) => ({ ...group, presetId: id })),
    choiceBlocks: record.choiceBlocks.map((choiceBlock) => ({ ...choiceBlock, presetId: id })),
    createdAt: now,
    updatedAt: now,
  };
}

export function deletePromptPresetRecord(records: PromptPresetRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}
