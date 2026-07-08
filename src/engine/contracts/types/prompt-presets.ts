export interface PromptPresetSampling {
  maxTokens?: number | null;
  temperature?: number | null;
  topP?: number | null;
}

export interface PromptPresetRecord {
  id: string;
  schemaVersion: 1;
  title: string;
  summary?: string | null;
  systemPrompt: string;
  sampling?: PromptPresetSampling | null;
  createdAt: string;
  updatedAt: string;
}
