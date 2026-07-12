import { useCallback } from "react";
import type { MessengerThread } from "../../../engine/contracts/types/messenger";
import { removeMessengerThreadPreset } from "../../../engine/modes/messenger/messenger-actions";
import type { RoleplayThread } from "../../../engine/contracts/types/roleplay";
import { removeRoleplayThreadPreset } from "../../../engine/modes/roleplay/roleplay-actions";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import {
  createImportedPromptPresetRecord,
  createPromptPresetRecord,
  deletePromptPresetRecord,
  duplicatePromptPresetRecord,
  updatePromptPresetRecord,
  type PromptPresetInput,
} from "../../../engine/prompt-presets/prompt-preset-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";

type UsePromptPresetActionsInput = {
  promptPresets: PromptPresetRecord[];
  setPromptPresets: StateSetter<PromptPresetRecord[]>;
  setRoleplayThreads: StateSetter<RoleplayThread[]>;
  setMessengerThreads: StateSetter<MessengerThread[]>;
};

export function usePromptPresetActions({
  promptPresets,
  setPromptPresets,
  setRoleplayThreads,
  setMessengerThreads,
}: UsePromptPresetActionsInput) {
  const createPromptPreset = useCallback(
    (input: PromptPresetInput) => {
      const now = currentIsoTimestamp();
      const preset = createPromptPresetRecord({
        id: createRecordId("prompt-preset"),
        input,
        now,
      });
      setPromptPresets((currentPresets) => [preset, ...currentPresets]);
      return preset;
    },
    [setPromptPresets],
  );

  const updatePromptPreset = useCallback(
    (presetId: string, input: PromptPresetInput) => {
      const now = currentIsoTimestamp();
      setPromptPresets((currentPresets) =>
        currentPresets.map((preset) =>
          preset.id === presetId ? updatePromptPresetRecord(preset, input, now) : preset,
        ),
      );
    },
    [setPromptPresets],
  );

  const duplicatePromptPreset = useCallback(
    (presetId: string) => {
      const preset = promptPresets.find((currentPreset) => currentPreset.id === presetId);
      if (!preset) return null;

      const now = currentIsoTimestamp();
      const duplicatedPreset = duplicatePromptPresetRecord(
        preset,
        createRecordId("prompt-preset"),
        now,
      );
      setPromptPresets((currentPresets) => [duplicatedPreset, ...currentPresets]);
      return duplicatedPreset;
    },
    [promptPresets, setPromptPresets],
  );

  const prepareImportedPromptPreset = useCallback((record: PromptPresetRecord) => {
    const now = currentIsoTimestamp();
    return createImportedPromptPresetRecord(record, createRecordId("prompt-preset"), now);
  }, []);

  const addImportedPromptPreset = useCallback(
    (record: PromptPresetRecord) => {
      setPromptPresets((currentPresets) => [record, ...currentPresets]);
      return record;
    },
    [setPromptPresets],
  );

  const deletePromptPreset = useCallback(
    (presetId: string) => {
      const now = currentIsoTimestamp();
      setPromptPresets((currentPresets) => deletePromptPresetRecord(currentPresets, presetId));
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) => removeMessengerThreadPreset(thread, presetId, now)),
      );
      setRoleplayThreads((currentThreads) =>
        currentThreads.map((thread) => removeRoleplayThreadPreset(thread, presetId, now)),
      );
    },
    [setPromptPresets, setMessengerThreads, setRoleplayThreads],
  );

  return {
    createPromptPreset,
    updatePromptPreset,
    duplicatePromptPreset,
    prepareImportedPromptPreset,
    addImportedPromptPreset,
    deletePromptPreset,
  };
}
