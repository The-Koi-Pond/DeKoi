import type { ModeThread } from "../../../engine/contracts/types/mode-thread";
import { assertValidModeThread } from "../../../engine/modes/mode-thread/mode-thread-validation";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";
import type { StorageRecordNormalization } from "../storage-repository";
import { normalizePromptPresetThreadChoiceSelectionHistories } from "../prompt-preset-relationship-repair";
import {
  toModeThreadStorageRecord,
  type ModeThreadStorageRecord,
} from "../app-storage-collection-projection";

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function normalizeModeThreadRecord(value: unknown): ModeThreadStorageRecord | null {
  return normalizeModeThreadRecordWithChange(value)?.record ?? null;
}

export function normalizeModeThreadRecordWithChange(
  value: unknown,
): { record: ModeThreadStorageRecord; changed: boolean } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const id = clean(raw.id);
  const title = clean(raw.title);
  if (
    !id ||
    !title ||
    "messages" in raw ||
    !Array.isArray(raw.branches) ||
    raw.branches.length === 0 ||
    raw.branches.some((branch) => !branch || typeof branch !== "object" || Array.isArray(branch))
  ) {
    return null;
  }
  let changed = false;
  const branches = (raw.branches as Record<string, unknown>[]).map((branch) => {
    const histories = normalizePromptPresetThreadChoiceSelectionHistories({
      presetId: typeof branch.presetId === "string" ? branch.presetId : null,
      histories: branch.presetChoiceSelectionsByPresetId,
      hasLegacySelections: false,
      legacySelections: undefined,
    });
    changed ||= histories.changed;
    return {
      ...branch,
      id: clean(branch.id),
      threadId: clean(branch.threadId),
      characterIds: Array.isArray(branch.characterIds)
        ? branch.characterIds.map(clean)
        : branch.characterIds,
      lorebookIds: Array.isArray(branch.lorebookIds)
        ? branch.lorebookIds.map(clean)
        : branch.lorebookIds,
      presetChoiceSelectionsByPresetId: histories.histories,
    };
  });
  if (branches.some((branch) => !branch.id)) return null;
  const activeBranchId = clean(raw.activeBranchId) || branches[0].id;
  const record = {
    ...raw,
    id,
    title,
    branches,
    activeBranchId,
    messages: [],
  } as unknown as ModeThread;
  try {
    assertValidModeThread(record);
  } catch {
    return null;
  }
  return { record: toModeThreadStorageRecord(record), changed };
}

function normalize(value: unknown): StorageRecordNormalization<ModeThreadStorageRecord> | null {
  const normalized = normalizeModeThreadRecordWithChange(value);
  return normalized
    ? { record: normalized.record, normalizationChanged: normalized.changed }
    : null;
}

const repository = createStorageRepository({
  entity: STORAGE_ENTITIES.modeThreads,
  normalizeRecord: normalize,
  seedRecords: [],
});
export const loadModeThreadsFromStorage = (rawUrl?: string) => repository.loadSnapshot(rawUrl);
export const saveModeThreadsToStorage = (threads: ModeThread[], rawUrl?: string) =>
  repository.save(threads.map(toModeThreadStorageRecord), rawUrl);
