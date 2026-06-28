import {
  HOST_STORAGE_UNAVAILABLE_MESSAGE,
  createHostStorageRepository,
  loadHostStorageMetadata,
} from "./host-storage";
import type {
  StorageCollectionRepository,
  StorageRecord,
  StorageRepositoryInput,
} from "./storage-repository";
import type {
  StorageCollectionMetadata,
  StorageMode,
  StorageResult,
  StorageStatus,
} from "./storage-repository";

export { getHostStorageMode } from "./host-storage";
export { loadHostStorageMetadata };
export { HOST_STORAGE_UNAVAILABLE_MESSAGE };
export type {
  StorageCollectionMetadata,
  StorageMode,
  StorageResult,
  StorageStatus,
};

export function createStorageRepository<T extends StorageRecord>(
  input: StorageRepositoryInput<T>,
): StorageCollectionRepository<T> {
  return createHostStorageRepository(input);
}
