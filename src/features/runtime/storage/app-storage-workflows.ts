import {
  loadAppSettings,
  loadCharacterRecords,
  loadLorebookRecords,
  loadPersonaRecords,
  loadPromptPresetRecords,
  loadProviderConnectionRecords,
  loadRippleStates,
  type AppStorageRecords,
} from "../../../runtime";
import { readRemoteRuntimeUrl, writeRemoteRuntimeUrl } from "../../../shared/api/runtime-target";

export {
  APP_STORAGE_COLLECTION_LABELS,
  APP_STORAGE_COLLECTION_KEYS,
  appStorageCollectionCount,
  appStorageCollectionSignature,
  appStorageCollectionSource,
  changedAppStorageMetadataKeys,
  loadAppStorageSnapshot,
  loadAppStorageMetadata,
  replaceAppStorageSnapshot,
  saveAppStorageCollections,
  summarizeAppStorageDroppedRecords,
  type AppStorageCollectionKey,
  type AppStorageMetadata,
  type AppStorageRecords,
  type AppStorageReplaceResult,
  type AppStorageSnapshot,
} from "../../../runtime";
export { type MessengerStorageMode, type MessengerStorageStatus } from "../../../runtime";
export {
  finishAppStorageCollectionRepair,
  loadAppStorageRepairStatus,
  repairAppStorageCollection,
  type AppStorageRepairCollectionStatus,
  type AppStorageRepairStatusResult,
  type AppStorageRepairStrategy,
} from "../../../runtime";

export function loadInitialAppStorageRecords(): AppStorageRecords {
  const promptPresets = loadPromptPresetRecords();
  const appSettings = loadAppSettings();
  return {
    appSettings: {
      ...appSettings,
      defaultPromptPresetId: appSettings.defaultPromptPresetId ?? promptPresets[0]?.id ?? null,
    },
    characters: loadCharacterRecords(),
    personas: loadPersonaRecords(),
    lorebooks: loadLorebookRecords(),
    promptPresets,
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: loadProviderConnectionRecords(),
    modeThreads: [],
    rippleStates: loadRippleStates(),
  };
}

export function readRuntimeTargetUrl(): string {
  return readRemoteRuntimeUrl();
}

export function writeRuntimeTargetUrl(url: string): string {
  writeRemoteRuntimeUrl(url);
  return readRemoteRuntimeUrl();
}
