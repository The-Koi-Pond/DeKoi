import type { CharacterRecord } from "../engine/character";
import type { ClassicThread } from "../engine/classic";
import type { LorebookRecord } from "../engine/lorebook";
import type { MessengerThread } from "../engine/messenger";
import type { PersonaRecord } from "../engine/persona";
import type { ProviderConnectionRecord } from "../engine/provider-connection";
import type { RippleState } from "../engine/ripples";
import {
  loadAppSettingsFromStorage,
  saveAppSettingsToStorage,
} from "./storage/collections/app-settings";
import type { AppSettings } from "../engine/app-settings";
import {
  loadCharacterRecordsFromStorage,
  saveCharacterRecordsToStorage,
} from "./storage/collections/character-storage";
import {
  loadClassicThreadsFromStorage,
  saveClassicThreadsToStorage,
} from "./storage/collections/classic-storage";
import {
  loadLorebookRecordsFromStorage,
  saveLorebookRecordsToStorage,
} from "./storage/collections/lorebook-storage";
import {
  loadMessengerThreadsFromStorage,
  saveMessengerThreadsToStorage,
} from "./storage/collections/messenger-storage";
import {
  loadPersonaRecordsFromStorage,
  savePersonaRecordsToStorage,
} from "./storage/collections/persona-storage";
import {
  loadProviderConnectionRecordsFromStorage,
  saveProviderConnectionRecordsToStorage,
} from "./storage/collections/provider-connection-storage";
import {
  loadRippleStatesFromStorage,
  saveRippleStatesToStorage,
} from "./storage/collections/ripple-state-storage";
import {
  mergeStorageResults,
  type StorageResult,
} from "./storage/storage-repository";

export type AppStorageRecords = {
  appSettings: AppSettings;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections: ProviderConnectionRecord[];
  classicThreads: ClassicThread[];
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
    classicSnapshot,
    messengerSnapshot,
    rippleSnapshot,
  ] = await Promise.all([
    loadAppSettingsFromStorage(rawUrl),
    loadCharacterRecordsFromStorage(rawUrl),
    loadPersonaRecordsFromStorage(rawUrl),
    loadLorebookRecordsFromStorage(rawUrl),
    loadProviderConnectionRecordsFromStorage(rawUrl),
    loadClassicThreadsFromStorage(rawUrl),
    loadMessengerThreadsFromStorage(rawUrl),
    loadRippleStatesFromStorage(rawUrl),
  ]);

  return {
    appSettings: appSettingsSnapshot.settings,
    characters: characterSnapshot.records,
    personas: personaSnapshot.records,
    lorebooks: lorebookSnapshot.records,
    providerConnections: providerConnectionSnapshot.records,
    classicThreads: classicSnapshot.records,
    messengerThreads: messengerSnapshot.threads,
    rippleStates: rippleSnapshot.states,
    storageResult: mergeStorageResults([
      appSettingsSnapshot,
      characterSnapshot,
      personaSnapshot,
      lorebookSnapshot,
      providerConnectionSnapshot,
      classicSnapshot,
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
      saveClassicThreadsToStorage(snapshot.classicThreads, rawUrl),
      saveMessengerThreadsToStorage(snapshot.messengerThreads, rawUrl),
      saveRippleStatesToStorage(snapshot.rippleStates, rawUrl),
    ]),
  );
}
