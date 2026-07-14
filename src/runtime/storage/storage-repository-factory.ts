import { createHostStorageRepository, loadHostStorageMetadata } from "./host-storage";
import type {
  StorageCollectionRepository,
  StorageRecord,
  StorageRepositoryInput,
} from "./storage-repository";
import type { StorageMode } from "./storage-repository";

export { getHostStorageMode } from "./host-storage";
export { loadHostStorageMetadata };
export type { StorageMode };

export function createStorageRepository<T extends StorageRecord>(
  input: StorageRepositoryInput<T>,
): StorageCollectionRepository<T> {
  return createHostStorageRepository(input);
}
