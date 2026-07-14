import type { PromptPresetRelationshipTransactionResult } from "../../../engine/prompt-presets/prompt-preset-relationship-actions";
import type { NavViewActions } from "../../navigation";
import type { PromptPresetCatalogTransactionResult } from "../../navigation";

export async function deletePromptPresetAndNavigate({
  presetId,
  deletePromptPreset,
  setPromptPresetFileStatus,
  setView,
}: {
  presetId: string;
  deletePromptPreset: (presetId: string) => Promise<PromptPresetRelationshipTransactionResult>;
  setPromptPresetFileStatus: (status: string) => void;
  setView: NavViewActions["setView"];
}): Promise<PromptPresetRelationshipTransactionResult> {
  setPromptPresetFileStatus("");
  const result = await deletePromptPreset(presetId);
  if (result.published) {
    setView({ kind: "presets" });
  } else {
    setPromptPresetFileStatus(result.message);
  }
  return result;
}

export async function restoreStarterPromptPresetAndNavigate({
  restoreStarterPromptPreset,
  onRestoredPresetReady,
  setPromptPresetCatalogStatus,
  isOriginCurrent,
}: {
  restoreStarterPromptPreset: () => Promise<PromptPresetCatalogTransactionResult>;
  onRestoredPresetReady: (presetId: string) => void;
  setPromptPresetCatalogStatus: (message: string) => void;
  isOriginCurrent: () => boolean;
}): Promise<PromptPresetCatalogTransactionResult> {
  const result = await restoreStarterPromptPreset();
  if (result.published && result.preset) {
    if (isOriginCurrent()) onRestoredPresetReady(result.preset.id);
  } else {
    setPromptPresetCatalogStatus(`Restore failed. ${result.message}`);
  }
  return result;
}
