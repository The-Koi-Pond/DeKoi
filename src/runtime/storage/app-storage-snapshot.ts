import type { CharacterRecord } from "../../engine/character";
import {
  attachRoleplayEntriesToThreads,
  type RoleplayThread,
} from "../../engine/roleplay";
import type { LorebookRecord } from "../../engine/lorebook";
import {
  attachMessengerMessagesToThreads,
  type MessengerThread,
} from "../../engine/messenger";
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
  loadRoleplayEntriesFromStorage,
  saveRoleplayEntriesToStorage,
} from "./collections/roleplay-entry-storage";
import {
  loadLorebookRecordsFromStorage,
  saveLorebookRecordsToStorage,
} from "./collections/lorebook-storage";
import {
  loadMessengerThreadsFromStorage,
  saveMessengerThreadsToStorage,
} from "./collections/messenger-storage";
import {
  loadMessengerMessagesFromStorage,
  saveMessengerMessagesToStorage,
} from "./collections/messenger-message-storage";
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
import { appStorageCollectionCount } from "./app-storage-collection-projection";
import { getHostStorageMode } from "./storage-repository-factory";

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
  migrationCollectionKeys: AppStorageCollectionKey[];
};

export type AppStorageCollectionKey =
  | "appSettings"
  | "characters"
  | "personas"
  | "lorebooks"
  | "providerConnections"
  | "roleplayThreads"
  | "roleplayEntries"
  | "messengerThreads"
  | "messengerMessages"
  | "rippleStates";

export const APP_STORAGE_COLLECTION_KEYS = [
  "appSettings",
  "characters",
  "personas",
  "lorebooks",
  "providerConnections",
  "roleplayThreads",
  "roleplayEntries",
  "messengerThreads",
  "messengerMessages",
  "rippleStates",
] as const satisfies readonly AppStorageCollectionKey[];

export type AppStorageCollectionReplaceResult = {
  collectionKey: AppStorageCollectionKey;
  count: number;
  mode: StorageResult["mode"];
  status: StorageResult["status"];
  message: string;
};

export type AppStorageReplaceResult = StorageResult & {
  counts: Record<AppStorageCollectionKey, number>;
  collections: AppStorageCollectionReplaceResult[];
  failedCollectionKey: AppStorageCollectionKey | null;
  requiresReload: boolean;
  rollbackAvailable: false;
  rollbackMessage: string;
};

type NonEmptyAppStorageCollectionKeys = readonly [
  AppStorageCollectionKey,
  ...AppStorageCollectionKey[],
];

export const APP_STORAGE_COLLECTION_LABELS = {
  appSettings: "App settings",
  characters: "Characters",
  personas: "Personas",
  lorebooks: "Lorebooks",
  providerConnections: "Provider connections",
  roleplayThreads: "Roleplay threads",
  roleplayEntries: "Roleplay entries",
  messengerThreads: "Messenger threads",
  messengerMessages: "Messenger messages",
  rippleStates: "Ripple states",
} as const satisfies Record<AppStorageCollectionKey, string>;

function appStorageSnapshotCounts(snapshot: AppStorageRecords) {
  return APP_STORAGE_COLLECTION_KEYS.reduce(
    (counts, collectionKey) => ({
      ...counts,
      [collectionKey]: appStorageCollectionCount(snapshot, collectionKey),
    }),
    {} as Record<AppStorageCollectionKey, number>,
  );
}

function appStorageRecordTotal(counts: Record<AppStorageCollectionKey, number>) {
  return APP_STORAGE_COLLECTION_KEYS.reduce(
    (total, collectionKey) => total + counts[collectionKey],
    0,
  );
}

function asAppStorageErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown storage error.");
}

function appStorageRequiresReload(
  collections: readonly AppStorageCollectionReplaceResult[],
) {
  return collections.some((collection) => collection.status === "ready");
}

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
    roleplayEntrySnapshot,
    messengerSnapshot,
    messengerMessageSnapshot,
    rippleSnapshot,
  ] = await Promise.all([
    loadAppSettingsFromStorage(rawUrl),
    loadCharacterRecordsFromStorage(rawUrl),
    loadPersonaRecordsFromStorage(rawUrl),
    loadLorebookRecordsFromStorage(rawUrl),
    loadProviderConnectionRecordsFromStorage(rawUrl),
    loadRoleplayThreadsFromStorage(rawUrl),
    loadRoleplayEntriesFromStorage(rawUrl),
    loadMessengerThreadsFromStorage(rawUrl),
    loadMessengerMessagesFromStorage(rawUrl),
    loadRippleStatesFromStorage(rawUrl),
  ]);
  const roleplayThreads = attachRoleplayEntriesToThreads(
    roleplaySnapshot.records,
    roleplayEntrySnapshot.records,
  );
  const messengerThreads = attachMessengerMessagesToThreads(
    messengerSnapshot.threads,
    messengerMessageSnapshot.records,
  );
  const migrationCollectionKeys: AppStorageCollectionKey[] = [
    ...(roleplaySnapshot.hasLegacyEmbeddedEntries
      ? (["roleplayThreads", "roleplayEntries"] as const)
      : []),
    ...(messengerSnapshot.hasLegacyEmbeddedMessages
      ? (["messengerThreads", "messengerMessages"] as const)
      : []),
  ];

  return {
    appSettings: appSettingsSnapshot.settings,
    characters: characterSnapshot.records,
    personas: personaSnapshot.records,
    lorebooks: lorebookSnapshot.records,
    providerConnections: providerConnectionSnapshot.records,
    roleplayThreads,
    messengerThreads,
    rippleStates: rippleSnapshot.states,
    migrationCollectionKeys,
    storageResult: mergeStorageResults([
      appSettingsSnapshot,
      characterSnapshot,
      personaSnapshot,
      lorebookSnapshot,
      providerConnectionSnapshot,
      roleplaySnapshot,
      roleplayEntrySnapshot,
      messengerSnapshot,
      messengerMessageSnapshot,
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
    case "roleplayEntries":
      return saveRoleplayEntriesToStorage(snapshot.roleplayThreads, rawUrl);
    case "messengerThreads":
      return saveMessengerThreadsToStorage(snapshot.messengerThreads, rawUrl);
    case "messengerMessages":
      return saveMessengerMessagesToStorage(snapshot.messengerThreads, rawUrl);
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

export async function replaceAppStorageSnapshot(
  records: AppStorageRecords,
  rawUrl: string,
): Promise<AppStorageReplaceResult> {
  const counts = appStorageSnapshotCounts(records);
  const collections: AppStorageCollectionReplaceResult[] = [];
  const rollbackMessage =
    "No automatic rollback was performed. Use the pre-import backup bundle to restore if needed.";

  for (const collectionKey of APP_STORAGE_COLLECTION_KEYS) {
    let result: StorageResult;
    try {
      result = await saveAppStorageCollection(records, collectionKey, rawUrl);
    } catch (error) {
      const message = asAppStorageErrorMessage(error);
      const collectionResult: AppStorageCollectionReplaceResult = {
        collectionKey,
        count: counts[collectionKey],
        mode: getHostStorageMode(rawUrl),
        status: "error",
        message,
      };
      collections.push(collectionResult);

      return {
        mode: collectionResult.mode,
        status: "error",
        message: `Import failed while replacing ${APP_STORAGE_COLLECTION_LABELS[collectionKey]}. ${message} ${rollbackMessage}`,
        counts,
        collections,
        failedCollectionKey: collectionKey,
        requiresReload: appStorageRequiresReload(collections),
        rollbackAvailable: false,
        rollbackMessage,
      };
    }

    const collectionResult: AppStorageCollectionReplaceResult = {
      collectionKey,
      count: counts[collectionKey],
      mode: result.mode,
      status: result.status,
      message: result.message,
    };
    collections.push(collectionResult);

    if (result.status === "error") {
      return {
        mode: result.mode,
        status: "error",
        message: `Import failed while replacing ${APP_STORAGE_COLLECTION_LABELS[collectionKey]}. ${result.message} ${rollbackMessage}`,
        counts,
        collections,
        failedCollectionKey: collectionKey,
        requiresReload: appStorageRequiresReload(collections),
        rollbackAvailable: false,
        rollbackMessage,
      };
    }
  }

  const mergedResult = mergeStorageResults(collections);
  return {
    mode: mergedResult.mode,
    status: "ready",
    message: `Imported ${APP_STORAGE_COLLECTION_KEYS.length} collection(s) with ${appStorageRecordTotal(counts)} top-level record(s).`,
    counts,
    collections,
    failedCollectionKey: null,
    requiresReload: false,
    rollbackAvailable: false,
    rollbackMessage,
  };
}
