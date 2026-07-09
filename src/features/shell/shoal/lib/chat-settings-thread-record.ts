import type { PromptPresetChoiceSelections } from "../../../../engine/contracts/types/prompt-presets";

export interface ChatSettingsThreadRecord {
  id: string;
  title: string;
  characterIds: string[];
  activePersonaId: string | null;
  lorebookIds: string[];
  presetId: string | null;
  presetChoiceSelections?: PromptPresetChoiceSelections;
  providerConnectionId: string | null;
  systemPromptMode?: "default" | "custom";
}
