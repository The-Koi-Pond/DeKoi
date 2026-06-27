import type { StorageEntity } from "./storage-entities";

export type StorageMode = "desktop" | "remote" | "unavailable";
export type StorageStatus = "ready" | "error";

export type StorageResult = {
  mode: StorageMode;
  status: StorageStatus;
  message: string;
};

export function mergeStorageResults<T extends StorageResult>(
  results: readonly T[],
): T {
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

export type StorageRecordNormalizer<T extends StorageRecord> = (
  value: unknown,
) => T | null;

export type StorageRecordsSnapshot<T extends StorageRecord> = {
  records: T[];
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
  seedRecords: T[];
}
