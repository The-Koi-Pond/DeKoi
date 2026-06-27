import { useCallback, useEffect, useRef } from "react";
import {
  cancelIdle,
  requestIdle,
  type IdleHandle,
} from "../shared/browser/idle-callback";
import {
  loadAppStorageSnapshot,
  saveAppStorageCollections,
  APP_STORAGE_COLLECTION_KEYS,
  type AppStorageCollectionKey,
  type AppStorageRecords,
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "../features/runtime";
import type { StateSetter } from "../shared/react/state-setter";

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
type SaveStatusResult = {
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
};

function appStorageCollectionSignature(
  snapshot: AppStorageRecords,
  collectionKey: AppStorageCollectionKey,
) {
  return JSON.stringify(snapshot[collectionKey]) ?? "null";
}

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

function changedAppStorageCollectionKeys(
  snapshot: AppStorageRecords,
  previousSnapshot: AppStorageRecords | null,
) {
  if (!previousSnapshot) return [...APP_STORAGE_COLLECTION_KEYS];

  return APP_STORAGE_COLLECTION_KEYS.filter(
    (collectionKey) => snapshot[collectionKey] !== previousSnapshot[collectionKey],
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
    setStorageReady(false);

    loadAppStorageSnapshot(remoteRuntimeUrl).then((snapshot) => {
      if (cancelled || storageGeneration.current !== generation) return;
      savedSignatures.current = createAppStorageSignatures(snapshot);
      lastSeenSnapshot.current = snapshot;
      setAppSettings(snapshot.appSettings);
      setCharacters(snapshot.characters);
      setPersonas(snapshot.personas);
      setLorebooks(snapshot.lorebooks);
      setProviderConnections(snapshot.providerConnections);
      setRoleplayThreads(snapshot.roleplayThreads);
      setMessengerThreads(snapshot.messengerThreads);
      setRippleStates(snapshot.rippleStates);
      setMessengerStorageMode(snapshot.storageResult.mode);
      setMessengerStorageStatus(snapshot.storageResult.status);
      setMessengerStorageMessage(snapshot.storageResult.message);
      setStorageReady(snapshot.storageResult.status === "ready");
    });

    return () => {
      cancelled = true;
    };
  }, [
    remoteRuntimeUrl,
    setAppSettings,
    setCharacters,
    setRoleplayThreads,
    setLorebooks,
    setMessengerStorageMessage,
    setMessengerStorageMode,
    setMessengerStorageStatus,
    setMessengerThreads,
    setPersonas,
    setProviderConnections,
    setRippleStates,
    setStorageReady,
  ]);

  // Coalesce rapid state changes (e.g. dragging a settings slider fires many
  // updateAppSettings calls) into a single host write. We debounce briefly, then
  // defer the write to an idle frame so the main thread stays responsive.
  useEffect(() => {
    if (!storageReady || !savedSignatures.current) return;

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

      saveAppStorageCollections(
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
      }).finally(() => {
        if (entry.generation !== storageGeneration.current) return;
        if (activeSaveSignatures.current[collectionKey] === entry.signature) {
          delete activeSaveSignatures.current[collectionKey];
        }
        if (saveQueueRunning.current === entry.generation) {
          saveQueueRunning.current = null;
        }
        refreshSaveStatus(entry.generation);
        drainSaveQueue();
      });
    };

    const timer = setTimeout(() => {
      idleHandle = requestIdle(() => {
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
    }, 150);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (idleHandle !== undefined) cancelIdle(idleHandle);
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
}
