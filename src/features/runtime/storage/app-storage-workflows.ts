import {
  loadAppSettings,
  loadCharacterRecords,
  loadRoleplayThreads,
  loadInitialMessengerThreads,
  loadLorebookRecords,
  loadPersonaRecords,
  loadProviderConnectionRecords,
  loadRippleStates,
  type AppStorageRecords,
} from "../../../runtime";
import {
  readRemoteRuntimeUrl,
  writeRemoteRuntimeUrl,
} from "../../../shared/api/runtime-target";

export {
  APP_STORAGE_COLLECTION_KEYS,
  loadAppStorageSnapshot,
  saveAppStorageCollections,
  saveAppStorageSnapshot,
  type AppStorageCollectionKey,
  type AppStorageRecords,
  type AppStorageSnapshot,
} from "../../../runtime";
export {
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "../../../runtime";

export function loadInitialAppStorageRecords(): AppStorageRecords {
  return {
    appSettings: loadAppSettings(),
    characters: loadCharacterRecords(),
    personas: loadPersonaRecords(),
    lorebooks: loadLorebookRecords(),
    providerConnections: loadProviderConnectionRecords(),
    roleplayThreads: loadRoleplayThreads(),
    messengerThreads: loadInitialMessengerThreads(),
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
