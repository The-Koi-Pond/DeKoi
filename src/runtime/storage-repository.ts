import type { HostStorageEntity } from "./storage-entities";

export type StorageMode = "desktop" | "remote" | "unavailable";
export type StorageStatus = "ready" | "error";

export type StorageResult = {
  mode: StorageMode;
  status: StorageStatus;
  message: string;
};

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
  save: (records: T[], rawUrl?: string) => Promise<StorageResult>;
}

export interface StorageRepositoryInput<T extends StorageRecord> {
  entity: HostStorageEntity;
  normalizeRecord: StorageRecordNormalizer<T>;
  seedRecords: T[];
}
