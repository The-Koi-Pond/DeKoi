import type { PromptPresetThreadChoiceSelections } from "../../../../engine/contracts/types/prompt-presets";

export interface ChatSettingsThreadRecord {
  id: string;
  title: string;
  characterIds: string[];
  activePersonaId: string | null;
  lorebookIds: string[];
  presetId: string | null;
  presetChoiceSelectionsByPresetId?: Record<string, PromptPresetThreadChoiceSelections>;
  providerConnectionId: string | null;
}
