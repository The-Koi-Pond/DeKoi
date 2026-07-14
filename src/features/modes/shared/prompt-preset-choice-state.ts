import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelections,
} from "../../../engine/contracts/types/prompt-presets";
import {
  materializePromptPresetThreadChoiceSelections,
  resolvePromptPresetChoiceControls,
  type PromptPresetChoiceControl,
} from "../../../engine/prompt-presets/prompt-preset-actions";

export interface PresetChoiceProjection {
  hasHistory: boolean;
  storedSelections: PromptPresetThreadChoiceSelections;
  controls: PromptPresetChoiceControl[];
  materializedSelections: PromptPresetThreadChoiceSelections;
  needsRepair: boolean;
  fingerprint: string;
}

function selectionsEqual(
  left: PromptPresetThreadChoiceSelections,
  right: PromptPresetThreadChoiceSelections,
): boolean {
  const canonicalize = (_key: string, value: unknown): unknown => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).sort(([leftKey], [rightKey]) =>
        leftKey.localeCompare(rightKey),
      ),
    );
  };
  return JSON.stringify(left, canonicalize) === JSON.stringify(right, canonicalize);
}

/** Projects one preset and its durable thread history without changing either value. */
export function projectPresetChoiceState(
  preset: PromptPresetRecord | null | undefined,
  history: Record<string, PromptPresetThreadChoiceSelections> | null | undefined,
): PresetChoiceProjection {
  if (!preset) {
    return {
      hasHistory: false,
      storedSelections: {},
      controls: [],
      materializedSelections: {},
      needsRepair: false,
      fingerprint: "{}",
    };
  }

  const source = history ?? {};
  const hasHistory = Object.prototype.hasOwnProperty.call(source, preset.id);
  const storedSelections = source[preset.id] ?? {};
  const controls = resolvePromptPresetChoiceControls({ preset, selections: storedSelections });
  const materializedSelections = materializePromptPresetThreadChoiceSelections(
    preset,
    storedSelections,
  );
  const fingerprint = JSON.stringify(storedSelections);

  return {
    hasHistory,
    storedSelections,
    controls,
    materializedSelections,
    needsRepair: hasHistory && !selectionsEqual(storedSelections, materializedSelections),
    fingerprint,
  };
}
