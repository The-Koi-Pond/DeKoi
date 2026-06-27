import {
  HOST_STORAGE_UNAVAILABLE_MESSAGE,
  createHostStorageRepository,
} from "./host-storage";
import type {
  StorageCollectionRepository,
  StorageRecord,
  StorageRepositoryInput,
} from "./storage-repository";
import type { StorageMode, StorageResult, StorageStatus } from "./storage-repository";

export { getHostStorageMode } from "./host-storage";
export { HOST_STORAGE_UNAVAILABLE_MESSAGE };
export type {
  StorageMode,
  StorageResult,
  StorageStatus,
};

export function createStorageRepository<T extends StorageRecord>(
  input: StorageRepositoryInput<T>,
): StorageCollectionRepository<T> {
  return createHostStorageRepository(input);
}
