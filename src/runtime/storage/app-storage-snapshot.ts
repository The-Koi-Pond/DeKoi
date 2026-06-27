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

export const APP_STORAGE_COLLECTION_KEYS = [
  "appSettings",
  "characters",
  "personas",
  "lorebooks",
  "providerConnections",
  "roleplayThreads",
  "messengerThreads",
  "rippleStates",
] as const satisfies readonly (keyof AppStorageRecords)[];

export type AppStorageCollectionKey =
  (typeof APP_STORAGE_COLLECTION_KEYS)[number];

type NonEmptyAppStorageCollectionKeys = readonly [
  AppStorageCollectionKey,
  ...AppStorageCollectionKey[],
];

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

async function saveAppStorageCollection(
  snapshot: AppStorageRecords,
  collectionKey: AppStorageCollectionKey,
  rawUrl: string,
): Promise<StorageResult> {
  switch (collectionKey) {
    case "appSettings":
      return saveAppSettingsToStorage(snapshot.appSettings, rawUrl);
    case "characters":
      return saveCharacterRecordsToStorage(snapshot.characters, rawUrl);
    case "personas":
      return savePersonaRecordsToStorage(snapshot.personas, rawUrl);
    case "lorebooks":
      return saveLorebookRecordsToStorage(snapshot.lorebooks, rawUrl);
    case "providerConnections":
      return saveProviderConnectionRecordsToStorage(
        snapshot.providerConnections,
        rawUrl,
      );
    case "roleplayThreads":
      return saveRoleplayThreadsToStorage(snapshot.roleplayThreads, rawUrl);
    case "messengerThreads":
      return saveMessengerThreadsToStorage(snapshot.messengerThreads, rawUrl);
    case "rippleStates":
      return saveRippleStatesToStorage(snapshot.rippleStates, rawUrl);
  }
}

export async function saveAppStorageCollections(
  snapshot: AppStorageRecords,
  collectionKeys: NonEmptyAppStorageCollectionKeys,
  rawUrl: string,
): Promise<StorageResult> {
  return mergeStorageResults(
    await Promise.all(
      collectionKeys.map((collectionKey) =>
        saveAppStorageCollection(snapshot, collectionKey, rawUrl),
      ),
    ),
  );
}

export async function saveAppStorageSnapshot(
  snapshot: AppStorageRecords,
  rawUrl: string,
): Promise<StorageResult> {
  return saveAppStorageCollections(
    snapshot,
    APP_STORAGE_COLLECTION_KEYS,
    rawUrl,
  );
}
