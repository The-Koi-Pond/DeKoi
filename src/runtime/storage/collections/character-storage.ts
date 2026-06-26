import type { CharacterNoteRole, CharacterRecord } from "../../../engine/character";
import { sampleCompanions } from "../../../engine/sample-messenger";
import {
  isRecord,
  readNullableString,
  readString,
  readStringArray,
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

function readCharacterNoteRole(value: unknown): CharacterNoteRole {
  return value === "user" || value === "assistant" ? value : "system";
}

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
    nickname: readNullableString(value.nickname) ?? readNullableString(value.shortName),
    description: readString(value.description).trim(),
    personality: readString(value.personality).trim() || readString(value.summary).trim(),
    scenario: readString(value.scenario).trim(),
    firstMessage: readString(value.firstMessage).trim(),
    alternateGreetings: readTrimmedStringArray(value.alternateGreetings),
    groupOnlyGreetings: readTrimmedStringArray(value.groupOnlyGreetings),
    exampleMessages: readString(value.exampleMessages).trim(),
    systemPrompt: readString(value.systemPrompt).trim(),
    postHistoryInstructions: readString(value.postHistoryInstructions).trim(),
    creator: readString(value.creator).trim(),
    characterVersion: readString(value.characterVersion).trim(),
    creatorNotes: readString(value.creatorNotes).trim(),
    tags: readTrimmedStringArray(value.tags),
    characterNote: readString(value.characterNote).trim(),
    characterNoteDepth: readNumberInRange(value.characterNoteDepth, 4, 0, 99),
    characterNoteRole: readCharacterNoteRole(value.characterNoteRole),
    talkativeness: readNumberInRange(value.talkativeness, 50, 0, 100),
    avatarUrl: readNullableString(value.avatarUrl),
    lorebookIds: readStringArray(value.lorebookIds),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadCharacterRecords() {
  return sampleCompanions;
}

const characterRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.characters,
  normalizeRecord: normalizeCharacterRecord,
  seedRecords: sampleCompanions,
});

export function loadCharacterRecordsFromStorage(rawUrl?: string) {
  return characterRepository.loadSnapshot(rawUrl);
}

export function saveCharacterRecordsToStorage(
  records: CharacterRecord[],
  rawUrl?: string,
) {
  return characterRepository.save(records, rawUrl);
}
