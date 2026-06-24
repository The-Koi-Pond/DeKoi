import type { CharacterRecord } from "../engine/character";
import { sampleCompanions } from "../engine/sample-messenger";
import {
  isRecord,
  readNullableString,
  readString,
  readStringArray,
  readTimestamp,
} from "./catalog-storage";
import { loadHostRecordsSnapshot, saveHostRecords } from "./host-storage";

const CHARACTERS_ENTITY = "characters";

export function normalizeCharacterRecord(value: unknown): CharacterRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const displayName = readString(value.displayName).trim();
  if (!id || !displayName) return null;

  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 1,
    displayName,
    shortName: readNullableString(value.shortName),
    summary: readString(value.summary).trim(),
    description: readString(value.description).trim(),
    avatarUrl: readNullableString(value.avatarUrl),
    lorebookIds: readStringArray(value.lorebookIds),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadCharacterRecords() {
  return sampleCompanions;
}

export function loadCharacterRecordsFromStorage(rawUrl?: string) {
  return loadHostRecordsSnapshot({
    entity: CHARACTERS_ENTITY,
    normalizeRecord: normalizeCharacterRecord,
    rawUrl,
    seedRecords: sampleCompanions,
  });
}

export function saveCharacterRecordsToStorage(
  records: CharacterRecord[],
  rawUrl?: string,
) {
  return saveHostRecords(CHARACTERS_ENTITY, records, normalizeCharacterRecord, rawUrl);
}
