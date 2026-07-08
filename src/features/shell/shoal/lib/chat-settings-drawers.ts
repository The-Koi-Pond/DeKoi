export type ChatSettingsDrawerId =
  "connection" | "persona" | "companions" | "preset" | "prompt" | "lorebooks" | "advanced";

export const CHAT_SETTINGS_DRAWER_DEFAULTS: Record<ChatSettingsDrawerId, boolean> = {
  connection: false,
  persona: false,
  companions: false,
  preset: false,
  prompt: false,
  lorebooks: false,
  advanced: false,
};
