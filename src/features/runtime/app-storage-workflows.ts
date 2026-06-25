import {
  loadAppSettings,
  loadCharacterRecords,
  loadClassicThreads,
  loadInitialMessengerThreads,
  loadLorebookRecords,
  loadPersonaRecords,
  loadProviderConnectionRecords,
  loadRippleStates,
  type AppStorageRecords,
} from "../../runtime";
import {
  readRemoteRuntimeUrl,
  writeRemoteRuntimeUrl,
} from "../../shared/api/runtime-target";

export {
  loadAppStorageSnapshot,
  saveAppStorageSnapshot,
  type AppStorageRecords,
  type AppStorageSnapshot,
} from "../../runtime";
export {
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "../../runtime";

export function loadInitialAppStorageRecords(): AppStorageRecords {
  return {
    appSettings: loadAppSettings(),
    characters: loadCharacterRecords(),
    personas: loadPersonaRecords(),
    lorebooks: loadLorebookRecords(),
    providerConnections: loadProviderConnectionRecords(),
    classicThreads: loadClassicThreads(),
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
