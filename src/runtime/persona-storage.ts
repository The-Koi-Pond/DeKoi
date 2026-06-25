import type { PersonaRecord } from "../engine/persona";
import { samplePersona } from "../engine/sample-messenger";
import {
  isRecord,
  readNullableString,
  readString,
  readTimestamp,
} from "./catalog-storage";
import { createHostStorageRepository } from "./host-storage";
import { STORAGE_ENTITIES } from "./storage-entities";

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
  return [samplePersona];
}

const personaRepository = createHostStorageRepository({
  entity: STORAGE_ENTITIES.personas,
  normalizeRecord: normalizePersonaRecord,
  seedRecords: [samplePersona],
});

export function loadPersonaRecordsFromStorage(rawUrl?: string) {
  return personaRepository.loadSnapshot(rawUrl);
}

export function savePersonaRecordsToStorage(
  records: PersonaRecord[],
  rawUrl?: string,
) {
  return personaRepository.save(records, rawUrl);
}
