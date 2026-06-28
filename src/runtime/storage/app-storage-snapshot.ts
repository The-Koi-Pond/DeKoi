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
  type StorageCollectionMetadata,
  type StorageResult,
} from "./storage-repository";
import { appStorageCollectionCount } from "./app-storage-collection-projection";
import {
  getHostStorageMode,
  loadHostStorageMetadata,
} from "./storage-repository-factory";
import {
  STORAGE_ENTITIES,
  type StorageEntity,
} from "./storage-entities";

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

export type AppStorageMetadata = Partial<
  Record<AppStorageCollectionKey, StorageCollectionMetadata>
>;

type AppStorageStatusResult = Omit<StorageResult, "metadata">;

export type AppStorageMetadataResult = AppStorageStatusResult & {
  metadataAvailable: boolean;
  storageMetadata: AppStorageMetadata;
};

export type AppStorageSaveResult = AppStorageStatusResult & {
  storageMetadata: AppStorageMetadata;
};

export type AppStorageSnapshot = AppStorageRecords & {
  storageResult: StorageResult;
  migrationCollectionKeys: AppStorageMigrationCollectionKey[];
  storageMetadata: AppStorageMetadata;
};

export type AppStorageMigrationCollectionKey =
  | "roleplayThreads"
  | "roleplayEntries"
  | "messengerThreads"
  | "messengerMessages";

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

export const APP_STORAGE_COLLECTION_ENTITIES = {
  appSettings: STORAGE_ENTITIES.appSettings,
  characters: STORAGE_ENTITIES.characters,
  personas: STORAGE_ENTITIES.personas,
  lorebooks: STORAGE_ENTITIES.lorebooks,
  providerConnections: STORAGE_ENTITIES.providerConnections,
  roleplayThreads: STORAGE_ENTITIES.roleplayThreads,
  roleplayEntries: STORAGE_ENTITIES.roleplayEntries,
  messengerThreads: STORAGE_ENTITIES.messengerThreads,
  messengerMessages: STORAGE_ENTITIES.messengerMessages,
  rippleStates: STORAGE_ENTITIES.rippleStates,
} as const satisfies Record<AppStorageCollectionKey, StorageEntity>;

export type AppStorageCollectionReplaceResult = {
  collectionKey: AppStorageCollectionKey;
  count: number;
  mode: StorageResult["mode"];
  status: StorageResult["status"];
  message: string;
  metadata: StorageCollectionMetadata | null;
};

export type AppStorageReplaceResult = AppStorageStatusResult & {
  counts: Record<AppStorageCollectionKey, number>;
  collections: AppStorageCollectionReplaceResult[];
  failedCollectionKey: AppStorageCollectionKey | null;
  requiresReload: boolean;
  rollbackAvailable: false;
  rollbackMessage: string;
  storageMetadata: AppStorageMetadata;
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

function appStorageMetadataByCollectionKey(
  collectionMetadata: readonly StorageCollectionMetadata[],
): AppStorageMetadata {
  const metadataByEntity = new Map(
    collectionMetadata.map((metadata) => [metadata.entity, metadata] as const),
  );
  const storageMetadata: AppStorageMetadata = {};
  for (const collectionKey of APP_STORAGE_COLLECTION_KEYS) {
    const metadata = metadataByEntity.get(
      APP_STORAGE_COLLECTION_ENTITIES[collectionKey],
    );
    if (metadata) storageMetadata[collectionKey] = metadata;
  }
  return storageMetadata;
}

export function appStorageMetadataSignature(
  metadata: StorageCollectionMetadata | null | undefined,
) {
  if (!metadata) return "";

  return JSON.stringify({
    entity: metadata.entity,
    exists: metadata.exists,
    byteLength: metadata.byteLength,
    updatedAtMs: metadata.updatedAtMs,
    contentHash: metadata.contentHash,
  });
}

export function changedAppStorageMetadataKeys(
  previousMetadata: AppStorageMetadata,
  currentMetadata: AppStorageMetadata,
) {
  return APP_STORAGE_COLLECTION_KEYS.filter(
    (collectionKey) =>
      appStorageMetadataSignature(previousMetadata[collectionKey]) !==
      appStorageMetadataSignature(currentMetadata[collectionKey]),
  );
}

function asAppStorageErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown storage error.");
}

function storageResultWithoutCollectionMetadata(
  result: StorageResult,
): AppStorageStatusResult {
  return {
    mode: result.mode,
    status: result.status,
    message: result.message,
  };
}

function appStorageRequiresReload(
  collections: readonly AppStorageCollectionReplaceResult[],
) {
  return collections.some((collection) => collection.status === "ready");
}

export async function loadAppStorageMetadata(
  rawUrl: string,
): Promise<AppStorageMetadataResult> {
  const metadataResult = await loadHostStorageMetadata(rawUrl);
  return {
    mode: metadataResult.mode,
    status: metadataResult.status,
    message: metadataResult.message,
    metadataAvailable: metadataResult.metadataAvailable,
    storageMetadata: appStorageMetadataByCollectionKey(
      metadataResult.collectionMetadata,
    ),
  };
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
    metadataResult,
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
    loadAppStorageMetadata(rawUrl),
  ]);
  const roleplayThreads = attachRoleplayEntriesToThreads(
    roleplaySnapshot.records,
    roleplayEntrySnapshot.records,
  );
  const messengerThreads = attachMessengerMessagesToThreads(
    messengerSnapshot.threads,
    messengerMessageSnapshot.records,
  );
  const migrationCollectionKeys: AppStorageMigrationCollectionKey[] = [
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
    storageMetadata: metadataResult.storageMetadata,
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
): Promise<AppStorageSaveResult> {
  const collectionResults = await Promise.all(
    collectionKeys.map(async (collectionKey) => ({
      collectionKey,
      result: await saveAppStorageCollection(snapshot, collectionKey, rawUrl),
    })),
  );
  const storageMetadata: AppStorageMetadata = {};
  for (const { collectionKey, result } of collectionResults) {
    if (result.metadata) storageMetadata[collectionKey] = result.metadata;
  }

  return {
    ...storageResultWithoutCollectionMetadata(
      mergeStorageResults(collectionResults.map(({ result }) => result)),
    ),
    storageMetadata,
  };
}

export async function saveAppStorageSnapshot(
  snapshot: AppStorageRecords,
  rawUrl: string,
): Promise<AppStorageSaveResult> {
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
  const storageMetadata: AppStorageMetadata = {};
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
        metadata: null,
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
        storageMetadata,
      };
    }

    const collectionResult: AppStorageCollectionReplaceResult = {
      collectionKey,
      count: counts[collectionKey],
      mode: result.mode,
      status: result.status,
      message: result.message,
      metadata: result.metadata ?? null,
    };
    collections.push(collectionResult);
    if (result.metadata) {
      storageMetadata[collectionKey] = result.metadata;
    }

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
        storageMetadata,
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
    storageMetadata,
  };
}
