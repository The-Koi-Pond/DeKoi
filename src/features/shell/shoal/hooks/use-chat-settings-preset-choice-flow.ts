import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelections,
} from "../../../../engine/contracts/types/prompt-presets";
import { projectPresetChoiceState, type PresetChoiceProjection } from "../../../modes";

interface UseChatSettingsPresetChoiceFlowInput {
  threadId: string | null | undefined;
  selectedPresetId: string | null | undefined;
  promptPresets: readonly PromptPresetRecord[];
  history: Record<string, PromptPresetThreadChoiceSelections> | null | undefined;
  onPresetChange: (presetId: string) => void;
  onPresetConfirm?: (presetId: string, selections: PromptPresetThreadChoiceSelections) => void;
}

export function useChatSettingsPresetChoiceFlow({
  threadId,
  selectedPresetId,
  promptPresets,
  history,
  onPresetChange,
  onPresetConfirm,
}: UseChatSettingsPresetChoiceFlowInput) {
  const [pendingDialogPresetId, setPendingDialogPresetId] = useState<string | null>(null);
  const [dismissedAutoPresetKey, setDismissedAutoPresetKey] = useState<string | null>(null);
  const [repairNoticeVisible, setRepairNoticeVisible] = useState(false);
  const repairedKeys = useRef(new Set<string>());
  const selectedPreset = useMemo(
    () => promptPresets.find((preset) => preset.id === selectedPresetId) ?? null,
    [promptPresets, selectedPresetId],
  );
  const selectedProjection = useMemo(
    () => projectPresetChoiceState(selectedPreset, history),
    [history, selectedPreset],
  );
  const selectedPresetKey = selectedPreset ? `${threadId ?? ""}:${selectedPreset.id}` : null;
  const autoDialogPresetId =
    selectedPreset &&
    selectedPresetKey !== dismissedAutoPresetKey &&
    !selectedProjection.hasHistory &&
    selectedProjection.controls.length > 0
      ? selectedPreset.id
      : null;
  const dialogPresetId = pendingDialogPresetId ?? autoDialogPresetId;
  const dialogPreset = dialogPresetId
    ? (promptPresets.find((preset) => preset.id === dialogPresetId) ?? null)
    : null;

  const selectionsForPreset = useCallback(
    (presetId: string): PromptPresetThreadChoiceSelections => history?.[presetId] ?? {},
    [history],
  );

  const repair = useCallback(
    (preset: PromptPresetRecord, projection: PresetChoiceProjection, key: string) => {
      if (repairedKeys.current.has(key)) return;
      repairedKeys.current.add(key);
      onPresetConfirm?.(preset.id, projection.materializedSelections);
      setRepairNoticeVisible(true);
    },
    [onPresetConfirm],
  );

  useEffect(() => {
    if (!selectedPreset || selectedProjection.hasHistory || selectedProjection.controls.length > 0)
      return;
    const key = `${threadId ?? ""}:${selectedPreset.id}:empty`;
    if (repairedKeys.current.has(key)) return;
    repairedKeys.current.add(key);
    onPresetConfirm?.(selectedPreset.id, {});
  }, [onPresetConfirm, selectedPreset, selectedProjection, threadId]);

  useEffect(() => {
    if (!repairNoticeVisible) return;
    const timeout = window.setTimeout(() => setRepairNoticeVisible(false), 5_000);
    return () => window.clearTimeout(timeout);
  }, [repairNoticeVisible]);

  const openVariables = useCallback(
    (presetId: string) => {
      const preset = promptPresets.find((candidate) => candidate.id === presetId);
      if (!preset) return;
      const projection = projectPresetChoiceState(preset, history);
      if (projection.controls.length === 0) {
        onPresetConfirm?.(preset.id, {});
        return;
      }
      setPendingDialogPresetId(preset.id);
    },
    [history, onPresetConfirm, promptPresets],
  );

  const selectPreset = useCallback(
    (preset: PromptPresetRecord) => {
      const projection = projectPresetChoiceState(preset, history);
      if (projection.controls.length === 0) {
        onPresetConfirm?.(preset.id, {});
        return;
      }
      if (projection.hasHistory) {
        if (projection.repairReason === "invalid-history") {
          repair(preset, projection, `${threadId ?? ""}:${preset.id}:${projection.fingerprint}`);
        } else {
          onPresetChange(preset.id);
        }
        return;
      }
      setPendingDialogPresetId(preset.id);
    },
    [history, onPresetChange, onPresetConfirm, repair, threadId],
  );

  const closeVariables = useCallback(() => {
    if (!pendingDialogPresetId && autoDialogPresetId && selectedPresetKey) {
      setDismissedAutoPresetKey(selectedPresetKey);
    }
    setPendingDialogPresetId(null);
  }, [autoDialogPresetId, pendingDialogPresetId, selectedPresetKey]);

  return {
    selectedPreset,
    dialogPreset,
    repairNoticeVisible,
    selectionsForPreset,
    openVariables,
    closeVariables,
    selectPreset,
  };
}
