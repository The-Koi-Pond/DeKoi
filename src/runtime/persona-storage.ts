import type { PersonaRecord } from "../engine/persona";
import { samplePersona } from "../engine/sample-messenger";
import {
  isRecord,
  loadCatalogRecords,
  readNullableString,
  readString,
  readTimestamp,
  saveCatalogRecords,
} from "./catalog-storage";

const PERSONA_STORAGE_KEY = "dekoi:personas:v1";

export function normalizePersonaRecord(value: unknown): PersonaRecord | null {
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
    summary: readString(value.summary).trim(),
    description: readString(value.description).trim(),
    avatarUrl: readNullableString(value.avatarUrl),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadPersonaRecords() {
  return loadCatalogRecords(PERSONA_STORAGE_KEY, [samplePersona], normalizePersonaRecord);
}

export function savePersonaRecords(records: PersonaRecord[]) {
  saveCatalogRecords(PERSONA_STORAGE_KEY, records);
}
