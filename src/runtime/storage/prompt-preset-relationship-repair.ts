import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelections,
} from "../../engine/contracts/types/prompt-presets";
import { prunePromptPresetThreadChoiceSelections } from "../../engine/prompt-presets/prompt-preset-normalization";

type RecordWithPromptPreset = {
  presetId: string | null;
  presetChoiceSelections?: PromptPresetThreadChoiceSelections;
};

export function clearMissingPromptPresetIds<T extends RecordWithPromptPreset>(
  records: readonly T[],
  promptPresets: readonly PromptPresetRecord[],
): { records: T[]; clearedCount: number } {
  const promptPresetsById = new Map(promptPresets.map((preset) => [preset.id, preset] as const));
  let clearedCount = 0;

  const repairedRecords = records.map((record) => {
    if (!record.presetId) return record;
    const preset = promptPresetsById.get(record.presetId);
    if (preset) {
      const selections = prunePromptPresetThreadChoiceSelections(
        preset,
        record.presetChoiceSelections,
      );
      if (JSON.stringify(selections) === JSON.stringify(record.presetChoiceSelections ?? {})) {
        return record;
      }
      clearedCount += 1;
      return { ...record, presetChoiceSelections: selections };
    }

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
