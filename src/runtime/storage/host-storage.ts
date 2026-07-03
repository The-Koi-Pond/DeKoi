import { isDesktopHostAvailable } from "../../shared/api/desktop-host-common";
import { invokeDesktopRuntime } from "../../shared/api/desktop-runtime";
import {
  readDesktopStorageCollectionMetadata,
  type DesktopStorageCollectionMetadataResult,
} from "../../shared/api/desktop-storage-metadata";
import { invokeRemote } from "../../shared/api/remote-runtime";
import { RUNTIME_COMMANDS, type StorageRuntimeCommand } from "../../shared/api/runtime-commands";
import {
  isDesktopRuntimeUrl,
  readRemoteRuntimeUrl,
  remoteRuntimeTarget,
} from "../../shared/api/runtime-target";
import { HOST_STORAGE_ENTITIES, type StorageEntity } from "./storage-entities";
import type {
  StorageCollectionRepository,
  StorageCollectionMetadata,
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
export type HostStorageMetadataError = {
  entity: StorageEntity;
  message: string;
};
export type HostStorageMetadataResult = StorageResult & {
  metadataAvailable: boolean;
  collectionMetadata: StorageCollectionMetadata[];
  metadataErrors: HostStorageMetadataError[];
};
type HostStorageReplaceResponse = {
  ok: boolean;
  count: number;
  metadata?: unknown;
};
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

  return records.map(normalizeRecord).filter((record): record is T => record !== null);
}

function normalizeOutgoingRecords<T extends StorageRecord>(
  entity: StorageEntity,
  records: T[],
  normalizeRecord: StorageRecordNormalizer<T>,
): T[] {
  return records.map((record, index) => {
    const normalizedRecord = normalizeRecord(record);
    if (normalizedRecord) return normalizedRecord;

    throw new Error(`Cannot save invalid ${entity} record at index ${index}.`);
  });
}

function storageReplaceUnsupportedMessage(error: unknown) {
  const message = asErrorMessage(error);
  return message.includes(RUNTIME_COMMANDS.storageReplace)
    ? `Runtime must support ${RUNTIME_COMMANDS.storageReplace} collection writes. ${message}`
    : message;
}

function isHostStorageReplaceResponse(response: unknown): response is HostStorageReplaceResponse {
  if (!response || typeof response !== "object") return false;

  const candidate = response as Partial<HostStorageReplaceResponse>;
  const count = candidate.count;
  return candidate.ok === true && Number.isSafeInteger(count) && count !== undefined && count >= 0;
}

function normalizeStorageCollectionMetadata(value: unknown): StorageCollectionMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Partial<StorageCollectionMetadata>;
  if (typeof candidate.entity !== "string" || typeof candidate.exists !== "boolean") {
    return null;
  }

  const entity = candidate.entity as string;
  if (!HOST_STORAGE_ENTITIES.includes(entity as StorageEntity)) return null;

  const byteLength = candidate.byteLength;
  const updatedAtMs = candidate.updatedAtMs;
  const contentHash = candidate.contentHash;

  return {
    entity: entity as StorageEntity,
    exists: candidate.exists,
    byteLength:
      typeof byteLength === "number" && Number.isSafeInteger(byteLength) ? byteLength : null,
    updatedAtMs:
      typeof updatedAtMs === "number" && Number.isSafeInteger(updatedAtMs) ? updatedAtMs : null,
    contentHash: typeof contentHash === "string" ? contentHash : null,
  };
}

function normalizeStorageCollectionMetadataError(
  result: DesktopStorageCollectionMetadataResult,
): HostStorageMetadataError | null {
  if (!result.error) return null;
  if (!HOST_STORAGE_ENTITIES.includes(result.entity as StorageEntity)) return null;

  return {
    entity: result.entity as StorageEntity,
    message: result.error,
  };
}

function formatStorageMetadataErrors(errors: readonly HostStorageMetadataError[]) {
  return errors.map((error) => `${error.entity}: ${error.message}`).join("; ");
}

export function createHostStorageMetadataResult({
  mode,
  collectionMetadata,
  metadataErrors,
}: {
  mode: HostStorageMode;
  collectionMetadata: StorageCollectionMetadata[];
  metadataErrors: HostStorageMetadataError[];
}): HostStorageMetadataResult {
  if (metadataErrors.length > 0) {
    return {
      mode,
      status: "error",
      message: `Desktop storage metadata is partially unavailable. Failed collection(s): ${formatStorageMetadataErrors(metadataErrors)}`,
      metadataAvailable: false,
      collectionMetadata,
      metadataErrors,
    };
  }

  return {
    mode,
    status: "ready",
    message: "Desktop storage metadata is available.",
    metadataAvailable: collectionMetadata.length > 0,
    collectionMetadata,
    metadataErrors,
  };
}

export async function loadHostStorageMetadata(
  rawUrl = readRemoteRuntimeUrl(),
): Promise<HostStorageMetadataResult> {
  const mode = getHostStorageMode(rawUrl);
  if (mode === "unavailable") {
    return {
      mode,
      status: "error",
      message: HOST_STORAGE_UNAVAILABLE_MESSAGE,
      metadataAvailable: false,
      collectionMetadata: [],
      metadataErrors: [],
    };
  }

  if (mode !== "desktop") {
    return {
      mode,
      status: "ready",
      message: "Storage metadata is not available for remote runtime targets.",
      metadataAvailable: false,
      collectionMetadata: [],
      metadataErrors: [],
    };
  }

  try {
    const metadataResults = await readDesktopStorageCollectionMetadata();
    const collectionMetadata = metadataResults.flatMap((result) => {
      const normalized = normalizeStorageCollectionMetadata(result.metadata);
      return normalized ? [normalized] : [];
    });
    const metadataErrors = metadataResults.flatMap((result) => {
      const normalized = normalizeStorageCollectionMetadataError(result);
      return normalized ? [normalized] : [];
    });

    return createHostStorageMetadataResult({
      mode,
      collectionMetadata,
      metadataErrors,
    });
  } catch (error) {
    return {
      mode,
      status: "error",
      message: `Desktop storage metadata unavailable. ${asErrorMessage(error)}`,
      metadataAvailable: false,
      collectionMetadata: [],
      metadataErrors: [],
    };
  }
}

export async function replaceHostRecords<T extends StorageRecord>(
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
    const normalizedRecords = normalizeOutgoingRecords(entity, records, normalizeRecord);
    const response = await invokeHostStorage<HostStorageReplaceResponse>(
      RUNTIME_COMMANDS.storageReplace,
      {
        entity,
        records: normalizedRecords as unknown as Record<string, unknown>[],
      },
      rawUrl,
    );
    if (!isHostStorageReplaceResponse(response)) {
      throw new Error(`${RUNTIME_COMMANDS.storageReplace} returned an incompatible response.`);
    }
    if (response.count !== normalizedRecords.length) {
      throw new Error(
        `${RUNTIME_COMMANDS.storageReplace} wrote ${response.count} ${entity} records, expected ${normalizedRecords.length}.`,
      );
    }
    const metadata = normalizeStorageCollectionMetadata(response.metadata);
    if (response.metadata !== undefined && response.metadata !== null) {
      if (!metadata) {
        throw new Error(
          `${RUNTIME_COMMANDS.storageReplace} returned incompatible metadata for ${entity}.`,
        );
      }
      if (metadata.entity !== entity) {
        throw new Error(
          `${RUNTIME_COMMANDS.storageReplace} returned metadata for ${metadata.entity}, expected ${entity}.`,
        );
      }
    }

    return {
      mode,
      status: "ready",
      message:
        mode === "remote" ? "Saved through remote runtime." : "Saved through desktop host storage.",
      metadata,
    };
  } catch (error) {
    return {
      mode,
      status: "error",
      message: `Host storage save failed. ${storageReplaceUnsupportedMessage(error)}`,
    };
  }
}

export async function saveHostRecords<T extends StorageRecord>(
  entity: StorageEntity,
  records: T[],
  normalizeRecord: StorageRecordNormalizer<T>,
  rawUrl = readRemoteRuntimeUrl(),
): Promise<HostStorageResult> {
  return replaceHostRecords(entity, records, normalizeRecord, rawUrl);
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
        mode === "remote" ? "Remote runtime storage is active." : "Desktop host storage is active.",
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
    replace: (records, rawUrl) => replaceHostRecords(entity, records, normalizeRecord, rawUrl),
    save: (records, rawUrl) => replaceHostRecords(entity, records, normalizeRecord, rawUrl),
  };
}
