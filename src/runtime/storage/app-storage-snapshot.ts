import { attachRoleplayEntriesToThreads } from "../../engine/contracts/types/roleplay";
import { attachMessengerMessagesToThreads } from "../../engine/contracts/types/messenger";
import { errorMessage } from "../../shared/errors";
import { loadAppSettingsFromStorage, saveAppSettingsToStorage } from "./collections/app-settings";
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
  loadPromptPresetRecordsFromStorage,
  savePromptPresetRecordsToStorage,
} from "./collections/prompt-preset-storage";
import {
  loadLoreRuntimeStatesFromStorage,
  saveLoreRuntimeStatesToStorage,
} from "./collections/lore-runtime-state-storage";
import {
  loadMacroVariableStatesFromStorage,
  saveMacroVariableStatesToStorage,
} from "./collections/macro-variable-state-storage";
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
import { getHostStorageMode, loadHostStorageMetadata } from "./storage-repository-factory";
import { STORAGE_ENTITIES, type StorageEntity } from "./storage-entities";
import { repairPromptPresetRelationships } from "./prompt-preset-relationship-repair";
import {
  APP_STORAGE_COLLECTION_KEYS,
  type AppStorageCollectionKey,
  type AppStorageRecords,
} from "./app-storage-records";
import { STARTER_PROMPT_PRESET } from "../../engine/prompt-presets/starter-preset";

export {
  APP_STORAGE_COLLECTION_KEYS,
  type AppStorageCollectionKey,
  type AppStorageRecords,
} from "./app-storage-records";

export type AppStorageMetadata = Partial<
  Record<AppStorageCollectionKey, StorageCollectionMetadata>
>;

type AppStorageStatusResult = Omit<StorageResult, "metadata">;

type AppStorageMetadataResult = AppStorageStatusResult & {
  metadataAvailable: boolean;
  storageMetadata: AppStorageMetadata;
};

type AppStorageSaveResult = AppStorageStatusResult & {
  storageMetadata: AppStorageMetadata;
};

export type AppStorageSnapshot = AppStorageRecords & {
  storageResult: StorageResult;
  migrationCollectionKeys: AppStorageMigrationCollectionKey[];
  storageMetadata: AppStorageMetadata;
  /** Nonzero per-collection dropped-record counts from the most recent load. */
  droppedRecordCountByCollection: Partial<Record<AppStorageCollectionKey, number>>;
};

type AppStorageMigrationCollectionKey =
  | "appSettings"
  | "promptPresets"
  | "roleplayThreads"
  | "roleplayEntries"
  | "messengerThreads"
  | "messengerMessages";

type AppStorageCollectionLoadResult = StorageResult & {
  droppedRecordCount: number;
};

export const APP_STORAGE_COLLECTION_ENTITIES = {
  appSettings: STORAGE_ENTITIES.appSettings,
  characters: STORAGE_ENTITIES.characters,
  personas: STORAGE_ENTITIES.personas,
  lorebooks: STORAGE_ENTITIES.lorebooks,
  promptPresets: STORAGE_ENTITIES.promptPresets,
  loreRuntimeStates: STORAGE_ENTITIES.loreRuntimeStates,
  macroVariableStates: STORAGE_ENTITIES.macroVariableStates,
  providerConnections: STORAGE_ENTITIES.providerConnections,
  roleplayThreads: STORAGE_ENTITIES.roleplayThreads,
  roleplayEntries: STORAGE_ENTITIES.roleplayEntries,
  messengerThreads: STORAGE_ENTITIES.messengerThreads,
  messengerMessages: STORAGE_ENTITIES.messengerMessages,
  rippleStates: STORAGE_ENTITIES.rippleStates,
} as const satisfies Record<AppStorageCollectionKey, StorageEntity>;

type AppStorageCollectionReplaceResult = {
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
  promptPresets: "Prompt presets",
  loreRuntimeStates: "Lore runtime states",
  macroVariableStates: "Macro variable states",
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
    const metadata = metadataByEntity.get(APP_STORAGE_COLLECTION_ENTITIES[collectionKey]);
    if (metadata) storageMetadata[collectionKey] = metadata;
  }
  return storageMetadata;
}

function appStorageMetadataSignature(metadata: StorageCollectionMetadata | null | undefined) {
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
  return errorMessage(error, "Unknown storage error.");
}

function storageResultWithoutCollectionMetadata(result: StorageResult): AppStorageStatusResult {
  return {
    mode: result.mode,
    status: result.status,
    message: result.message,
  };
}

function appStorageRequiresReload(collections: readonly AppStorageCollectionReplaceResult[]) {
  return collections.some((collection) => collection.status === "ready");
}

/**
 * Formats the single Pond Care warning derived from structured dropped-record
 * counts. Storage status messages remain plain and do not duplicate this text.
 */
export function summarizeAppStorageDroppedRecords(
  droppedRecordCountByCollection: Partial<Record<AppStorageCollectionKey, number>>,
): { total: number; message: string } {
  const droppedEntries = APP_STORAGE_COLLECTION_KEYS.filter(
    (collectionKey) => (droppedRecordCountByCollection[collectionKey] ?? 0) > 0,
  ).map((collectionKey) => ({
    collectionKey,
    count: droppedRecordCountByCollection[collectionKey] ?? 0,
  }));

  const total = droppedEntries.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return { total: 0, message: "" };

  const detail = droppedEntries
    .map((entry) => `${APP_STORAGE_COLLECTION_LABELS[entry.collectionKey]} (${entry.count})`)
    .join(", ");
  return {
    total,
    message: `${total} unreadable record(s) were skipped during load [${detail}]. Saving those collections will erase the skipped records permanently; restore from a backup bundle first.`,
  };
}

function collectDroppedRecordCounts(
  collectionSnapshots: readonly {
    collectionKey: AppStorageCollectionKey;
    snapshot: AppStorageCollectionLoadResult;
  }[],
): Partial<Record<AppStorageCollectionKey, number>> {
  const droppedRecordCountByCollection: Partial<Record<AppStorageCollectionKey, number>> = {};
  for (const { collectionKey, snapshot } of collectionSnapshots) {
    if (snapshot.droppedRecordCount > 0) {
      droppedRecordCountByCollection[collectionKey] = snapshot.droppedRecordCount;
    }
  }
  return droppedRecordCountByCollection;
}

export async function loadAppStorageMetadata(rawUrl: string): Promise<AppStorageMetadataResult> {
  const metadataResult = await loadHostStorageMetadata(rawUrl);
  return {
    mode: metadataResult.mode,
    status: metadataResult.status,
    message: metadataResult.message,
    metadataAvailable: metadataResult.metadataAvailable,
    storageMetadata: appStorageMetadataByCollectionKey(metadataResult.collectionMetadata),
  };
}

export async function loadAppStorageSnapshot(rawUrl: string): Promise<AppStorageSnapshot> {
  const [
    appSettingsSnapshot,
    characterSnapshot,
    personaSnapshot,
    lorebookSnapshot,
    promptPresetSnapshot,
    loreRuntimeStateSnapshot,
    macroVariableStateSnapshot,
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
    loadPromptPresetRecordsFromStorage(rawUrl),
    loadLoreRuntimeStatesFromStorage(rawUrl),
    loadMacroVariableStatesFromStorage(rawUrl),
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
  const appSettingsCanStorePromptPresetStarterMarker =
    appSettingsSnapshot.status === "ready" && appSettingsSnapshot.droppedRecordCount === 0;
  const shouldSeedPromptPresets =
    promptPresetSnapshot.status === "ready" &&
    promptPresetSnapshot.droppedRecordCount === 0 &&
    promptPresetSnapshot.records.length === 0;
  const promptPresets = shouldSeedPromptPresets
    ? [STARTER_PROMPT_PRESET]
    : promptPresetSnapshot.records;
  const repairedDefaultPromptPresetId =
    promptPresets.find((preset) => preset.id === appSettingsSnapshot.settings.defaultPromptPresetId)
      ?.id ??
    promptPresets[0]?.id ??
    null;
  const defaultChanged =
    repairedDefaultPromptPresetId !== appSettingsSnapshot.settings.defaultPromptPresetId;
  const settingsWithDefault = defaultChanged
    ? { ...appSettingsSnapshot.settings, defaultPromptPresetId: repairedDefaultPromptPresetId }
    : appSettingsSnapshot.settings;
  const repairedRoleplayThreads = repairPromptPresetRelationships(
    roleplayThreads,
    promptPresets,
    new Set(roleplaySnapshot.normalizationChangedRecordIds),
    repairedDefaultPromptPresetId,
  );
  const repairedMessengerThreads = repairPromptPresetRelationships(
    messengerThreads,
    promptPresets,
    new Set(messengerSnapshot.normalizationChangedRecordIds),
    repairedDefaultPromptPresetId,
  );
  const shouldInitializePromptPresetStarter =
    appSettingsCanStorePromptPresetStarterMarker &&
    promptPresetSnapshot.status === "ready" &&
    !appSettingsSnapshot.settings.promptPresetStarterInitialized &&
    shouldSeedPromptPresets;
  const appSettings = shouldInitializePromptPresetStarter
    ? {
        ...settingsWithDefault,
        promptPresetStarterInitialized: true,
      }
    : settingsWithDefault;
  const migrationCollectionKeys: AppStorageMigrationCollectionKey[] = [];
  const addMigrationCollectionKeys = (...collectionKeys: AppStorageMigrationCollectionKey[]) => {
    for (const collectionKey of collectionKeys) {
      if (!migrationCollectionKeys.includes(collectionKey)) {
        migrationCollectionKeys.push(collectionKey);
      }
    }
  };
  if (shouldInitializePromptPresetStarter) addMigrationCollectionKeys("appSettings");
  if (defaultChanged) addMigrationCollectionKeys("appSettings");
  if (shouldSeedPromptPresets) addMigrationCollectionKeys("promptPresets");
  if (
    repairedRoleplayThreads.clearedPresetReferenceCount > 0 ||
    repairedRoleplayThreads.repairedChoiceSelectionCount > 0
  ) {
    addMigrationCollectionKeys("roleplayThreads");
  }
  if (roleplaySnapshot.hasLegacyEmbeddedEntries) {
    addMigrationCollectionKeys("roleplayThreads", "roleplayEntries");
  }
  if (
    repairedMessengerThreads.clearedPresetReferenceCount > 0 ||
    repairedMessengerThreads.repairedChoiceSelectionCount > 0
  ) {
    addMigrationCollectionKeys("messengerThreads");
  }
  if (messengerSnapshot.hasLegacyEmbeddedMessages) {
    addMigrationCollectionKeys("messengerThreads", "messengerMessages");
  }

  const collectionSnapshots = [
    { collectionKey: "appSettings", snapshot: appSettingsSnapshot },
    { collectionKey: "characters", snapshot: characterSnapshot },
    { collectionKey: "personas", snapshot: personaSnapshot },
    { collectionKey: "lorebooks", snapshot: lorebookSnapshot },
    { collectionKey: "promptPresets", snapshot: promptPresetSnapshot },
    { collectionKey: "loreRuntimeStates", snapshot: loreRuntimeStateSnapshot },
    { collectionKey: "macroVariableStates", snapshot: macroVariableStateSnapshot },
    { collectionKey: "providerConnections", snapshot: providerConnectionSnapshot },
    { collectionKey: "roleplayThreads", snapshot: roleplaySnapshot },
    { collectionKey: "roleplayEntries", snapshot: roleplayEntrySnapshot },
    { collectionKey: "messengerThreads", snapshot: messengerSnapshot },
    { collectionKey: "messengerMessages", snapshot: messengerMessageSnapshot },
    { collectionKey: "rippleStates", snapshot: rippleSnapshot },
  ] as const satisfies readonly {
    collectionKey: AppStorageCollectionKey;
    snapshot: AppStorageCollectionLoadResult;
  }[];
  const droppedRecordCountByCollection = collectDroppedRecordCounts(collectionSnapshots);
  const storageResult = mergeStorageResults(collectionSnapshots.map(({ snapshot }) => snapshot));

  return {
    appSettings,
    characters: characterSnapshot.records,
    personas: personaSnapshot.records,
    lorebooks: lorebookSnapshot.records,
    promptPresets,
    loreRuntimeStates: loreRuntimeStateSnapshot.states,
    macroVariableStates: macroVariableStateSnapshot.states,
    providerConnections: providerConnectionSnapshot.records,
    roleplayThreads: repairedRoleplayThreads.records,
    messengerThreads: repairedMessengerThreads.records,
    rippleStates: rippleSnapshot.states,
    migrationCollectionKeys,
    storageMetadata: metadataResult.storageMetadata,
    droppedRecordCountByCollection,
    storageResult,
  };
}

function orderedAppStorageSaveCollectionKeys(
  collectionKeys: NonEmptyAppStorageCollectionKeys,
): NonEmptyAppStorageCollectionKeys {
  if (!collectionKeys.includes("appSettings") || !collectionKeys.includes("promptPresets")) {
    return collectionKeys;
  }

  return [
    "promptPresets",
    ...collectionKeys.filter((collectionKey) => collectionKey !== "promptPresets"),
  ];
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
    case "promptPresets":
      return savePromptPresetRecordsToStorage(snapshot.promptPresets, rawUrl);
    case "loreRuntimeStates":
      return saveLoreRuntimeStatesToStorage(snapshot.loreRuntimeStates, rawUrl);
    case "macroVariableStates":
      return saveMacroVariableStatesToStorage(snapshot.macroVariableStates, rawUrl);
    case "providerConnections":
      return saveProviderConnectionRecordsToStorage(snapshot.providerConnections, rawUrl);
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
  const orderedCollectionKeys = orderedAppStorageSaveCollectionKeys(collectionKeys);
  const collectionResults: {
    collectionKey: AppStorageCollectionKey;
    result: StorageResult;
  }[] = [];
  for (const collectionKey of orderedCollectionKeys) {
    const result = await saveAppStorageCollection(snapshot, collectionKey, rawUrl);
    collectionResults.push({ collectionKey, result });
    if (result.status === "error") break;
  }
  const storageMetadata: AppStorageMetadata = {};
  for (const { collectionKey, result } of collectionResults) {
    if (result.status === "ready" && result.metadata) {
      storageMetadata[collectionKey] = result.metadata;
    }
  }

  return {
    ...storageResultWithoutCollectionMetadata(
      mergeStorageResults(collectionResults.map(({ result }) => result)),
    ),
    storageMetadata,
  };
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
  const collectionKeys = orderedAppStorageSaveCollectionKeys(APP_STORAGE_COLLECTION_KEYS);

  for (const collectionKey of collectionKeys) {
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
    if (result.status === "ready" && result.metadata) {
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
