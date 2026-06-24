import type { CharacterRecord } from "../engine/character";
import { sampleCompanions } from "../engine/sample-messenger";
import {
  isRecord,
  loadCatalogRecords,
  readNullableString,
  readString,
  readStringArray,
  readTimestamp,
  saveCatalogRecords,
} from "./catalog-storage";

const CHARACTER_STORAGE_KEY = "dekoi:characters:v1";

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
  return loadCatalogRecords(
    CHARACTER_STORAGE_KEY,
    sampleCompanions,
    normalizeCharacterRecord,
  );
}

export function saveCharacterRecords(records: CharacterRecord[]) {
  saveCatalogRecords(CHARACTER_STORAGE_KEY, records);
}
