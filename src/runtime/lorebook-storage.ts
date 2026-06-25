import type { LorebookEntryRecord, LorebookRecord } from "../engine/lorebook";
import { sampleLorebook } from "../engine/sample-messenger";
import {
  isRecord,
  readString,
  readTimestamp,
} from "./storage/storage-json";
import { createHostStorageRepository } from "./host-storage";
import { STORAGE_ENTITIES } from "./storage/storage-entities";

function normalizeLorebookEntryRecord(value: unknown): LorebookEntryRecord | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  const body = readString(value.body).trim();
  if (!id || !title) return null;

  const now = new Date().toISOString();
  return {
    id,
    title,
    body,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function normalizeLorebookRecord(value: unknown): LorebookRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  if (!id || !title) return null;

  const now = new Date().toISOString();
  const entries = Array.isArray(value.entries)
    ? value.entries
        .map(normalizeLorebookEntryRecord)
        .filter((entry): entry is LorebookEntryRecord => entry !== null)
    : [];

  return {
    id,
    schemaVersion: 1,
    title,
    summary: readString(value.summary).trim(),
    entries,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadLorebookRecords() {
  return [sampleLorebook];
}

const lorebookRepository = createHostStorageRepository({
  entity: STORAGE_ENTITIES.lorebooks,
  normalizeRecord: normalizeLorebookRecord,
  seedRecords: [sampleLorebook],
});

export function loadLorebookRecordsFromStorage(rawUrl?: string) {
  return lorebookRepository.loadSnapshot(rawUrl);
}

export function saveLorebookRecordsToStorage(
  records: LorebookRecord[],
  rawUrl?: string,
) {
  return lorebookRepository.save(records, rawUrl);
}
