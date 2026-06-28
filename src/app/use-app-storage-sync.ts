import { useCallback, useEffect, useRef } from "react";
import {
  cancelIdle,
  requestIdle,
  type IdleHandle,
} from "../shared/browser/idle-callback";
import {
  appStorageCollectionCount,
  appStorageCollectionSignature,
  appStorageCollectionSource,
  loadAppStorageSnapshot,
  replaceAppStorageSnapshot,
  saveAppStorageCollections,
  APP_STORAGE_COLLECTION_KEYS,
  type AppStorageCollectionKey,
  type AppStorageReplaceResult,
  type AppStorageRecords,
  type AppStorageSnapshot,
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "../features/runtime";
import type { StateSetter } from "../shared/react/state-setter";
import { appStorageReplaceResultNeedsReload } from "./app-storage-import-recovery";

type AppStorageCollectionSignatures = Record<AppStorageCollectionKey, string>;
type PartialAppStorageCollectionSignatures = Partial<
  Record<AppStorageCollectionKey, string>
>;

type SaveQueueEntry = {
  snapshot: AppStorageRecords;
  rawUrl: string;
  generation: number;
  signature: string;
};

type SaveQueueEntries = Partial<Record<AppStorageCollectionKey, SaveQueueEntry>>;
type SaveErrorMessages = Partial<Record<AppStorageCollectionKey, string>>;
type ActiveSavePromise = Promise<void>;
type SaveStatusResult = {
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
};

const IMPORT_ROLLBACK_MESSAGE =
  "No automatic rollback was performed. Use the pre-import backup bundle to restore if needed.";
const LEGACY_TRANSCRIPT_MIGRATION_SIGNATURE = "__legacy_transcript_migration__";

function createAppStorageSignatures(
  snapshot: AppStorageRecords,
): AppStorageCollectionSignatures {
  const signatures = {} as AppStorageCollectionSignatures;
  for (const collectionKey of APP_STORAGE_COLLECTION_KEYS) {
    signatures[collectionKey] = appStorageCollectionSignature(
      snapshot,
      collectionKey,
    );
  }
  return signatures;
}

function createLoadedAppStorageSignatures(
  snapshot: AppStorageSnapshot,
): AppStorageCollectionSignatures {
  const signatures = createAppStorageSignatures(snapshot);
  for (const collectionKey of snapshot.migrationCollectionKeys) {
    signatures[collectionKey] = LEGACY_TRANSCRIPT_MIGRATION_SIGNATURE;
  }
  return signatures;
}

function createMigrationAppStorageSignatures(
  snapshot: AppStorageSnapshot,
): PartialAppStorageCollectionSignatures {
  const signatures: PartialAppStorageCollectionSignatures = {};
  for (const collectionKey of snapshot.migrationCollectionKeys) {
    signatures[collectionKey] = appStorageCollectionSignature(
      snapshot,
      collectionKey,
    );
  }
  return signatures;
}

function createAppStorageCounts(
  snapshot: AppStorageRecords,
): Record<AppStorageCollectionKey, number> {
  const counts = {} as Record<AppStorageCollectionKey, number>;
  for (const collectionKey of APP_STORAGE_COLLECTION_KEYS) {
    counts[collectionKey] = appStorageCollectionCount(snapshot, collectionKey);
  }
  return counts;
}

function createImportErrorResult(
  records: AppStorageRecords,
  message: string,
): AppStorageReplaceResult {
  return {
    mode: "unavailable",
    status: "error",
    message,
    counts: createAppStorageCounts(records),
    collections: [],
    failedCollectionKey: null,
    requiresReload: false,
    rollbackAvailable: false,
    rollbackMessage: IMPORT_ROLLBACK_MESSAGE,
  };
}

function changedAppStorageCollectionKeys(
  snapshot: AppStorageRecords,
  previousSnapshot: AppStorageRecords | null,
) {
  if (!previousSnapshot) return [...APP_STORAGE_COLLECTION_KEYS];

  return APP_STORAGE_COLLECTION_KEYS.filter(
    (collectionKey) =>
      appStorageCollectionSource(snapshot, collectionKey) !==
      appStorageCollectionSource(previousSnapshot, collectionKey),
  );
}

function orderedAppStorageCollectionKeys(
  collectionKeys: Iterable<AppStorageCollectionKey>,
) {
  const collectionKeySet = new Set(collectionKeys);
  return APP_STORAGE_COLLECTION_KEYS.filter((collectionKey) =>
    collectionKeySet.has(collectionKey),
  );
}

function asNonEmptyAppStorageCollectionKeys(
  collectionKeys: readonly AppStorageCollectionKey[],
) {
  const [firstCollectionKey, ...remainingCollectionKeys] = collectionKeys;
  return firstCollectionKey
    ? ([firstCollectionKey, ...remainingCollectionKeys] as const)
    : null;
}

function firstSaveErrorMessage(errors: SaveErrorMessages) {
  for (const collectionKey of APP_STORAGE_COLLECTION_KEYS) {
    const message = errors[collectionKey];
    if (message) return message;
  }
  return null;
}

function hasPendingSaveForGeneration(
  pendingSaves: SaveQueueEntries,
  generation: number,
) {
  return APP_STORAGE_COLLECTION_KEYS.some(
    (collectionKey) => pendingSaves[collectionKey]?.generation === generation,
  );
}

function hasUnsavedSignature(
  unsavedSignatures: PartialAppStorageCollectionSignatures,
) {
  return APP_STORAGE_COLLECTION_KEYS.some(
    (collectionKey) => unsavedSignatures[collectionKey] !== undefined,
  );
}

type UseAppStorageSyncInput = AppStorageRecords & {
  remoteRuntimeUrl: string;
  storageReady: boolean;
  setAppSettings: StateSetter<AppStorageRecords["appSettings"]>;
  setCharacters: StateSetter<AppStorageRecords["characters"]>;
  setPersonas: StateSetter<AppStorageRecords["personas"]>;
  setLorebooks: StateSetter<AppStorageRecords["lorebooks"]>;
  setProviderConnections: StateSetter<
    AppStorageRecords["providerConnections"]
  >;
  setRoleplayThreads: StateSetter<AppStorageRecords["roleplayThreads"]>;
  setMessengerThreads: StateSetter<AppStorageRecords["messengerThreads"]>;
  setRippleStates: StateSetter<AppStorageRecords["rippleStates"]>;
  setMessengerStorageMode: StateSetter<MessengerStorageMode>;
  setMessengerStorageStatus: StateSetter<MessengerStorageStatus>;
  setMessengerStorageMessage: StateSetter<string>;
  setStorageReady: StateSetter<boolean>;
};

export function useAppStorageSync({
  appSettings,
  characters,
  personas,
  lorebooks,
  providerConnections,
  roleplayThreads,
  messengerThreads,
  rippleStates,
  remoteRuntimeUrl,
  storageReady,
  setAppSettings,
  setCharacters,
  setPersonas,
  setLorebooks,
  setProviderConnections,
  setRoleplayThreads,
  setMessengerThreads,
  setRippleStates,
  setMessengerStorageMode,
  setMessengerStorageStatus,
  setMessengerStorageMessage,
  setStorageReady,
}: UseAppStorageSyncInput) {
  const storageGeneration = useRef(0);
  const savedSignatures = useRef<AppStorageCollectionSignatures | null>(null);
  const lastSeenSnapshot = useRef<AppStorageRecords | null>(null);
  const unsavedSignatures = useRef<PartialAppStorageCollectionSignatures>({});
  const activeSaveSignatures = useRef<PartialAppStorageCollectionSignatures>({});
  const pendingSaves = useRef<SaveQueueEntries>({});
  const saveErrors = useRef<SaveErrorMessages>({});
  const saveQueueRunning = useRef<number | null>(null);
  const activeSavePromise = useRef<ActiveSavePromise | null>(null);
  const queuedSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedSaveIdleHandle = useRef<IdleHandle | null>(null);
  const importCommitRunning = useRef(false);

  const refreshSaveStatus = useCallback(
    (generation: number, storageResult?: SaveStatusResult) => {
      const saveErrorMessage = firstSaveErrorMessage(saveErrors.current);
      const hasPendingSaves = hasPendingSaveForGeneration(
        pendingSaves.current,
        generation,
      );
      const hasActiveSave = saveQueueRunning.current === generation;
      const hasUnsavedSaves = hasUnsavedSignature(unsavedSignatures.current);
      if (storageResult) setMessengerStorageMode(storageResult.mode);
      setMessengerStorageStatus(
        saveErrorMessage
          ? "error"
          : hasActiveSave || hasPendingSaves || hasUnsavedSaves
            ? "saving"
            : storageResult?.status ?? "ready",
      );
      setMessengerStorageMessage(
        saveErrorMessage ??
          (hasActiveSave || hasPendingSaves || hasUnsavedSaves
            ? "Saving changes..."
            : storageResult?.message ?? "All changes saved."),
      );
    },
    [
      setMessengerStorageMessage,
      setMessengerStorageMode,
      setMessengerStorageStatus,
    ],
  );

  const applyAppStorageRecords = useCallback(
    (records: AppStorageRecords) => {
      setAppSettings(records.appSettings);
      setCharacters(records.characters);
      setPersonas(records.personas);
      setLorebooks(records.lorebooks);
      setProviderConnections(records.providerConnections);
      setRoleplayThreads(records.roleplayThreads);
      setMessengerThreads(records.messengerThreads);
      setRippleStates(records.rippleStates);
    },
    [
      setAppSettings,
      setCharacters,
      setLorebooks,
      setMessengerThreads,
      setPersonas,
      setProviderConnections,
      setRippleStates,
      setRoleplayThreads,
    ],
  );

  const applyLoadedAppStorageSnapshot = useCallback(
    (
      snapshot: AppStorageSnapshot,
      options?: { deferStorageReady?: boolean },
    ) => {
      savedSignatures.current = createLoadedAppStorageSignatures(snapshot);
      unsavedSignatures.current = createMigrationAppStorageSignatures(snapshot);
      lastSeenSnapshot.current = snapshot;
      applyAppStorageRecords(snapshot);
      setStorageReady(
        !options?.deferStorageReady &&
          snapshot.storageResult.status === "ready",
      );
    },
    [applyAppStorageRecords, setStorageReady],
  );

  const cancelQueuedSaveDispatch = useCallback(() => {
    if (queuedSaveTimer.current !== null) {
      clearTimeout(queuedSaveTimer.current);
      queuedSaveTimer.current = null;
    }

    if (queuedSaveIdleHandle.current !== null) {
      cancelIdle(queuedSaveIdleHandle.current);
      queuedSaveIdleHandle.current = null;
    }
  }, []);

  const waitForActiveSaveToSettle = useCallback(async () => {
    while (activeSavePromise.current) {
      await activeSavePromise.current.catch(() => undefined);
    }
  }, []);

  const reloadPersistedStorageAfterImportFailure = useCallback(
    async (
      storageResult: AppStorageReplaceResult,
      generation: number,
      options?: { force?: boolean },
    ) => {
      if (!options?.force && !appStorageReplaceResultNeedsReload(storageResult)) {
        return storageResult;
      }

      try {
        const snapshot = await loadAppStorageSnapshot(remoteRuntimeUrl);
        if (storageGeneration.current !== generation) return storageResult;

        applyLoadedAppStorageSnapshot(snapshot);
        unsavedSignatures.current = {};
        activeSaveSignatures.current = {};
        pendingSaves.current = {};
        saveErrors.current = {};
        saveQueueRunning.current = null;
        const reloadMessage =
          snapshot.storageResult.status === "ready"
            ? "Persisted storage was reloaded so the app matches the partial import."
            : `Persisted storage reload also reported: ${snapshot.storageResult.message}`;
        return {
          ...storageResult,
          message: `${storageResult.message} ${reloadMessage}`,
        };
      } catch (error) {
        return {
          ...storageResult,
          message: `${storageResult.message} Failed to reload persisted storage after the import failure: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    },
    [applyLoadedAppStorageSnapshot, remoteRuntimeUrl],
  );

  const commitAppStorageImport = useCallback(
    async (records: AppStorageRecords): Promise<AppStorageReplaceResult> => {
      if (importCommitRunning.current) {
        const result = createImportErrorResult(
          records,
          "Another import is already in progress. Wait for it to finish before importing again.",
        );
        setMessengerStorageMode(result.mode);
        setMessengerStorageStatus("error");
        setMessengerStorageMessage(result.message);
        return result;
      }

      importCommitRunning.current = true;

      try {
        setMessengerStorageStatus("saving");
        setMessengerStorageMessage("Importing DeKoi bundle...");

        cancelQueuedSaveDispatch();
        storageGeneration.current += 1;
        const generation = storageGeneration.current;
        pendingSaves.current = {};
        unsavedSignatures.current = {};
        saveErrors.current = {};

        await waitForActiveSaveToSettle();

        if (storageGeneration.current !== generation) {
          const result = createImportErrorResult(
            records,
            "Import was interrupted because the storage target changed. Retry on the current storage target.",
          );
          setMessengerStorageMode(result.mode);
          setMessengerStorageStatus("error");
          setMessengerStorageMessage(result.message);
          return result;
        }

        activeSaveSignatures.current = {};
        saveQueueRunning.current = null;

        let storageResult: AppStorageReplaceResult;
        try {
          storageResult = await replaceAppStorageSnapshot(
            records,
            remoteRuntimeUrl,
          );
        } catch (error) {
          const failureResult = await reloadPersistedStorageAfterImportFailure(
            createImportErrorResult(
              records,
              `Import failed unexpectedly. ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
            generation,
            { force: true },
          );
          setMessengerStorageMode(failureResult.mode);
          setMessengerStorageStatus("error");
          setMessengerStorageMessage(failureResult.message);
          return failureResult;
        }

        if (storageGeneration.current !== generation) {
          const result: AppStorageReplaceResult = {
            ...storageResult,
            status: "error",
            message:
              "Import finished after the storage target changed. Retry on the current storage target before using imported records.",
          };
          setMessengerStorageMode(result.mode);
          setMessengerStorageStatus("error");
          setMessengerStorageMessage(result.message);
          return result;
        }

        if (storageResult.status === "ready") {
          savedSignatures.current = createAppStorageSignatures(records);
          lastSeenSnapshot.current = records;
          unsavedSignatures.current = {};
          activeSaveSignatures.current = {};
          pendingSaves.current = {};
          saveErrors.current = {};
          saveQueueRunning.current = null;
          applyAppStorageRecords(records);
          setStorageReady(true);
          setMessengerStorageMode(storageResult.mode);
          setMessengerStorageStatus("ready");
          setMessengerStorageMessage(storageResult.message);
          return storageResult;
        }

        const failureResult = await reloadPersistedStorageAfterImportFailure(
          storageResult,
          generation,
        );

        setMessengerStorageMode(failureResult.mode);
        setMessengerStorageStatus("error");
        setMessengerStorageMessage(failureResult.message);
        return failureResult;
      } finally {
        importCommitRunning.current = false;
      }
    },
    [
      applyAppStorageRecords,
      cancelQueuedSaveDispatch,
      reloadPersistedStorageAfterImportFailure,
      remoteRuntimeUrl,
      setMessengerStorageMessage,
      setMessengerStorageMode,
      setMessengerStorageStatus,
      setStorageReady,
      waitForActiveSaveToSettle,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    storageGeneration.current += 1;
    const generation = storageGeneration.current;
    savedSignatures.current = null;
    lastSeenSnapshot.current = null;
    unsavedSignatures.current = {};
    activeSaveSignatures.current = {};
    pendingSaves.current = {};
    saveErrors.current = {};
    saveQueueRunning.current = null;
    activeSavePromise.current = null;
    cancelQueuedSaveDispatch();
    setStorageReady(false);

    loadAppStorageSnapshot(remoteRuntimeUrl).then((snapshot) => {
      if (cancelled || storageGeneration.current !== generation) return;
      const migrationCollectionKeys = asNonEmptyAppStorageCollectionKeys(
        snapshot.migrationCollectionKeys,
      );
      const shouldMigrateLegacyTranscripts =
        snapshot.storageResult.status === "ready" &&
        migrationCollectionKeys !== null;
      applyLoadedAppStorageSnapshot(snapshot, {
        deferStorageReady: shouldMigrateLegacyTranscripts,
      });
      setMessengerStorageMode(snapshot.storageResult.mode);
      setMessengerStorageStatus(snapshot.storageResult.status);
      setMessengerStorageMessage(snapshot.storageResult.message);

      if (!shouldMigrateLegacyTranscripts) return;

      setMessengerStorageStatus("saving");
      setMessengerStorageMessage("Migrating legacy transcripts into split storage.");
      const migrationSavePromise = saveAppStorageCollections(
        snapshot,
        migrationCollectionKeys,
        remoteRuntimeUrl,
      ).then((storageResult) => {
        if (cancelled || storageGeneration.current !== generation) return;

        if (storageResult.status === "ready") {
          savedSignatures.current = createAppStorageSignatures(snapshot);
          unsavedSignatures.current = {};
          saveErrors.current = {};
        } else {
          const migrationSignatures =
            createMigrationAppStorageSignatures(snapshot);
          unsavedSignatures.current = {
            ...unsavedSignatures.current,
            ...migrationSignatures,
          };
          for (const collectionKey of snapshot.migrationCollectionKeys) {
            saveErrors.current[collectionKey] = storageResult.message;
          }
        }

        setStorageReady(snapshot.storageResult.status === "ready");
        refreshSaveStatus(generation, storageResult);
      }, (error: unknown) => {
        if (cancelled || storageGeneration.current !== generation) return;

        const message =
          error instanceof Error ? error.message : "Storage save failed.";
        const migrationSignatures =
          createMigrationAppStorageSignatures(snapshot);
        unsavedSignatures.current = {
          ...unsavedSignatures.current,
          ...migrationSignatures,
        };
        for (const collectionKey of snapshot.migrationCollectionKeys) {
          saveErrors.current[collectionKey] = message;
        }
        setStorageReady(snapshot.storageResult.status === "ready");
        refreshSaveStatus(generation);
      }).finally(() => {
        if (activeSavePromise.current === migrationSavePromise) {
          activeSavePromise.current = null;
        }
      });
      activeSavePromise.current = migrationSavePromise;
    });

    return () => {
      cancelled = true;
    };
  }, [
    cancelQueuedSaveDispatch,
    applyLoadedAppStorageSnapshot,
    remoteRuntimeUrl,
    refreshSaveStatus,
    setMessengerStorageMessage,
    setMessengerStorageMode,
    setMessengerStorageStatus,
    setStorageReady,
  ]);

  // Coalesce rapid state changes (e.g. dragging a settings slider fires many
  // updateAppSettings calls) into a single host write. We debounce briefly, then
  // defer the write to an idle frame so the main thread stays responsive.
  useEffect(() => {
    if (!storageReady || !savedSignatures.current || importCommitRunning.current) {
      return;
    }

    const snapshot: AppStorageRecords = {
      appSettings,
      characters,
      personas,
      lorebooks,
      providerConnections,
      roleplayThreads,
      messengerThreads,
      rippleStates,
    };
    const changedCollectionKeys = changedAppStorageCollectionKeys(
      snapshot,
      lastSeenSnapshot.current,
    );
    const changedCollectionKeySet = new Set(changedCollectionKeys);
    const candidateCollectionKeys = orderedAppStorageCollectionKeys([
      ...changedCollectionKeys,
      ...(Object.keys(unsavedSignatures.current) as AppStorageCollectionKey[]),
    ]);
    if (candidateCollectionKeys.length === 0) return;

    const nextSignatures: PartialAppStorageCollectionSignatures = {};
    const dirtyCollectionKeys: AppStorageCollectionKey[] = [];
    let shouldRefreshStorageStatus = false;
    for (const collectionKey of candidateCollectionKeys) {
      const signature = changedCollectionKeySet.has(collectionKey)
        ? appStorageCollectionSignature(snapshot, collectionKey)
        : unsavedSignatures.current[collectionKey];
      if (signature === undefined) continue;

      nextSignatures[collectionKey] = signature;
      const activeSaveSignature = activeSaveSignatures.current[collectionKey];
      if (
        savedSignatures.current[collectionKey] !== signature ||
        (activeSaveSignature !== undefined && activeSaveSignature !== signature)
      ) {
        unsavedSignatures.current[collectionKey] = signature;
        dirtyCollectionKeys.push(collectionKey);
      } else {
        delete unsavedSignatures.current[collectionKey];
        if (pendingSaves.current[collectionKey]) {
          delete pendingSaves.current[collectionKey];
          shouldRefreshStorageStatus = true;
        }
        if (saveErrors.current[collectionKey]) {
          delete saveErrors.current[collectionKey];
          shouldRefreshStorageStatus = true;
        }
      }
    }
    lastSeenSnapshot.current = snapshot;
    if (dirtyCollectionKeys.length === 0) {
      if (shouldRefreshStorageStatus) {
        refreshSaveStatus(storageGeneration.current);
      }
      return;
    }
    setMessengerStorageStatus("saving");

    let idleHandle: IdleHandle | undefined;

    const drainSaveQueue = () => {
      if (saveQueueRunning.current === storageGeneration.current) return;

      const collectionKey = APP_STORAGE_COLLECTION_KEYS.find(
        (key) => pendingSaves.current[key],
      );
      if (!collectionKey) return;

      const entry = pendingSaves.current[collectionKey];
      delete pendingSaves.current[collectionKey];
      if (!entry) return;

      if (entry.generation !== storageGeneration.current) {
        drainSaveQueue();
        return;
      }

      saveQueueRunning.current = entry.generation;
      activeSaveSignatures.current[collectionKey] = entry.signature;
      setMessengerStorageStatus("saving");

      const savePromise = saveAppStorageCollections(
        entry.snapshot,
        [collectionKey],
        entry.rawUrl,
      ).then((storageResult) => {
        if (entry.generation !== storageGeneration.current) return;

        if (storageResult.status === "ready") {
          savedSignatures.current = savedSignatures.current
            ? {
                ...savedSignatures.current,
                [collectionKey]: entry.signature,
              }
            : null;
          if (unsavedSignatures.current[collectionKey] === entry.signature) {
            delete unsavedSignatures.current[collectionKey];
          }
          delete saveErrors.current[collectionKey];
        } else {
          if (!unsavedSignatures.current[collectionKey]) {
            unsavedSignatures.current[collectionKey] = entry.signature;
          }
          saveErrors.current[collectionKey] = storageResult.message;
        }

        refreshSaveStatus(entry.generation, storageResult);
      }, (error: unknown) => {
        if (entry.generation !== storageGeneration.current) return;

        if (!unsavedSignatures.current[collectionKey]) {
          unsavedSignatures.current[collectionKey] = entry.signature;
        }
        saveErrors.current[collectionKey] =
          error instanceof Error ? error.message : "Storage save failed.";
        refreshSaveStatus(entry.generation);
      }).finally(() => {
        if (activeSaveSignatures.current[collectionKey] === entry.signature) {
          delete activeSaveSignatures.current[collectionKey];
        }
        if (saveQueueRunning.current === entry.generation) {
          saveQueueRunning.current = null;
        }
        if (activeSavePromise.current === savePromise) {
          activeSavePromise.current = null;
        }
        if (entry.generation !== storageGeneration.current) return;
        refreshSaveStatus(entry.generation);
        drainSaveQueue();
      });
      activeSavePromise.current = savePromise;
    };

    const timer = setTimeout(() => {
      idleHandle = requestIdle(() => {
        queuedSaveIdleHandle.current = null;
        for (const collectionKey of dirtyCollectionKeys) {
          const signature = nextSignatures[collectionKey];
          if (signature === undefined) continue;

          pendingSaves.current[collectionKey] = {
            snapshot,
            rawUrl: remoteRuntimeUrl,
            generation: storageGeneration.current,
            signature,
          };
        }
        drainSaveQueue();
      });
      queuedSaveTimer.current = null;
      queuedSaveIdleHandle.current = idleHandle;
    }, 150);
    queuedSaveTimer.current = timer;

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (idleHandle !== undefined) cancelIdle(idleHandle);
      if (queuedSaveTimer.current === timer) {
        queuedSaveTimer.current = null;
      }
      if (queuedSaveIdleHandle.current === idleHandle) {
        queuedSaveIdleHandle.current = null;
      }
    };
  }, [
    appSettings,
    characters,
    roleplayThreads,
    lorebooks,
    messengerThreads,
    personas,
    providerConnections,
    remoteRuntimeUrl,
    rippleStates,
    refreshSaveStatus,
    setMessengerStorageMessage,
    setMessengerStorageMode,
    setMessengerStorageStatus,
    storageReady,
  ]);

  return { commitAppStorageImport };
}
