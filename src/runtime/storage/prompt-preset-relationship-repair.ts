import type {
  PromptPresetChoiceSelections,
  PromptPresetRecord,
} from "../../engine/contracts/types/prompt-presets";

type RecordWithPromptPreset = {
  presetId: string | null;
  presetChoiceSelections?: PromptPresetChoiceSelections;
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
      presetChoiceSelections: {},
    };
  });

  return {
    records: repairedRecords,
    clearedCount,
  };
}
