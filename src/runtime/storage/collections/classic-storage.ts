import type { ClassicEntry, ClassicThread } from "../../../engine/classic";
import {
  isRecord,
  readNullableString,
  readString,
  readStringArray,
  readTimestamp,
} from "../storage-json";
import { createHostStorageRepository } from "../host-storage";
import { STORAGE_ENTITIES } from "../storage-entities";

function normalizeClassicEntryRole(value: unknown): ClassicEntry["role"] {
  if (
    value === "scene" ||
    value === "persona" ||
    value === "character" ||
    value === "narration"
  ) {
    return value;
  }

  return "narration";
}

function normalizeClassicEntryOrigin(value: unknown): ClassicEntry["origin"] {
  if (
    value === "manual" ||
    value === "generated" ||
    value === "imported" ||
    value === "sample"
  ) {
    return value;
  }

  return "manual";
}

function normalizeClassicEntry(value: unknown, threadId: string): ClassicEntry | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id).trim();
  const body = readString(value.body).trim();
  if (!id || !body) return null;

  const now = new Date().toISOString();
  return {
    id,
    threadId,
    role: normalizeClassicEntryRole(value.role),
    characterId: readNullableString(value.characterId),
    personaId: readNullableString(value.personaId),
    label: readString(value.label, "Classic").trim() || "Classic",
    body,
    origin: normalizeClassicEntryOrigin(value.origin),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function normalizeClassicThread(value: unknown): ClassicThread | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  if (!id || !title) return null;

  const now = new Date().toISOString();
  const entries = Array.isArray(value.entries)
    ? value.entries
        .map((entry) => normalizeClassicEntry(entry, id))
        .filter((entry): entry is ClassicEntry => entry !== null)
    : [];

  return {
    id,
    schemaVersion: 1,
    kind: "classic",
    mode: "scene",
    title,
    sceneText: readString(value.sceneText).trim(),
    characterIds: readStringArray(value.characterIds),
    activePersonaId: readNullableString(value.activePersonaId),
    lorebookIds: readStringArray(value.lorebookIds),
    providerConnectionId: readNullableString(value.providerConnectionId),
    entries,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadClassicThreads() {
  return [];
}

const classicThreadRepository = createHostStorageRepository({
  entity: STORAGE_ENTITIES.classicThreads,
  normalizeRecord: normalizeClassicThread,
  seedRecords: [],
});

export function loadClassicThreadsFromStorage(rawUrl?: string) {
  return classicThreadRepository.loadSnapshot(rawUrl);
}

export function saveClassicThreadsToStorage(
  records: ClassicThread[],
  rawUrl?: string,
) {
  return classicThreadRepository.save(records, rawUrl);
}
