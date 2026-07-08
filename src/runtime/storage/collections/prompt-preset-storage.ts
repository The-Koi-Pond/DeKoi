import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import { normalizePromptPresetRecord } from "../../../engine/prompt-presets/prompt-preset-actions";
import { STARTER_PROMPT_PRESET } from "../../../engine/prompt-presets/starter-preset";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";

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
