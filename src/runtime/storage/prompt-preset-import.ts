import type { PromptPresetRecord } from "../../engine/contracts/types/prompt-presets";
import {
  normalizePromptPresetRecord,
  normalizePromptPresetSections,
} from "../../engine/prompt-presets/prompt-preset-actions";
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

function promptPresetSectionsInOrder(
  sections: ReturnType<typeof normalizePromptPresetSections>,
  sectionOrder: string[],
) {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const orderedSections = sectionOrder.flatMap((sectionId) => {
    const section = sectionById.get(sectionId);
    return section ? [section] : [];
  });
  const orderedIds = new Set(orderedSections.map((section) => section.id));
  const remainingSections = sections
    .filter((section) => !orderedIds.has(section.id))
    .sort((left, right) => (left.injectionOrder ?? 0) - (right.injectionOrder ?? 0));

  return [...orderedSections, ...remainingSections];
}

function systemPromptFromPackageSections(sectionsValue: unknown, sectionOrderValue: unknown) {
  const sectionOrder = normalizeStringArray(sectionOrderValue);
  const sections = normalizePromptPresetSections(sectionsValue);

  return promptPresetSectionsInOrder(sections, sectionOrder)
    .filter((section) => section.enabled && !section.isMarker && section.content.trim())
    .map((section) => section.content.trim())
    .join("\n\n");
}

function normalizePromptPresetPackage(value: Record<string, unknown>): PromptPresetRecord | null {
  if (!isRecord(value.data) || !isRecord(value.data.preset)) return null;

  const preset = value.data.preset;
  const systemPrompt =
    readString(preset.systemPrompt).trim() ||
    systemPromptFromPackageSections(value.data.sections, preset.sectionOrder);

  return normalizePromptPresetRecord({
    id: readString(preset.id).trim() || readString(value.id).trim(),
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
    sections: value.data.sections,
    groups: value.data.groups,
    choiceBlocks: value.data.choiceBlocks,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
  });
}

export function normalizePromptPresetImportRecord(value: unknown): PromptPresetRecord | null {
  if (!isRecord(value)) return null;
  return normalizePromptPresetPackage(value) ?? normalizePromptPresetRecord(value);
}
