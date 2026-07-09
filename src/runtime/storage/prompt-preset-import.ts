import type { PromptPresetRecord } from "../../engine/contracts/types/prompt-presets";
import {
  normalizePromptPresetRecord,
  normalizePromptPresetSections,
} from "../../engine/prompt-presets/prompt-preset-actions";
import { promptPresetSectionsInOrder } from "../../engine/prompt-presets/prompt-preset-section-policy";
import { isRecord } from "./storage-json";

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  const trimmed = readString(value).trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value: unknown): string[] {
  const source = parseJsonIfString(value);
  if (!Array.isArray(source)) return [];

  const strings: string[] = [];
  for (const item of source) {
    const stringValue = readString(item).trim();
    if (stringValue) strings.push(stringValue);
  }

  return strings;
}

function normalizeUniqueStringArray(value: unknown): string[] {
  const values = normalizeStringArray(value);
  const uniqueValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function systemPromptFromPackageSections(sectionsValue: unknown, sectionOrderValue: unknown) {
  const sectionOrder = normalizeUniqueStringArray(sectionOrderValue);
  const sections = normalizePromptPresetSections(sectionsValue);

  return promptPresetSectionsInOrder(sections, sectionOrder)
    .filter((section) => section.enabled && !section.isMarker && section.content.trim())
    .map((section) => section.content.trim())
    .join("\n\n");
}

function stampPresetIdOnRows(value: unknown, presetId: string) {
  const source = parseJsonIfString(value);
  if (!Array.isArray(source)) return value;

  return source.map((row) => (isRecord(row) ? { ...row, presetId } : row));
}

function normalizePromptPresetPackage(value: Record<string, unknown>): PromptPresetRecord | null {
  if (!isRecord(value.data) || !isRecord(value.data.preset)) return null;

  const preset = value.data.preset;
  const id = readString(preset.id).trim() || readString(value.id).trim();
  const systemPrompt =
    readString(preset.systemPrompt).trim() ||
    systemPromptFromPackageSections(value.data.sections, preset.sectionOrder);

  return normalizePromptPresetRecord({
    id,
    schemaVersion: 1,
    title: readString(preset.name).trim() || readString(preset.title).trim(),
    summary: readNullableString(preset.description) ?? readNullableString(preset.summary),
    systemPrompt,
    messengerPrompt:
      readNullableString(preset.messengerPrompt) ?? readNullableString(preset.conversationPrompt),
    parameters: preset.parameters ?? preset.sampling,
    sampling: preset.sampling,
    sectionOrder: preset.sectionOrder,
    groupOrder: preset.groupOrder,
    variableOrder: preset.variableOrder,
    variableGroups: preset.variableGroups,
    variableValues: preset.variableValues,
    defaultChoices: preset.defaultChoices,
    wrapFormat: readNullableString(preset.wrapFormat),
    isDefault: preset.isDefault,
    author: readNullableString(preset.author),
    folderId: readNullableString(preset.folderId),
    sections: stampPresetIdOnRows(value.data.sections, id),
    groups: stampPresetIdOnRows(value.data.groups, id),
    choiceBlocks: stampPresetIdOnRows(value.data.choiceBlocks, id),
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  });
}

export function normalizePromptPresetImportRecord(value: unknown): PromptPresetRecord | null {
  if (!isRecord(value)) return null;
  return normalizePromptPresetPackage(value) ?? normalizePromptPresetRecord(value);
}
