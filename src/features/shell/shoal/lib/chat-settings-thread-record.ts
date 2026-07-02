export interface ChatSettingsThreadRecord {
  id: string;
  title: string;
  characterIds: string[];
  activePersonaId: string | null;
  lorebookIds: string[];
  providerConnectionId: string | null;
  systemPromptMode?: "default" | "custom";
}
