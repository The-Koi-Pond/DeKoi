import type { PersonaNoteRole, PersonaRecord } from "../../../engine/contracts/types/persona";
import {
  isRecord,
  readNullableString,
  readString,
  readTimestamp,
} from "../storage-json";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";

function readTrimmedStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function readNumberInRange(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : fallback;
}

function readPersonaNoteRole(value: unknown): PersonaNoteRole {
  return value === "user" || value === "assistant" ? value : "system";
}

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
    nickname: readNullableString(value.nickname),
    description: readString(value.description).trim(),
    personality: readString(value.personality).trim() || readString(value.summary).trim(),
    scenario: readString(value.scenario).trim(),
    systemPrompt: readString(value.systemPrompt).trim(),
    postHistoryInstructions: readString(value.postHistoryInstructions).trim(),
    creator: readString(value.creator).trim(),
    characterVersion: readString(value.characterVersion).trim(),
    creatorNotes: readString(value.creatorNotes).trim(),
    tags: readTrimmedStringArray(value.tags),
    characterNote: readString(value.characterNote).trim(),
    characterNoteDepth: readNumberInRange(value.characterNoteDepth, 4, 0, 99),
    characterNoteRole: readPersonaNoteRole(value.characterNoteRole),
    talkativeness: readNumberInRange(value.talkativeness, 50, 0, 100),
    avatarUrl: readNullableString(value.avatarUrl),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadPersonaRecords() {
  return [];
}

const personaRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.personas,
  normalizeRecord: normalizePersonaRecord,
  seedRecords: [],
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
