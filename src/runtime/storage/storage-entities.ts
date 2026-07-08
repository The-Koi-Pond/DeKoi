export const HOST_STORAGE_ENTITIES = [
  "app-settings",
  "characters",
  "roleplay-threads",
  "roleplay-entries",
  "lorebooks",
  "prompt-presets",
  "lore-runtime-states",
  "macro-variable-states",
  "messenger-threads",
  "messenger-messages",
  "personas",
  "provider-connections",
  "ripple-states",
] as const;

export type StorageEntity = (typeof HOST_STORAGE_ENTITIES)[number];

export const STORAGE_ENTITIES = {
  appSettings: "app-settings",
  characters: "characters",
  roleplayThreads: "roleplay-threads",
  roleplayEntries: "roleplay-entries",
  lorebooks: "lorebooks",
  promptPresets: "prompt-presets",
  loreRuntimeStates: "lore-runtime-states",
  macroVariableStates: "macro-variable-states",
  messengerThreads: "messenger-threads",
  messengerMessages: "messenger-messages",
  personas: "personas",
  providerConnections: "provider-connections",
  rippleStates: "ripple-states",
} as const satisfies Record<string, StorageEntity>;
