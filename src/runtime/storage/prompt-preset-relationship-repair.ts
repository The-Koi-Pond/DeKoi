import type { PromptPresetRecord } from "../../engine/contracts/types/prompt-presets";

type RecordWithPromptPreset = {
  presetId: string | null;
};

export function clearMissingPromptPresetIds<T extends RecordWithPromptPreset>(
  records: readonly T[],
  promptPresets: readonly PromptPresetRecord[],
): { records: T[]; clearedCount: number } {
  const promptPresetIds = new Set(promptPresets.map((preset) => preset.id));
  let clearedCount = 0;

  const repairedRecords = records.map((record) => {
    if (!record.presetId || promptPresetIds.has(record.presetId)) return record;

    clearedCount += 1;
    return {
      ...record,
      presetId: null,
    };
  });

  return {
    records: repairedRecords,
    clearedCount,
  };
}
