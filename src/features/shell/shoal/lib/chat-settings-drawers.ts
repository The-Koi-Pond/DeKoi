export type ChatSettingsDrawerId =
  | "connection"
  | "persona"
  | "companions"
  | "prompt"
  | "lorebooks"
  | "advanced";

export const CHAT_SETTINGS_DRAWER_DEFAULTS: Record<ChatSettingsDrawerId, boolean> = {
  connection: true,
  persona: false,
  companions: false,
  prompt: false,
  lorebooks: false,
  advanced: false,
};
