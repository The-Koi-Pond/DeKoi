import type {
  Ripple,
  RippleState,
  RippleStateOwnerKind,
  RippleTone,
} from "../../../engine/contracts/types/ripples";
import { createStorageRepository, type StorageMode } from "../storage-repository-factory";
import { readRemoteRuntimeUrl } from "../../../shared/api/runtime-target";
import { isRecord, readString, readTimestamp } from "../storage-json";
import { STORAGE_ENTITIES } from "../storage-entities";

export type RippleStateStorageSnapshot = {
  states: RippleState[];
  droppedRecordCount: number;
  mode: StorageMode;
  status: "ready" | "error";
  message: string;
};

function normalizeRippleTone(value: unknown): RippleTone {
  if (value === "shift" || value === "meter") return value;
  return "note";
}

function normalizeOwnerKind(value: unknown): RippleStateOwnerKind | null {
  if (value === "mode-branch") return value;
  return null;
}

function normalizeRipple(value: unknown): Ripple | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  const body = readString(value.body).trim();
  if (!id || (!title && !body)) return null;

  const now = new Date().toISOString();
  const updatedAt = readTimestamp(value.updatedAt, now);

  return {
    id,
    tone: normalizeRippleTone(value.tone),
    title: title || "Untitled ripple",
    body,
    createdAt: readTimestamp(value.createdAt, updatedAt),
    updatedAt,
  };
}

export function normalizeRippleState(value: unknown): RippleState | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const legacyThreadId = readString(value.threadId).trim();
  const ownerId = readString(value.ownerId, legacyThreadId).trim();
  const ownerKind = normalizeOwnerKind(value.ownerKind);
  if (!id || !ownerId || !ownerKind) return null;

  const now = new Date().toISOString();
  const ripples = Array.isArray(value.ripples)
    ? value.ripples.map(normalizeRipple).filter((ripple): ripple is Ripple => ripple !== null)
    : [];

  return {
    id,
    schemaVersion: 1,
    ownerKind,
    ownerId,
    ripples,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadRippleStates() {
  return [];
}

const rippleStateRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.rippleStates,
  normalizeRecord: normalizeRippleState,
  seedRecords: [],
});

export async function loadRippleStatesFromStorage(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<RippleStateStorageSnapshot> {
  const snapshot = await rippleStateRepository.loadSnapshot(rawUrl);

  return {
    states: snapshot.records,
    droppedRecordCount: snapshot.droppedRecordCount,
    mode: snapshot.mode,
    status: snapshot.status,
    message: snapshot.message,
  };
}

export async function saveRippleStatesToStorage(
  states: RippleState[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<Omit<RippleStateStorageSnapshot, "states" | "droppedRecordCount">> {
  const result = await rippleStateRepository.save(states, rawUrl);

  return {
    mode: result.mode,
    status: result.status,
    message: result.message,
  };
}
