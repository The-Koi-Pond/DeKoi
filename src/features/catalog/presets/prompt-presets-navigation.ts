import type { PromptPresetRelationshipTransactionResult } from "../../../engine/prompt-presets/prompt-preset-relationship-actions";
import type { NavViewActions } from "../../navigation";

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
