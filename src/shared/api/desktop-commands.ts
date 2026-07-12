export const DESKTOP_COMMANDS = {
  fileExportBundle: "dekoi_file_export_bundle",
  fileImportBundle: "dekoi_file_import_bundle",
  fileExportPromptPreset: "dekoi_file_export_prompt_preset",
  fileImportPromptPreset: "dekoi_file_import_prompt_preset",
  hostStatus: "dekoi_host_status",
  providerSecretDelete: "dekoi_provider_secret_delete",
  providerSecretStatus: "dekoi_provider_secret_status",
  providerSecretWrite: "dekoi_provider_secret_write",
  runtimeHealth: "dekoi_runtime_health",
  runtimeInvoke: "dekoi_runtime_invoke",
  storageReadBundle: "dekoi_storage_read_bundle",
  storageWriteBundle: "dekoi_storage_write_bundle",
  storageRepairCollection: "dekoi_storage_repair_collection",
  storageFinishCollectionRepair: "dekoi_storage_finish_collection_repair",
  storageCollectionMetadata: "dekoi_storage_collection_metadata",
} as const;

type DesktopCommand = (typeof DESKTOP_COMMANDS)[keyof typeof DESKTOP_COMMANDS];

export const DESKTOP_COMMAND_ALLOWLIST = [
  DESKTOP_COMMANDS.hostStatus,
  DESKTOP_COMMANDS.fileExportBundle,
  DESKTOP_COMMANDS.fileImportBundle,
  DESKTOP_COMMANDS.fileExportPromptPreset,
  DESKTOP_COMMANDS.fileImportPromptPreset,
  DESKTOP_COMMANDS.providerSecretDelete,
  DESKTOP_COMMANDS.providerSecretStatus,
  DESKTOP_COMMANDS.providerSecretWrite,
  DESKTOP_COMMANDS.runtimeHealth,
  DESKTOP_COMMANDS.runtimeInvoke,
  DESKTOP_COMMANDS.storageReadBundle,
  DESKTOP_COMMANDS.storageWriteBundle,
  DESKTOP_COMMANDS.storageRepairCollection,
  DESKTOP_COMMANDS.storageFinishCollectionRepair,
  DESKTOP_COMMANDS.storageCollectionMetadata,
] as const satisfies readonly DesktopCommand[];
