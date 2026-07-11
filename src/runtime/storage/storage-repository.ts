import type { StorageEntity } from "./storage-entities";

export type StorageMode = "desktop" | "remote" | "unavailable";
export type StorageStatus = "ready" | "error";

export type StorageCollectionMetadata = {
  entity: StorageEntity;
  exists: boolean;
  byteLength: number | null;
  updatedAtMs: number | null;
  contentHash: string | null;
};

export type StorageResult = {
  mode: StorageMode;
  status: StorageStatus;
  message: string;
  metadata?: StorageCollectionMetadata | null;
};

export function mergeStorageResults<T extends StorageResult>(results: readonly T[]): T {
  const fallback = results[0];
  if (!fallback) {
    throw new Error("Cannot merge an empty storage result list.");
  }

  return (
    results.find((result) => result.status === "error") ??
    results.find((result) => result.mode !== "unavailable") ??
    fallback
  );
}

export type StorageRecord = { id: string };

/**
 * Structured normalizer result for collection adapters that need to keep a
 * parent record while counting nested records rejected during load.
 */
export type StorageRecordNormalization<T extends StorageRecord> = {
  record: T | null;
  /** Additional rejected records represented by this raw value. */
  droppedRecordCount?: number;
  normalizationChanged?: boolean;
};

export type StorageRecordNormalizerResult<T extends StorageRecord> =
  T | null | StorageRecordNormalization<T>;

/**
 * Converts one raw collection item into a durable record, or null when the raw
 * item must be skipped. Returning a structured result can add dropped counts
 * for nested legacy records while still accepting the parent item.
 */
export type StorageRecordNormalizer<T extends StorageRecord> = (
  value: unknown,
) => StorageRecordNormalizerResult<T>;

function isStorageRecordNormalization<T extends StorageRecord>(
  result: StorageRecordNormalizerResult<T>,
): result is StorageRecordNormalization<T> {
  return (
    result !== null &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    !("id" in result) &&
    "record" in result
  );
}

/**
 * Collapses legacy normalizer results and structured results into one shape for
 * host-backed load/save paths.
 */
export function normalizeStorageRecordResult<T extends StorageRecord>(
  result: StorageRecordNormalizerResult<T>,
): { record: T | null; droppedRecordCount: number; normalizationChanged: boolean } {
  if (isStorageRecordNormalization(result)) {
    const droppedRecordCount = result.droppedRecordCount ?? 0;
    return {
      record: result.record,
      droppedRecordCount: droppedRecordCount > 0 ? Math.floor(droppedRecordCount) : 0,
      normalizationChanged: result.normalizationChanged === true,
    };
  }

  return { record: result, droppedRecordCount: 0, normalizationChanged: false };
}

export type StorageRecordsSnapshot<T extends StorageRecord> = {
  records: T[];
  /**
   * Number of raw records that were present on disk but rejected by the
   * collection normalizer during load, plus any nested rejected records counted
   * by a structured normalizer result. These records are NOT in `records`; if
   * the collection is saved again they will be permanently lost. Surfaces a
   * warning so the loss is not silent (mirrors the corrupt-file philosophy).
   */
  droppedRecordCount: number;
  normalizationChangedRecordIds: string[];
} & StorageResult;

export interface StorageCollectionRepository<T extends StorageRecord> {
  load: (rawUrl?: string) => Promise<T[]>;
  loadSnapshot: (rawUrl?: string) => Promise<StorageRecordsSnapshot<T>>;
  replace: (records: T[], rawUrl?: string) => Promise<StorageResult>;
  save: (records: T[], rawUrl?: string) => Promise<StorageResult>;
}

export interface StorageRepositoryInput<T extends StorageRecord> {
  entity: StorageEntity;
  normalizeRecord: StorageRecordNormalizer<T>;
  /** Returned only when host storage cannot be loaded; successful empty collections stay empty. */
  seedRecords: T[];
}
