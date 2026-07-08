import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import { normalizePromptPresetSampling } from "../../../engine/prompt-presets/prompt-preset-actions";
import { STARTER_PROMPT_PRESET } from "../../../engine/prompt-presets/starter-preset";
import { isRecord, readNullableString, readString, readTimestamp } from "../storage-json";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";

export function normalizePromptPresetRecord(value: unknown): PromptPresetRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;

  const id = readString(value.id).trim();
  const systemPrompt = readString(value.systemPrompt).trim();
  if (!id || !systemPrompt) return null;

  const now = new Date().toISOString();
  const title = readString(value.title).trim() || "Untitled preset";
  const sampling = normalizePromptPresetSampling(isRecord(value.sampling) ? value.sampling : null);

  return {
    id,
    schemaVersion: 1,
    title,
    summary: readNullableString(value.summary),
    systemPrompt,
    sampling,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadPromptPresetRecords() {
  return [STARTER_PROMPT_PRESET];
}

const promptPresetRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.promptPresets,
  normalizeRecord: normalizePromptPresetRecord,
  seedRecords: [STARTER_PROMPT_PRESET],
});

export function loadPromptPresetRecordsFromStorage(rawUrl?: string) {
  return promptPresetRepository.loadSnapshot(rawUrl);
}

export function savePromptPresetRecordsToStorage(records: PromptPresetRecord[], rawUrl?: string) {
  return promptPresetRepository.save(records, rawUrl);
}
