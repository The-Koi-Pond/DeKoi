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
  messengerPrompt?: string | null;
  sampling?: PromptPresetSampling | null;
  createdAt: string;
  updatedAt: string;
}

export function resolvePromptPresetMessengerPrompt(preset: PromptPresetRecord | null | undefined) {
  const messengerPrompt = preset?.messengerPrompt?.trim();
  if (messengerPrompt) return messengerPrompt;

  return preset?.systemPrompt.trim() || null;
}
