import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import deKoiUniversalPreset from "./DeKoiUniversalPreset.json" with { type: "json" };
import { createImportedPromptPresetRecord } from "./prompt-preset-actions";
import { normalizePromptPresetPackage } from "./prompt-preset-package";

// Chai authored this Universal V2 package for the DeKoi team. Keep the approved
// JSON artifact intact and adapt it into DeKoi's native record at this boundary.
const normalizedStarterPromptPreset = normalizePromptPresetPackage(deKoiUniversalPreset);
if (!normalizedStarterPromptPreset) {
  throw new Error("DeKoi Universal prompt preset seed is invalid.");
}

export const STARTER_PROMPT_PRESET: PromptPresetRecord = normalizedStarterPromptPreset;

export function createRestoredStarterPromptPreset(id: string, now: string): PromptPresetRecord {
  return createImportedPromptPresetRecord(STARTER_PROMPT_PRESET, id, now);
}
