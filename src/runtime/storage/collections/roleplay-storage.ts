import type { RoleplayEntry, RoleplayThread } from "../../../engine/roleplay";
import {
  isRecord,
  readNullableString,
  readString,
  readStringArray,
  readTimestamp,
} from "../storage-json";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";

function normalizeRoleplayEntryRole(value: unknown): RoleplayEntry["role"] {
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

function normalizeRoleplayEntryOrigin(value: unknown): RoleplayEntry["origin"] {
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

function normalizeRoleplayEntry(value: unknown, threadId: string): RoleplayEntry | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id).trim();
  const body = readString(value.body).trim();
  if (!id || !body) return null;

  const now = new Date().toISOString();
  return {
    id,
    threadId,
    role: normalizeRoleplayEntryRole(value.role),
    characterId: readNullableString(value.characterId),
    personaId: readNullableString(value.personaId),
    label: readString(value.label, "Roleplay").trim() || "Roleplay",
    body,
    origin: normalizeRoleplayEntryOrigin(value.origin),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function normalizeRoleplayThread(value: unknown): RoleplayThread | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  if (!id || !title) return null;

  const now = new Date().toISOString();
  const entries = Array.isArray(value.entries)
    ? value.entries
        .map((entry) => normalizeRoleplayEntry(entry, id))
        .filter((entry): entry is RoleplayEntry => entry !== null)
    : [];

  return {
    id,
    schemaVersion: 1,
    kind: "roleplay",
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

export function loadRoleplayThreads() {
  return [];
}

const roleplayThreadRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.roleplayThreads,
  normalizeRecord: normalizeRoleplayThread,
  seedRecords: [],
});

export function loadRoleplayThreadsFromStorage(rawUrl?: string) {
  return roleplayThreadRepository.loadSnapshot(rawUrl);
}

export function saveRoleplayThreadsToStorage(
  records: RoleplayThread[],
  rawUrl?: string,
) {
  return roleplayThreadRepository.save(records, rawUrl);
}
