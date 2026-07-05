import type {
  LoreRuntimeEntryState,
  LoreRuntimeState,
  LoreRuntimeStateOwnerKind,
} from "../../../engine/contracts/types/lore-runtime-state";
import { readRemoteRuntimeUrl } from "../../../shared/api/runtime-target";
import { isRecord, readString, readTimestamp } from "../storage-json";
import { createStorageRepository, type StorageMode } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";

type LoreRuntimeStateStorageMode = StorageMode;
type LoreRuntimeStateStorageStatus = "ready" | "error";

export type LoreRuntimeStateStorageSnapshot = {
  states: LoreRuntimeState[];
  droppedRecordCount: number;
  mode: LoreRuntimeStateStorageMode;
  status: LoreRuntimeStateStorageStatus;
  message: string;
};

function readNonNegativeInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : fallback;
}

function normalizeOwnerKind(value: unknown): LoreRuntimeStateOwnerKind | null {
  if (value === "messenger-thread" || value === "roleplay-thread") return value;
  return null;
}

function normalizeLoreRuntimeEntryState(value: unknown): LoreRuntimeEntryState | null {
  if (!isRecord(value)) return null;

  const lorebookId = readString(value.lorebookId).trim();
  const entryId = readString(value.entryId).trim();
  const entryUpdatedAt = readString(value.entryUpdatedAt).trim();
  if (!lorebookId || !entryId || !entryUpdatedAt) return null;

  return {
    lorebookId,
    entryId,
    entryUpdatedAt,
    activatedAtMessageIndex: readNonNegativeInteger(value.activatedAtMessageIndex, 0),
    stickyRemaining: readNonNegativeInteger(value.stickyRemaining, 0),
    cooldownRemaining: readNonNegativeInteger(value.cooldownRemaining, 0),
  };
}

export function normalizeLoreRuntimeState(value: unknown): LoreRuntimeState | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const ownerId = readString(value.ownerId).trim();
  const ownerKind = normalizeOwnerKind(value.ownerKind);
  if (!id || !ownerId || !ownerKind) return null;

  const now = new Date().toISOString();
  const seenEntries = new Set<string>();
  const entries = Array.isArray(value.entries)
    ? value.entries.flatMap((entryValue) => {
        const entryState = normalizeLoreRuntimeEntryState(entryValue);
        if (!entryState) return [];
        const entryKey = `${entryState.lorebookId}\u0000${entryState.entryId}`;
        if (seenEntries.has(entryKey)) return [];
        seenEntries.add(entryKey);
        return [entryState];
      })
    : [];

  return {
    id,
    schemaVersion: 1,
    ownerKind,
    ownerId,
    lastEvaluatedMessageCount: readNonNegativeInteger(value.lastEvaluatedMessageCount, 0),
    entries,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

const loreRuntimeStateRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.loreRuntimeStates,
  normalizeRecord: normalizeLoreRuntimeState,
  seedRecords: [],
});

export async function loadLoreRuntimeStatesFromStorage(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<LoreRuntimeStateStorageSnapshot> {
  const snapshot = await loreRuntimeStateRepository.loadSnapshot(rawUrl);

  return {
    states: snapshot.records,
    droppedRecordCount: snapshot.droppedRecordCount,
    mode: snapshot.mode,
    status: snapshot.status,
    message: snapshot.message,
  };
}

export async function saveLoreRuntimeStatesToStorage(
  states: LoreRuntimeState[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<Omit<LoreRuntimeStateStorageSnapshot, "states" | "droppedRecordCount">> {
  const result = await loreRuntimeStateRepository.save(states, rawUrl);

  return {
    mode: result.mode,
    status: result.status,
    message: result.message,
  };
}
