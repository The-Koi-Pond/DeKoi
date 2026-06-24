import type { LorebookEntryRecord, LorebookRecord } from "./lorebook";

export interface LorebookEntryInput {
  title: string;
  body?: string;
  enabled?: boolean;
}

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

export function createLorebookEntryRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: LorebookEntryInput;
  now: string;
}): LorebookEntryRecord {
  return {
    id,
    title: cleanText(input.title, "Untitled note"),
    body: cleanText(input.body),
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateLorebookEntryRecord(
  record: LorebookEntryRecord,
  input: LorebookEntryInput,
  updatedAt: string,
): LorebookEntryRecord {
  return {
    ...record,
    title: cleanText(input.title, record.title),
    body: cleanText(input.body),
    enabled: input.enabled ?? record.enabled,
    updatedAt,
  };
}

export function duplicateLorebookEntryRecord(
  record: LorebookEntryRecord,
  id: string,
  now: string,
): LorebookEntryRecord {
  return {
    ...record,
    id,
    title: `${record.title} Copy`,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertLorebookEntry(
  lorebook: LorebookRecord,
  entry: LorebookEntryRecord,
  updatedAt: string,
): LorebookRecord {
  const exists = lorebook.entries.some((currentEntry) => currentEntry.id === entry.id);
  return {
    ...lorebook,
    entries: exists
      ? lorebook.entries.map((currentEntry) =>
          currentEntry.id === entry.id ? entry : currentEntry,
        )
      : [entry, ...lorebook.entries],
    updatedAt,
  };
}

export function deleteLorebookEntry(
  lorebook: LorebookRecord,
  entryId: string,
  updatedAt: string,
): LorebookRecord {
  return {
    ...lorebook,
    entries: lorebook.entries.filter((entry) => entry.id !== entryId),
    updatedAt,
  };
}
