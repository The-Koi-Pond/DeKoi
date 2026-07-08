import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import deKoiUniversalPreset from "./DeKoiUniversalPreset.json" with { type: "json" };
import { normalizePromptPresetRecord } from "./prompt-preset-actions";

// Starter content is DeKoi-owned prompt material; do not replace it with
// Marinara-derived prompt text or schema.
const normalizedStarterPromptPreset = normalizePromptPresetRecord(deKoiUniversalPreset);
if (!normalizedStarterPromptPreset) {
  throw new Error("DeKoi Universal prompt preset seed is invalid.");
}

export const STARTER_PROMPT_PRESET: PromptPresetRecord = normalizedStarterPromptPreset;
