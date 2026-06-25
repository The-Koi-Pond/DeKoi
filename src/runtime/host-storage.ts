import { isDesktopHostAvailable } from "../shared/api/desktop-host-common";
import { invokeDesktopRuntime } from "../shared/api/desktop-runtime";
import { invokeRemote } from "../shared/api/remote-runtime";
import {
  RUNTIME_COMMANDS,
  type StorageRuntimeCommand,
} from "../shared/api/runtime-commands";
import {
  isDesktopRuntimeUrl,
  readRemoteRuntimeUrl,
  remoteRuntimeTarget,
} from "../shared/api/runtime-target";
import type { StorageEntity } from "./storage-entities";
import { planStorageRecordSync } from "./storage-record-sync";
import type {
  StorageCollectionRepository,
  StorageMode,
  StorageRecord,
  StorageRecordNormalizer,
  StorageRecordsSnapshot,
  StorageRepositoryInput,
  StorageResult,
  StorageStatus,
} from "./storage-repository";

export type HostStorageMode = StorageMode;
export type HostStorageStatus = StorageStatus;

export type HostStorageResult = StorageResult;
export { mergeStorageResults as mergeHostStorageResults } from "./storage-repository";

export const HOST_STORAGE_UNAVAILABLE_MESSAGE =
  "Host storage is unavailable. Run the Tauri app or configure a Remote Runtime URL.";

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown storage error.");
}

function remoteTargetIsAvailable(rawUrl: string) {
  try {
    return remoteRuntimeTarget(rawUrl) !== null;
  } catch {
    return false;
  }
}

export function getHostStorageMode(rawUrl = readRemoteRuntimeUrl()): HostStorageMode {
  if (isDesktopRuntimeUrl(rawUrl)) {
    return isDesktopHostAvailable() ? "desktop" : "unavailable";
  }

  if (rawUrl.trim()) {
    return remoteTargetIsAvailable(rawUrl) ? "remote" : "unavailable";
  }

  return isDesktopHostAvailable() ? "desktop" : "unavailable";
}

export function hasHostStorage(rawUrl = readRemoteRuntimeUrl()) {
  return getHostStorageMode(rawUrl) !== "unavailable";
}

async function invokeHostStorage<T>(
  command: StorageRuntimeCommand,
  args: Record<string, unknown>,
  rawUrl = readRemoteRuntimeUrl(),
): Promise<T> {
  if (isDesktopRuntimeUrl(rawUrl)) {
    if (isDesktopHostAvailable()) return await invokeDesktopRuntime<T>(command, args);
    throw new Error(HOST_STORAGE_UNAVAILABLE_MESSAGE);
  }

  if (rawUrl.trim()) {
    return await invokeRemote<T>(command, args, rawUrl);
  }

  if (isDesktopHostAvailable()) {
    return await invokeDesktopRuntime<T>(command, args);
  }

  throw new Error(HOST_STORAGE_UNAVAILABLE_MESSAGE);
}

export async function loadHostRecords<T extends StorageRecord>(
  entity: StorageEntity,
  normalizeRecord: StorageRecordNormalizer<T>,
  rawUrl = readRemoteRuntimeUrl(),
): Promise<T[]> {
  const records = await invokeHostStorage<unknown[]>(
    RUNTIME_COMMANDS.storageList,
    {
      entity,
      options: null,
    },
    rawUrl,
  );

  return records
    .map(normalizeRecord)
    .filter((record): record is T => record !== null);
}

export async function saveHostRecords<T extends StorageRecord>(
  entity: StorageEntity,
  records: T[],
  normalizeRecord: StorageRecordNormalizer<T>,
  rawUrl = readRemoteRuntimeUrl(),
): Promise<HostStorageResult> {
  const mode = getHostStorageMode(rawUrl);
  if (mode === "unavailable") {
    return {
      mode,
      status: "error",
      message: HOST_STORAGE_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    const currentRecords = await loadHostRecords(entity, normalizeRecord, rawUrl).catch(
      () => [],
    );
    const operations = planStorageRecordSync({
      currentRecords,
      nextRecords: records,
    });

    await Promise.all(
      operations.map((operation) => {
        if (operation.type === "delete") {
          return invokeHostStorage(
            RUNTIME_COMMANDS.storageDelete,
            {
              entity,
              id: operation.record.id,
            },
            rawUrl,
          );
        }

        if (operation.type === "update") {
          return invokeHostStorage(
            RUNTIME_COMMANDS.storageUpdate,
            {
              entity,
              id: operation.record.id,
              patch: operation.record as unknown as Record<string, unknown>,
            },
            rawUrl,
          );
        }

        return invokeHostStorage(
          RUNTIME_COMMANDS.storageCreate,
          {
            entity,
            value: operation.record as unknown as Record<string, unknown>,
          },
          rawUrl,
        );
      }),
    );

    return {
      mode,
      status: "ready",
      message:
        mode === "remote"
          ? "Saved through remote runtime."
          : "Saved through desktop host storage.",
    };
  } catch (error) {
    return {
      mode,
      status: "error",
      message: `Host storage save failed. ${asErrorMessage(error)}`,
    };
  }
}

export async function loadHostRecordsSnapshot<T extends StorageRecord>({
  entity,
  normalizeRecord,
  rawUrl = readRemoteRuntimeUrl(),
  seedRecords,
}: {
  entity: StorageEntity;
  normalizeRecord: StorageRecordNormalizer<T>;
  rawUrl?: string;
  seedRecords: T[];
}): Promise<StorageRecordsSnapshot<T>> {
  const mode = getHostStorageMode(rawUrl);
  if (mode === "unavailable") {
    return {
      records: seedRecords,
      mode,
      status: "error",
      message: HOST_STORAGE_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    const records = await loadHostRecords(entity, normalizeRecord, rawUrl);
    return {
      records: records.length > 0 ? records : seedRecords,
      mode,
      status: "ready",
      message:
        mode === "remote"
          ? "Remote runtime storage is active."
          : "Desktop host storage is active.",
    };
  } catch (error) {
    return {
      records: seedRecords,
      mode,
      status: "error",
      message: `Host storage unavailable. ${asErrorMessage(error)}`,
    };
  }
}

export function createHostStorageRepository<T extends StorageRecord>({
  entity,
  normalizeRecord,
  seedRecords,
}: StorageRepositoryInput<T>): StorageCollectionRepository<T> {
  return {
    load: (rawUrl) => loadHostRecords(entity, normalizeRecord, rawUrl),
    loadSnapshot: (rawUrl) =>
      loadHostRecordsSnapshot({
        entity,
        normalizeRecord,
        rawUrl,
        seedRecords,
      }),
    save: (records, rawUrl) =>
      saveHostRecords(entity, records, normalizeRecord, rawUrl),
  };
}
