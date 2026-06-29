import {
  readDesktopStorageCollectionMetadata,
  type DesktopStorageCollectionMetadata,
  type DesktopStorageCollectionMetadataResult,
} from "../../shared/api/desktop-storage-metadata";
import {
  finishDesktopStorageCollectionRepair,
  repairDesktopStorageCollection,
  type DesktopStorageRepairStrategy,
} from "../../shared/api/desktop-storage-repair";
import { getHostStorageMode } from "./storage-repository-factory";
import {
  APP_STORAGE_COLLECTION_ENTITIES,
  APP_STORAGE_COLLECTION_LABELS,
  type AppStorageCollectionKey,
} from "./app-storage-snapshot";
import {
  HOST_STORAGE_ENTITIES,
  type StorageEntity,
} from "./storage-entities";
import type {
  StorageCollectionMetadata,
  StorageMode,
  StorageStatus,
} from "./storage-repository";

export type AppStorageRepairStrategy = DesktopStorageRepairStrategy;

type AppStorageRepairCollectionBase = {
  entity: string;
  label: string;
  metadata: StorageCollectionMetadata | null;
  error: string | null;
  backupExists: boolean;
  backupRestorable: boolean;
  temporaryExists: boolean;
  preRepairExists: boolean;
  repairable: boolean;
};

type KnownAppStorageRepairCollectionStatus = AppStorageRepairCollectionBase & {
  known: true;
  collectionKey: AppStorageCollectionKey;
  entity: StorageEntity;
  canRestoreBackup: boolean;
  canFinishRepair: boolean;
};

type UnknownAppStorageRepairCollectionStatus = AppStorageRepairCollectionBase & {
  known: false;
  collectionKey: null;
  canRestoreBackup: false;
  canFinishRepair: false;
};

export type AppStorageRepairCollectionStatus =
  | KnownAppStorageRepairCollectionStatus
  | UnknownAppStorageRepairCollectionStatus;

export type AppStorageRepairStatusResult = {
  mode: StorageMode;
  status: StorageStatus;
  message: string;
  collections: AppStorageRepairCollectionStatus[];
};

export type AppStorageRepairResult = {
  mode: StorageMode;
  status: StorageStatus;
  message: string;
  collectionKey: AppStorageCollectionKey | null;
  entity: StorageEntity | null;
  strategy: AppStorageRepairStrategy;
  metadata: StorageCollectionMetadata | null;
};

export type AppStorageRepairFinishResult = {
  mode: StorageMode;
  status: StorageStatus;
  message: string;
  collectionKey: AppStorageCollectionKey | null;
  entity: StorageEntity | null;
  metadata: StorageCollectionMetadata | null;
  preRepairRemoved: boolean;
};

const COLLECTION_KEY_BY_ENTITY = new Map<StorageEntity, AppStorageCollectionKey>(
  Object.entries(APP_STORAGE_COLLECTION_ENTITIES).map(
    ([collectionKey, entity]) =>
      [entity, collectionKey as AppStorageCollectionKey] as const,
  ),
);

function asErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error ?? "Unknown storage error.");
}

function normalizeStorageEntity(entity: string): StorageEntity | null {
  return HOST_STORAGE_ENTITIES.includes(entity as StorageEntity)
    ? (entity as StorageEntity)
    : null;
}

function collectionKeyForEntity(
  entity: StorageEntity,
): AppStorageCollectionKey | null {
  return COLLECTION_KEY_BY_ENTITY.get(entity) ?? null;
}

function unknownCollectionLabel(entity: string) {
  return `Unknown collection "${entity}"`;
}

function normalizeMetadata(
  metadata: DesktopStorageCollectionMetadata | null,
): StorageCollectionMetadata | null {
  if (!metadata) return null;

  const entity = normalizeStorageEntity(metadata.entity);
  if (!entity) return null;

  return {
    entity,
    exists: metadata.exists,
    byteLength: metadata.byteLength,
    updatedAtMs: metadata.updatedAtMs,
    contentHash: metadata.contentHash,
  };
}

function normalizeUnknownRepairStatus(
  result: DesktopStorageCollectionMetadataResult,
): UnknownAppStorageRepairCollectionStatus | null {
  const entity = result.entity.trim() || "(missing entity)";
  const visibleProblem =
    result.error ??
    (result.repairable
      ? `${unknownCollectionLabel(entity)} needs repair, but this app version does not know that collection.`
      : result.preRepairExists
        ? `${unknownCollectionLabel(entity)} has a pre-repair sidecar, but this app version cannot finish it.`
        : null);

  if (!visibleProblem) return null;

  return {
    known: false,
    collectionKey: null,
    entity,
    label: unknownCollectionLabel(entity),
    metadata: null,
    error: visibleProblem,
    backupExists: result.backupExists,
    backupRestorable: result.backupRestorable,
    temporaryExists: result.temporaryExists,
    preRepairExists: result.preRepairExists,
    repairable: result.repairable,
    canRestoreBackup: false,
    canFinishRepair: false,
  };
}

function normalizeRepairStatus(
  result: DesktopStorageCollectionMetadataResult,
): AppStorageRepairCollectionStatus | null {
  const entity = normalizeStorageEntity(result.entity);
  if (!entity) return normalizeUnknownRepairStatus(result);

  const collectionKey = collectionKeyForEntity(entity);
  if (!collectionKey) return normalizeUnknownRepairStatus(result);

  const metadata = normalizeMetadata(result.metadata);
  const error = result.error ?? null;
  const repairable = result.repairable;
  const canFinishRepair = result.preRepairExists && error === null;

  if (!error && !canFinishRepair) return null;

  return {
    known: true,
    collectionKey,
    entity,
    label: APP_STORAGE_COLLECTION_LABELS[collectionKey],
    metadata,
    error,
    backupExists: result.backupExists,
    backupRestorable: result.backupRestorable,
    temporaryExists: result.temporaryExists,
    preRepairExists: result.preRepairExists,
    repairable,
    canRestoreBackup: repairable && result.backupRestorable,
    canFinishRepair,
  };
}

function repairUnavailableMessage(mode: StorageMode) {
  return mode === "remote"
    ? "Desktop storage repair is not available for remote runtime targets."
    : "Desktop storage repair is only available inside the Tauri app.";
}

function repairUnavailableResult(
  mode: StorageMode,
): AppStorageRepairStatusResult {
  return {
    mode,
    status: mode === "unavailable" ? "error" : "ready",
    message: repairUnavailableMessage(mode),
    collections: [],
  };
}

export async function loadAppStorageRepairStatus(
  rawUrl?: string,
): Promise<AppStorageRepairStatusResult> {
  const mode = getHostStorageMode(rawUrl);
  if (mode !== "desktop") return repairUnavailableResult(mode);

  try {
    const metadataResults = await readDesktopStorageCollectionMetadata();
    const collections = metadataResults.flatMap((result) => {
      const normalized = normalizeRepairStatus(result);
      return normalized ? [normalized] : [];
    });
    const blockedCount = collections.filter((collection) => collection.error)
      .length;
    const finishCount = collections.filter(
      (collection) => collection.canFinishRepair,
    ).length;

    if (blockedCount > 0) {
      return {
        mode,
        status: "error",
        message: `${blockedCount} stored collection(s) need repair.`,
        collections,
      };
    }

    if (finishCount > 0) {
      return {
        mode,
        status: "ready",
        message: `${finishCount} repaired collection(s) have pre-repair sidecars to finish.`,
        collections,
      };
    }

    return {
      mode,
      status: "ready",
      message: "No desktop collection repair is needed.",
      collections,
    };
  } catch (error) {
    return {
      mode,
      status: "error",
      message: `Desktop storage repair status unavailable. ${asErrorMessage(error)}`,
      collections: [],
    };
  }
}

export async function repairAppStorageCollection({
  entity,
  strategy,
  confirm,
  rawUrl,
}: {
  entity: StorageEntity;
  strategy: AppStorageRepairStrategy;
  confirm: boolean;
  rawUrl?: string;
}): Promise<AppStorageRepairResult> {
  const mode = getHostStorageMode(rawUrl);
  const collectionKey = collectionKeyForEntity(entity);
  if (mode !== "desktop") {
    return {
      mode,
      status: "error",
      message: repairUnavailableMessage(mode),
      collectionKey,
      entity,
      strategy,
      metadata: null,
    };
  }

  try {
    const result = await repairDesktopStorageCollection({
      entity,
      strategy,
      confirm,
    });
    return {
      mode,
      status: "ready",
      message: result.message,
      collectionKey,
      entity,
      strategy,
      metadata: normalizeMetadata(result.metadata),
    };
  } catch (error) {
    return {
      mode,
      status: "error",
      message: asErrorMessage(error),
      collectionKey,
      entity,
      strategy,
      metadata: null,
    };
  }
}

export async function finishAppStorageCollectionRepair({
  entity,
  confirm,
  rawUrl,
}: {
  entity: StorageEntity;
  confirm: boolean;
  rawUrl?: string;
}): Promise<AppStorageRepairFinishResult> {
  const mode = getHostStorageMode(rawUrl);
  const collectionKey = collectionKeyForEntity(entity);
  if (mode !== "desktop") {
    return {
      mode,
      status: "error",
      message: repairUnavailableMessage(mode),
      collectionKey,
      entity,
      metadata: null,
      preRepairRemoved: false,
    };
  }

  try {
    const result = await finishDesktopStorageCollectionRepair({
      entity,
      confirm,
    });
    return {
      mode,
      status: "ready",
      message: result.message,
      collectionKey,
      entity,
      metadata: normalizeMetadata(result.metadata),
      preRepairRemoved: result.preRepairRemoved,
    };
  } catch (error) {
    return {
      mode,
      status: "error",
      message: asErrorMessage(error),
      collectionKey,
      entity,
      metadata: null,
      preRepairRemoved: false,
    };
  }
}
