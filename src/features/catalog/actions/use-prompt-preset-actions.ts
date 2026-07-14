import { useCallback } from "react";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import {
  createImportedPromptPresetRecord,
  duplicatePromptPresetRecord,
  type PromptPresetInput,
} from "../../../engine/prompt-presets/prompt-preset-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";
import type {
  PromptPresetRelationshipMutation,
  PromptPresetRelationshipTransactionResult,
} from "../../../engine/prompt-presets/prompt-preset-relationship-actions";
import type {
  PromptPresetCatalogMutation,
  PromptPresetCatalogTransactionResult,
} from "../../navigation";

type UsePromptPresetActionsInput = {
  promptPresets: PromptPresetRecord[];
  setPromptPresets: StateSetter<PromptPresetRecord[]>;
  runPromptPresetCatalogMutation: (
    mutation: PromptPresetCatalogMutation,
  ) => Promise<PromptPresetCatalogTransactionResult>;
  runPromptPresetRelationshipMutation: (
    mutation: PromptPresetRelationshipMutation,
  ) => Promise<PromptPresetRelationshipTransactionResult>;
};

export function usePromptPresetActions({
  promptPresets,
  setPromptPresets,
  runPromptPresetRelationshipMutation,
  runPromptPresetCatalogMutation,
}: UsePromptPresetActionsInput) {
  const createPromptPreset = useCallback(
    async (input: PromptPresetInput) => {
      const now = currentIsoTimestamp();
      return runPromptPresetCatalogMutation({
        kind: "create",
        id: createRecordId("prompt-preset"),
        now,
        input,
      });
    },
    [runPromptPresetCatalogMutation],
  );

  const restoreStarterPromptPreset = useCallback(async () => {
    const now = currentIsoTimestamp();
    return runPromptPresetCatalogMutation({
      kind: "restore-starter",
      id: createRecordId("prompt-preset"),
      now,
    });
  }, [runPromptPresetCatalogMutation]);

  const updatePromptPreset = useCallback(
    async (presetId: string, input: PromptPresetInput, expectedUpdatedAt: string) => {
      const now = currentIsoTimestamp();
      const original = promptPresets.find((preset) => preset.id === presetId);
      if (!original)
        return {
          saved: false,
          published: false,
          blocked: false,
          message: "Prompt preset was not found.",
        };
      return runPromptPresetCatalogMutation({
        kind: "update",
        presetId,
        originalUpdatedAt: expectedUpdatedAt,
        now,
        input,
      });
    },
    [promptPresets, runPromptPresetCatalogMutation],
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
    restoreStarterPromptPreset,
    updatePromptPreset,
    duplicatePromptPreset,
    prepareImportedPromptPreset,
    addImportedPromptPreset,
    deletePromptPreset,
  };
}
