import {
  attachRoleplayEntriesToThreads,
  toRoleplayThreadRecord,
  type RoleplayEntry,
  type RoleplayThread,
  type RoleplayThreadRecord,
} from "../../../engine/contracts/types/roleplay";
import {
  isRecord,
  readNullableString,
  readString,
  readStringArray,
  readTimestamp,
} from "../storage-json";
import { createStorageRepository } from "../storage-repository-factory";
import type { StorageRecordNormalization, StorageResult } from "../storage-repository";
import { STORAGE_ENTITIES } from "../storage-entities";
import { normalizePromptPresetThreadChoiceSelectionsForPreset } from "../prompt-preset-relationship-repair";

type RoleplayThreadStorageRecord = RoleplayThreadRecord & {
  entries?: RoleplayEntry[];
};

export type NormalizedRoleplayThread = {
  thread: RoleplayThread;
  droppedRecordCount: number;
  presetChoiceSelectionsChanged: boolean;
};

export type RoleplayStorageSnapshot = {
  records: RoleplayThread[];
  hasLegacyEmbeddedEntries: boolean;
  droppedRecordCount: number;
  normalizationChangedRecordIds: string[];
  mode: StorageResult["mode"];
  status: StorageResult["status"];
  message: string;
};

function normalizeRoleplayEntryRole(value: unknown): RoleplayEntry["role"] {
  if (value === "scene" || value === "persona" || value === "character" || value === "narration") {
    return value;
  }

  return "narration";
}

function normalizeRoleplayEntryOrigin(value: unknown): RoleplayEntry["origin"] {
  if (value === "manual" || value === "generated" || value === "imported" || value === "sample") {
    return value;
  }

  return "manual";
}

export function normalizeRoleplayEntryRecord(
  value: unknown,
  fallbackThreadId = "",
): RoleplayEntry | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id).trim();
  const threadId = readString(value.threadId, fallbackThreadId).trim();
  const body = readString(value.body).trim();
  if (!id || !threadId || !body) return null;

  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 1,
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

export function normalizeRoleplayThreadWithMetadata(
  value: unknown,
): NormalizedRoleplayThread | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  if (!id || !title) return null;

  const now = new Date().toISOString();
  const entries: RoleplayEntry[] = [];
  let droppedRecordCount = 0;
  if (Array.isArray(value.entries)) {
    for (const entry of value.entries) {
      const normalizedEntry = normalizeRoleplayEntryRecord(entry, id);
      if (normalizedEntry) {
        entries.push(normalizedEntry);
      } else {
        droppedRecordCount += 1;
      }
    }
  }

  const presetId = readNullableString(value.presetId);
  const normalizedPresetChoiceSelections = normalizePromptPresetThreadChoiceSelectionsForPreset(
    presetId,
    value.presetChoiceSelections,
  );

  return {
    thread: {
      id,
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title,
      sceneText: readString(value.sceneText).trim(),
      characterIds: readStringArray(value.characterIds),
      activePersonaId: readNullableString(value.activePersonaId),
      lorebookIds: readStringArray(value.lorebookIds),
      presetId,
      presetChoiceSelections: normalizedPresetChoiceSelections.selections,
      providerConnectionId: readNullableString(value.providerConnectionId),
      entries,
      createdAt: readTimestamp(value.createdAt, now),
      updatedAt: readTimestamp(value.updatedAt, now),
    },
    droppedRecordCount,
    presetChoiceSelectionsChanged: normalizedPresetChoiceSelections.changed,
  };
}

export function loadRoleplayThreads() {
  return [];
}

function normalizeRoleplayThreadStorageRecord(
  value: unknown,
): StorageRecordNormalization<RoleplayThreadStorageRecord> | null {
  const normalized = normalizeRoleplayThreadWithMetadata(value);
  if (!normalized) return null;

  const { thread } = normalized;
  const record = toRoleplayThreadRecord(thread);
  return {
    record: thread.entries.length > 0 ? { ...record, entries: thread.entries } : record,
    droppedRecordCount: normalized.droppedRecordCount,
    normalizationChanged: normalized.presetChoiceSelectionsChanged,
  };
}

const roleplayThreadRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.roleplayThreads,
  normalizeRecord: normalizeRoleplayThreadStorageRecord,
  seedRecords: [],
});

export async function loadRoleplayThreadsFromStorage(
  rawUrl?: string,
): Promise<RoleplayStorageSnapshot> {
  const snapshot = await roleplayThreadRepository.loadSnapshot(rawUrl);
  const hasLegacyEmbeddedEntries = snapshot.records.some(
    (thread) => Array.isArray(thread.entries) && thread.entries.length > 0,
  );
  return {
    ...snapshot,
    records: attachRoleplayEntriesToThreads(snapshot.records, []),
    hasLegacyEmbeddedEntries,
  };
}

export function saveRoleplayThreadsToStorage(records: RoleplayThread[], rawUrl?: string) {
  return roleplayThreadRepository.save(records.map(toRoleplayThreadRecord), rawUrl);
}
