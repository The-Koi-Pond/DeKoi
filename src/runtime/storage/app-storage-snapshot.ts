import type { CharacterRecord } from "../../engine/character";
import type { RoleplayThread } from "../../engine/roleplay";
import type { LorebookRecord } from "../../engine/lorebook";
import type { MessengerThread } from "../../engine/messenger";
import type { PersonaRecord } from "../../engine/persona";
import type { ProviderConnectionRecord } from "../../engine/provider-connection";
import type { RippleState } from "../../engine/ripples";
import {
  loadAppSettingsFromStorage,
  saveAppSettingsToStorage,
} from "./collections/app-settings";
import type { AppSettings } from "../../engine/app-settings";
import {
  loadCharacterRecordsFromStorage,
  saveCharacterRecordsToStorage,
} from "./collections/character-storage";
import {
  loadRoleplayThreadsFromStorage,
  saveRoleplayThreadsToStorage,
} from "./collections/roleplay-storage";
import {
  loadLorebookRecordsFromStorage,
  saveLorebookRecordsToStorage,
} from "./collections/lorebook-storage";
import {
  loadMessengerThreadsFromStorage,
  saveMessengerThreadsToStorage,
} from "./collections/messenger-storage";
import {
  loadPersonaRecordsFromStorage,
  savePersonaRecordsToStorage,
} from "./collections/persona-storage";
import {
  loadProviderConnectionRecordsFromStorage,
  saveProviderConnectionRecordsToStorage,
} from "./collections/provider-connection-storage";
import {
  loadRippleStatesFromStorage,
  saveRippleStatesToStorage,
} from "./collections/ripple-state-storage";
import {
  mergeStorageResults,
  type StorageResult,
} from "./storage-repository";

export type AppStorageRecords = {
  appSettings: AppSettings;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections: ProviderConnectionRecord[];
  roleplayThreads: RoleplayThread[];
  messengerThreads: MessengerThread[];
  rippleStates: RippleState[];
};

export type AppStorageSnapshot = AppStorageRecords & {
  storageResult: StorageResult;
};

export async function loadAppStorageSnapshot(
  rawUrl: string,
): Promise<AppStorageSnapshot> {
  const [
    appSettingsSnapshot,
    characterSnapshot,
    personaSnapshot,
    lorebookSnapshot,
    providerConnectionSnapshot,
    roleplaySnapshot,
    messengerSnapshot,
    rippleSnapshot,
  ] = await Promise.all([
    loadAppSettingsFromStorage(rawUrl),
    loadCharacterRecordsFromStorage(rawUrl),
    loadPersonaRecordsFromStorage(rawUrl),
    loadLorebookRecordsFromStorage(rawUrl),
    loadProviderConnectionRecordsFromStorage(rawUrl),
    loadRoleplayThreadsFromStorage(rawUrl),
    loadMessengerThreadsFromStorage(rawUrl),
    loadRippleStatesFromStorage(rawUrl),
  ]);

  return {
    appSettings: appSettingsSnapshot.settings,
    characters: characterSnapshot.records,
    personas: personaSnapshot.records,
    lorebooks: lorebookSnapshot.records,
    providerConnections: providerConnectionSnapshot.records,
    roleplayThreads: roleplaySnapshot.records,
    messengerThreads: messengerSnapshot.threads,
    rippleStates: rippleSnapshot.states,
    storageResult: mergeStorageResults([
      appSettingsSnapshot,
      characterSnapshot,
      personaSnapshot,
      lorebookSnapshot,
      providerConnectionSnapshot,
      roleplaySnapshot,
      messengerSnapshot,
      rippleSnapshot,
    ]),
  };
}

export async function saveAppStorageSnapshot(
  snapshot: AppStorageRecords,
  rawUrl: string,
): Promise<StorageResult> {
  return mergeStorageResults(
    await Promise.all([
      saveAppSettingsToStorage(snapshot.appSettings, rawUrl),
      saveCharacterRecordsToStorage(snapshot.characters, rawUrl),
      savePersonaRecordsToStorage(snapshot.personas, rawUrl),
      saveLorebookRecordsToStorage(snapshot.lorebooks, rawUrl),
      saveProviderConnectionRecordsToStorage(
        snapshot.providerConnections,
        rawUrl,
      ),
      saveRoleplayThreadsToStorage(snapshot.roleplayThreads, rawUrl),
      saveMessengerThreadsToStorage(snapshot.messengerThreads, rawUrl),
      saveRippleStatesToStorage(snapshot.rippleStates, rawUrl),
    ]),
  );
}
