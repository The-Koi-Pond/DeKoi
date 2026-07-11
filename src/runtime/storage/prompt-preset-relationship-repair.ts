import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelections,
} from "../../engine/contracts/types/prompt-presets";
import {
  normalizePromptPresetThreadChoiceSelectionsWithChange,
  prunePromptPresetThreadChoiceSelections,
} from "../../engine/prompt-presets/prompt-preset-normalization";

type RecordWithPromptPreset = {
  id: string;
  presetId: string | null;
  presetChoiceSelections?: PromptPresetThreadChoiceSelections;
};

function choiceSelectionMatches(
  left: PromptPresetThreadChoiceSelections[string],
  right: PromptPresetThreadChoiceSelections[string],
) {
  const leftIsArray = Array.isArray(left);
  if (leftIsArray !== Array.isArray(right)) return false;
  const leftSelections = leftIsArray ? left : [left];
  const rightSelections = Array.isArray(right) ? right : [right];
  return (
    leftSelections.length === rightSelections.length &&
    leftSelections.every(
      (selection, index) =>
        selection.kind === rightSelections[index]?.kind &&
        selection.optionId === rightSelections[index]?.optionId,
    )
  );
}

function choiceSelectionsMatch(
  left: PromptPresetThreadChoiceSelections,
  right: PromptPresetThreadChoiceSelections,
) {
  const leftBlockIds = Object.keys(left);
  const rightBlockIds = Object.keys(right);
  return (
    leftBlockIds.length === rightBlockIds.length &&
    leftBlockIds.every(
      (blockId) =>
        Object.prototype.hasOwnProperty.call(right, blockId) &&
        choiceSelectionMatches(left[blockId]!, right[blockId]!),
    )
  );
}

/** Clears orphaned selections while retaining normalization-change metadata. */
export function normalizePromptPresetThreadChoiceSelectionsForPreset(
  presetId: string | null,
  value: unknown,
): {
  selections: PromptPresetThreadChoiceSelections;
  changed: boolean;
} {
  const normalized = normalizePromptPresetThreadChoiceSelectionsWithChange(value);
  if (presetId) return normalized;

  return {
    selections: {},
    changed: normalized.changed || Object.keys(normalized.selections).length > 0,
  };
}

/** Separately counts missing-preset repairs and stale choice-selection repairs. */
export function repairPromptPresetRelationships<T extends RecordWithPromptPreset>(
  records: readonly T[],
  promptPresets: readonly PromptPresetRecord[],
  normalizedChoiceSelectionRecordIds: ReadonlySet<string> = new Set(),
): {
  records: T[];
  clearedPresetReferenceCount: number;
  repairedChoiceSelectionCount: number;
} {
  const promptPresetsById = new Map(promptPresets.map((preset) => [preset.id, preset] as const));
  let clearedPresetReferenceCount = 0;
  let repairedChoiceSelectionCount = 0;

  const repairedRecords = records.map((record) => {
    if (!record.presetId) {
      if (normalizedChoiceSelectionRecordIds.has(record.id)) {
        repairedChoiceSelectionCount += 1;
      }
      return record;
    }
    const preset = promptPresetsById.get(record.presetId);
    if (preset) {
      const choicesWereNormalized = normalizedChoiceSelectionRecordIds.has(record.id);
      const selections = prunePromptPresetThreadChoiceSelections(
        preset,
        record.presetChoiceSelections,
      );
      const choicesWerePruned = !choiceSelectionsMatch(
        selections,
        record.presetChoiceSelections ?? {},
      );
      if (!choicesWereNormalized && !choicesWerePruned) {
        return record;
      }
      repairedChoiceSelectionCount += 1;
      return choicesWerePruned ? { ...record, presetChoiceSelections: selections } : record;
    }

    clearedPresetReferenceCount += 1;
    return {
      ...record,
      presetId: null,
      presetChoiceSelections: {},
    };
  });

  return {
    records: repairedRecords,
    clearedPresetReferenceCount,
    repairedChoiceSelectionCount,
  };
}
