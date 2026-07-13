import { useCallback } from "react";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import {
  createImportedPromptPresetRecord,
  createPromptPresetRecord,
  duplicatePromptPresetRecord,
  updatePromptPresetRecord,
  type PromptPresetInput,
} from "../../../engine/prompt-presets/prompt-preset-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";
import type {
  PromptPresetRelationshipMutation,
  PromptPresetRelationshipTransactionResult,
} from "../../../engine/prompt-presets/prompt-preset-relationship-actions";

type UsePromptPresetActionsInput = {
  promptPresets: PromptPresetRecord[];
  setPromptPresets: StateSetter<PromptPresetRecord[]>;
  runPromptPresetRelationshipMutation: (
    mutation: PromptPresetRelationshipMutation,
  ) => Promise<PromptPresetRelationshipTransactionResult>;
};

export function usePromptPresetActions({
  promptPresets,
  setPromptPresets,
  runPromptPresetRelationshipMutation,
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
    async (presetId: string): Promise<PromptPresetRelationshipTransactionResult> => {
      const now = currentIsoTimestamp();
      return runPromptPresetRelationshipMutation({ kind: "delete", presetId, updatedAt: now });
    },
    [runPromptPresetRelationshipMutation],
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
