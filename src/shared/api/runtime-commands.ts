export const RUNTIME_COMMANDS = {
  generationGenerate: "generation_generate",
  providerConnectionCheck: "provider_connection_check",
  providerConnectionModels: "provider_connection_models",
  storageCreate: "storage_create",
  storageDelete: "storage_delete",
  storageList: "storage_list",
  storageReplace: "storage_replace",
  storageUpdate: "storage_update",
} as const;

export type RemoteRuntimeCommand = (typeof RUNTIME_COMMANDS)[keyof typeof RUNTIME_COMMANDS];

export const REMOTE_RUNTIME_COMMANDS = [
  RUNTIME_COMMANDS.generationGenerate,
  RUNTIME_COMMANDS.providerConnectionCheck,
  RUNTIME_COMMANDS.providerConnectionModels,
  RUNTIME_COMMANDS.storageCreate,
  RUNTIME_COMMANDS.storageDelete,
  RUNTIME_COMMANDS.storageList,
  RUNTIME_COMMANDS.storageReplace,
  RUNTIME_COMMANDS.storageUpdate,
] as const satisfies readonly RemoteRuntimeCommand[];

export type StorageRuntimeCommand =
  | typeof RUNTIME_COMMANDS.storageCreate
  | typeof RUNTIME_COMMANDS.storageDelete
  | typeof RUNTIME_COMMANDS.storageList
  | typeof RUNTIME_COMMANDS.storageReplace
  | typeof RUNTIME_COMMANDS.storageUpdate;
