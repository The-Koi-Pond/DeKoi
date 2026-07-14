import type { ModeMessage } from "../../../engine/contracts/types/mode-thread";
import { validateModeMessage } from "../../../engine/modes/mode-thread/mode-thread-validation";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";

export function normalizeModeMessageRecord(value: unknown): ModeMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const threadId = typeof raw.threadId === "string" ? raw.threadId.trim() : "";
  const branchId = typeof raw.branchId === "string" ? raw.branchId.trim() : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!threadId || !branchId || !id) return null;
  const versions: unknown = Array.isArray(raw.versions)
    ? raw.versions.map((version) => ({
        ...version,
        id: typeof version?.id === "string" ? version.id.trim() : version?.id,
      }))
    : raw.versions;
  const firstVersionId =
    Array.isArray(versions) && typeof versions[0]?.id === "string" ? versions[0].id : undefined;
  const record = {
    ...raw,
    id,
    threadId,
    branchId,
    activeVersionId:
      typeof raw.activeVersionId === "string" && raw.activeVersionId.trim()
        ? raw.activeVersionId.trim()
        : firstVersionId,
    versions,
  };
  try {
    validateModeMessage(record, threadId, new Set([branchId]));
  } catch {
    return null;
  }
  return record as ModeMessage;
}

const repository = createStorageRepository({
  entity: STORAGE_ENTITIES.modeMessages,
  normalizeRecord: normalizeModeMessageRecord,
  seedRecords: [],
});
export const loadModeMessagesFromStorage = (rawUrl?: string) => repository.loadSnapshot(rawUrl);
export const saveModeMessagesToStorage = (messages: ModeMessage[], rawUrl?: string) =>
  repository.save(messages, rawUrl);
