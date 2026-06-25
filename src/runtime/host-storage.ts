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
import type { HostStorageEntity } from "./storage-entities";

export type HostStorageMode = "desktop" | "remote" | "unavailable";
export type HostStorageStatus = "ready" | "error";

export type HostStorageResult = {
  mode: HostStorageMode;
  status: HostStorageStatus;
  message: string;
};

export const HOST_STORAGE_UNAVAILABLE_MESSAGE =
  "Host storage is unavailable. Run the Tauri app or configure a Remote Runtime URL.";

export function mergeHostStorageResults<T extends HostStorageResult>(
  results: readonly T[],
): T {
  const fallback = results[0];
  if (!fallback) {
    throw new Error("Cannot merge an empty host storage result list.");
  }

  return (
    results.find((result) => result.status === "error") ??
    results.find((result) => result.mode !== "unavailable") ??
    fallback
  );
}

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown storage error.");
}

function comparableRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = { ...(value as Record<string, unknown>) };
  delete record.createdAt;
  delete record.updatedAt;
  return record;
}

function recordsMatch(left: unknown, right: unknown) {
  return JSON.stringify(comparableRecord(left)) === JSON.stringify(comparableRecord(right));
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

export async function loadHostRecords<T extends { id: string }>(
  entity: HostStorageEntity,
  normalizeRecord: (value: unknown) => T | null,
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

export async function saveHostRecords<T extends { id: string }>(
  entity: HostStorageEntity,
  records: T[],
  normalizeRecord: (value: unknown) => T | null,
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
    const currentById = new Map(
      currentRecords.map((record) => [record.id, record] as const),
    );
    const currentIds = new Set(currentById.keys());
    const nextIds = new Set(records.map((record) => record.id));

    await Promise.all(
      records.flatMap((record) => {
        const currentRecord = currentById.get(record.id);
        if (currentRecord && recordsMatch(currentRecord, record)) return [];

        return [
          currentIds.has(record.id)
            ? invokeHostStorage(
                RUNTIME_COMMANDS.storageUpdate,
                {
                  entity,
                  id: record.id,
                  patch: record as unknown as Record<string, unknown>,
                },
                rawUrl,
              )
            : invokeHostStorage(
                RUNTIME_COMMANDS.storageCreate,
                {
                  entity,
                  value: record as unknown as Record<string, unknown>,
                },
                rawUrl,
              ),
        ];
      }),
    );

    await Promise.all(
      currentRecords
        .filter((record) => !nextIds.has(record.id))
        .map((record) =>
          invokeHostStorage(
            RUNTIME_COMMANDS.storageDelete,
            {
              entity,
              id: record.id,
            },
            rawUrl,
          ),
        ),
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

export async function loadHostRecordsSnapshot<T extends { id: string }>({
  entity,
  normalizeRecord,
  rawUrl = readRemoteRuntimeUrl(),
  seedRecords,
}: {
  entity: HostStorageEntity;
  normalizeRecord: (value: unknown) => T | null;
  rawUrl?: string;
  seedRecords: T[];
}): Promise<{ records: T[] } & HostStorageResult> {
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
