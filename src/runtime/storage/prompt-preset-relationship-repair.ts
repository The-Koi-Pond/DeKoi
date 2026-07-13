import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelections,
} from "../../engine/contracts/types/prompt-presets";
import {
  normalizePromptPresetThreadChoiceSelectionsWithChange,
  materializePromptPresetThreadChoiceSelections,
  prunePromptPresetThreadChoiceSelections,
} from "../../engine/prompt-presets/prompt-preset-normalization";

type RecordWithPromptPreset = {
  id: string;
  presetId: string | null;
  presetChoiceSelections?: PromptPresetThreadChoiceSelections;
  presetChoiceSelectionsByPresetId?: Record<string, PromptPresetThreadChoiceSelections>;
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

function prunePromptPresetThreadChoiceSelectionHistories(
  histories: Record<string, PromptPresetThreadChoiceSelections>,
  promptPresetsById: ReadonlyMap<string, PromptPresetRecord>,
): {
  histories: Record<string, PromptPresetThreadChoiceSelections>;
  changed: boolean;
} {
  const prunedHistories: Record<string, PromptPresetThreadChoiceSelections> = Object.create(null);
  let changed = false;

  for (const [historyPresetId, historySelections] of Object.entries(histories)) {
    const historyPreset = promptPresetsById.get(historyPresetId);
    if (!historyPreset) {
      prunedHistories[historyPresetId] = historySelections;
      continue;
    }
    const prunedSelections = prunePromptPresetThreadChoiceSelections(
      historyPreset,
      historySelections,
    );
    const materializedSelections = materializePromptPresetThreadChoiceSelections(
      historyPreset,
      historySelections,
    );
    const selections: PromptPresetThreadChoiceSelections = Object.create(null);
    for (const blockId of Object.keys(historySelections)) {
      const repairedSelection = prunedSelections[blockId] ?? materializedSelections[blockId];
      if (repairedSelection) selections[blockId] = repairedSelection;
    }
    if (!choiceSelectionsMatch(selections, historySelections)) {
      changed = true;
    }
    prunedHistories[historyPresetId] = selections;
  }

  return { histories: prunedHistories, changed };
}

/** Clears orphaned selections while retaining normalization-change metadata. */
function normalizePromptPresetThreadChoiceSelectionsForPreset(
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

/** Normalizes persisted per-preset histories and migrates a present legacy selection field. */
export function normalizePromptPresetThreadChoiceSelectionHistories({
  presetId,
  histories,
  hasLegacySelections,
  legacySelections,
}: {
  presetId: string | null;
  histories: unknown;
  hasLegacySelections: boolean;
  legacySelections: unknown;
}): {
  histories: Record<string, PromptPresetThreadChoiceSelections>;
  changed: boolean;
} {
  const normalizedHistories: Record<string, PromptPresetThreadChoiceSelections> =
    Object.create(null);
  let changed =
    histories !== undefined && (typeof histories !== "object" || Array.isArray(histories));

  if (histories && typeof histories === "object" && !Array.isArray(histories)) {
    for (const [historyPresetId, selections] of Object.entries(histories)) {
      const normalized = normalizePromptPresetThreadChoiceSelectionsWithChange(selections);
      normalizedHistories[historyPresetId] = normalized.selections;
      changed ||= normalized.changed;
    }
  }

  if (presetId && hasLegacySelections) {
    const normalizedLegacy = normalizePromptPresetThreadChoiceSelectionsForPreset(
      presetId,
      legacySelections ?? {},
    );
    normalizedHistories[presetId] = {
      ...normalizedLegacy.selections,
      ...normalizedHistories[presetId],
    };
    changed ||= normalizedLegacy.changed;
  }

  return {
    histories: normalizedHistories,
    changed: changed || hasLegacySelections,
  };
}

/** Separately counts missing-preset repairs and stale choice-selection repairs. */
export function repairPromptPresetRelationships<T extends RecordWithPromptPreset>(
  records: readonly T[],
  promptPresets: readonly PromptPresetRecord[],
  normalizedChoiceSelectionRecordIds: ReadonlySet<string> = new Set(),
  fallbackPresetId: string | null = null,
): {
  records: T[];
  clearedPresetReferenceCount: number;
  repairedChoiceSelectionCount: number;
} {
  const promptPresetsById = new Map(promptPresets.map((preset) => [preset.id, preset] as const));
  let clearedPresetReferenceCount = 0;
  let repairedChoiceSelectionCount = 0;

  const repairedRecords = records.map((record) => {
    const histories = record.presetChoiceSelectionsByPresetId ?? {};
    const effectiveHistories =
      Object.keys(histories).length > 0
        ? histories
        : record.presetId && record.presetChoiceSelections
          ? { [record.presetId]: record.presetChoiceSelections }
          : histories;
    const pruned = prunePromptPresetThreadChoiceSelectionHistories(
      effectiveHistories,
      promptPresetsById,
    );
    if (!record.presetId) {
      if (normalizedChoiceSelectionRecordIds.has(record.id) || pruned.changed) {
        repairedChoiceSelectionCount += 1;
        return { ...record, presetChoiceSelectionsByPresetId: pruned.histories };
      }
      return record;
    }
    const preset = promptPresetsById.get(record.presetId);
    if (preset) {
      if (!normalizedChoiceSelectionRecordIds.has(record.id) && !pruned.changed) {
        return record;
      }
      repairedChoiceSelectionCount += 1;
      return { ...record, presetChoiceSelectionsByPresetId: pruned.histories };
    }

    clearedPresetReferenceCount += 1;
    return {
      ...record,
      presetId: fallbackPresetId,
      presetChoiceSelectionsByPresetId: effectiveHistories,
    };
  });

  return {
    records: repairedRecords,
    clearedPresetReferenceCount,
    repairedChoiceSelectionCount,
  };
}
