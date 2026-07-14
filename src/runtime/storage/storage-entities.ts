export const HOST_STORAGE_ENTITIES = [
  "app-settings",
  "characters",
  "mode-threads",
  "mode-messages",
  "lorebooks",
  "prompt-presets",
  "lore-runtime-states",
  "macro-variable-states",
  "personas",
  "provider-connections",
  "ripple-states",
] as const;

export type StorageEntity = (typeof HOST_STORAGE_ENTITIES)[number];

export const STORAGE_ENTITIES = {
  appSettings: "app-settings",
  characters: "characters",
  modeThreads: "mode-threads",
  modeMessages: "mode-messages",
  lorebooks: "lorebooks",
  promptPresets: "prompt-presets",
  loreRuntimeStates: "lore-runtime-states",
  macroVariableStates: "macro-variable-states",
  personas: "personas",
  providerConnections: "provider-connections",
  rippleStates: "ripple-states",
} as const satisfies Record<string, StorageEntity>;
