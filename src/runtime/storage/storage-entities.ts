export const HOST_STORAGE_ENTITIES = [
  "app-settings",
  "characters",
  "classic-threads",
  "lorebooks",
  "messenger-threads",
  "personas",
  "provider-connections",
  "ripple-states",
] as const;

export type StorageEntity = (typeof HOST_STORAGE_ENTITIES)[number];
export type HostStorageEntity = StorageEntity;

export const STORAGE_ENTITIES = {
  appSettings: "app-settings",
  characters: "characters",
  classicThreads: "classic-threads",
  lorebooks: "lorebooks",
  messengerThreads: "messenger-threads",
  personas: "personas",
  providerConnections: "provider-connections",
  rippleStates: "ripple-states",
} as const satisfies Record<string, StorageEntity>;
