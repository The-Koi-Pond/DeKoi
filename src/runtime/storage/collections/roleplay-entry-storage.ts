import type { RoleplayThread } from "../../../engine/contracts/types/roleplay";
import { extractRoleplayEntries } from "../../../engine/contracts/types/roleplay";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";
import { normalizeRoleplayEntryRecord } from "./roleplay-storage";

const roleplayEntryRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.roleplayEntries,
  normalizeRecord: normalizeRoleplayEntryRecord,
  seedRecords: [],
});

export function loadRoleplayEntriesFromStorage(rawUrl?: string) {
  return roleplayEntryRepository.loadSnapshot(rawUrl);
}

export function saveRoleplayEntriesToStorage(threads: RoleplayThread[], rawUrl?: string) {
  return roleplayEntryRepository.save(extractRoleplayEntries(threads), rawUrl);
}
