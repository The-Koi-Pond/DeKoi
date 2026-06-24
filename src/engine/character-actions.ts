import type { CharacterRecord } from "./character";

export interface CharacterRecordInput {
  displayName: string;
  shortName?: string | null;
  summary?: string;
  description?: string;
  avatarUrl?: string | null;
  lorebookIds?: string[];
}

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanNullableText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanLorebookIds(value: string[] | undefined) {
  return [...new Set(value ?? [])].filter(Boolean);
}

export function createCharacterRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: CharacterRecordInput;
  now: string;
}): CharacterRecord {
  return {
    id,
    schemaVersion: 1,
    displayName: cleanText(input.displayName, "Unnamed companion"),
    shortName: cleanNullableText(input.shortName),
    summary: cleanText(input.summary),
    description: cleanText(input.description),
    avatarUrl: cleanNullableText(input.avatarUrl),
    lorebookIds: cleanLorebookIds(input.lorebookIds),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateCharacterRecord(
  record: CharacterRecord,
  input: CharacterRecordInput,
  updatedAt: string,
): CharacterRecord {
  return {
    ...record,
    displayName: cleanText(input.displayName, record.displayName),
    shortName: cleanNullableText(input.shortName),
    summary: cleanText(input.summary),
    description: cleanText(input.description),
    avatarUrl: cleanNullableText(input.avatarUrl),
    lorebookIds: cleanLorebookIds(input.lorebookIds),
    updatedAt,
  };
}

export function duplicateCharacterRecord(
  record: CharacterRecord,
  id: string,
  now: string,
): CharacterRecord {
  return {
    ...record,
    id,
    displayName: `${record.displayName} Copy`,
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteCharacterRecord(records: CharacterRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function removeCharacterLorebook(
  record: CharacterRecord,
  lorebookId: string,
  updatedAt: string,
): CharacterRecord {
  if (!record.lorebookIds.includes(lorebookId)) return record;

  return {
    ...record,
    lorebookIds: record.lorebookIds.filter((id) => id !== lorebookId),
    updatedAt,
  };
}
