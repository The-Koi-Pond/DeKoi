export const RUNTIME_COMMANDS = {
  messengerGenerate: "messenger_generate",
  providerConnectionCheck: "provider_connection_check",
  storageCreate: "storage_create",
  storageDelete: "storage_delete",
  storageList: "storage_list",
  storageUpdate: "storage_update",
} as const;

export type RemoteRuntimeCommand =
  (typeof RUNTIME_COMMANDS)[keyof typeof RUNTIME_COMMANDS];

export const REMOTE_RUNTIME_COMMANDS = [
  RUNTIME_COMMANDS.messengerGenerate,
  RUNTIME_COMMANDS.providerConnectionCheck,
  RUNTIME_COMMANDS.storageCreate,
  RUNTIME_COMMANDS.storageDelete,
  RUNTIME_COMMANDS.storageList,
  RUNTIME_COMMANDS.storageUpdate,
] as const satisfies readonly RemoteRuntimeCommand[];

export const STORAGE_RUNTIME_COMMANDS = [
  RUNTIME_COMMANDS.storageCreate,
  RUNTIME_COMMANDS.storageDelete,
  RUNTIME_COMMANDS.storageList,
  RUNTIME_COMMANDS.storageUpdate,
] as const;

export type StorageRuntimeCommand = (typeof STORAGE_RUNTIME_COMMANDS)[number];
