import type {
  MacroVariableScope,
  MacroVariableScopeOwnerKind,
} from "../../../engine/contracts/types/macro-variables";
import { readRemoteRuntimeUrl } from "../../../shared/api/runtime-target";
import { isRecord, readString, readTimestamp } from "../storage-json";
import { STORAGE_ENTITIES } from "../storage-entities";
import { createStorageRepository, type StorageMode } from "../storage-repository-factory";
import type { StorageCollectionMetadata } from "../storage-repository";

export type MacroVariableStateStorageSnapshot = {
  states: MacroVariableScope[];
  droppedRecordCount: number;
  mode: StorageMode;
  status: "ready" | "error";
  message: string;
};

export type MacroVariableStateStorageSaveResult = Omit<
  MacroVariableStateStorageSnapshot,
  "states" | "droppedRecordCount"
> & {
  metadata?: StorageCollectionMetadata | null;
};

function normalizeOwnerKind(value: unknown): MacroVariableScopeOwnerKind | null {
  if (value === "mode-branch" || value === "global") {
    return value;
  }
  return null;
}

function normalizeVariables(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  const variables: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.trim();
    if (!name) continue;
    variables[name] = readString(rawValue);
  }
  return variables;
}

export function normalizeMacroVariableScope(value: unknown): MacroVariableScope | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const ownerKind = normalizeOwnerKind(value.ownerKind);
  const rawOwnerId = readString(value.ownerId).trim();
  const ownerId = ownerKind === "global" ? "global" : rawOwnerId;
  if (!id || !ownerKind || !ownerId) return null;

  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 1,
    ownerKind,
    ownerId,
    variables: normalizeVariables(value.variables),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

const macroVariableStateRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.macroVariableStates,
  normalizeRecord: normalizeMacroVariableScope,
  seedRecords: [],
});

export async function loadMacroVariableStatesFromStorage(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<MacroVariableStateStorageSnapshot> {
  const snapshot = await macroVariableStateRepository.loadSnapshot(rawUrl);

  return {
    states: snapshot.records,
    droppedRecordCount: snapshot.droppedRecordCount,
    mode: snapshot.mode,
    status: snapshot.status,
    message: snapshot.message,
  };
}

export async function saveMacroVariableStatesToStorage(
  states: MacroVariableScope[],
  rawUrl = readRemoteRuntimeUrl(),
): Promise<MacroVariableStateStorageSaveResult> {
  const result = await macroVariableStateRepository.save(states, rawUrl);

  return {
    mode: result.mode,
    status: result.status,
    message: result.message,
    metadata: result.metadata,
  };
}
