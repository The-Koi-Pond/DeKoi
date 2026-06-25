import { useEffect, useRef } from "react";
import {
  cancelIdle,
  requestIdle,
  type IdleHandle,
} from "../../shared/browser/idle-callback";
import {
  loadAppStorageSnapshot,
  saveAppStorageSnapshot,
  type AppStorageRecords,
} from "../../runtime/app-storage-snapshot";
import type {
  MessengerStorageMode,
  MessengerStorageStatus,
} from "../../runtime/messenger-storage";
import type { StateSetter } from "./state-setter";

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
  setClassicThreads: StateSetter<AppStorageRecords["classicThreads"]>;
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
  classicThreads,
  messengerThreads,
  rippleStates,
  remoteRuntimeUrl,
  storageReady,
  setAppSettings,
  setCharacters,
  setPersonas,
  setLorebooks,
  setProviderConnections,
  setClassicThreads,
  setMessengerThreads,
  setRippleStates,
  setMessengerStorageMode,
  setMessengerStorageStatus,
  setMessengerStorageMessage,
  setStorageReady,
}: UseAppStorageSyncInput) {
  const saveRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;

    loadAppStorageSnapshot(remoteRuntimeUrl).then((snapshot) => {
      if (cancelled) return;
      setAppSettings(snapshot.appSettings);
      setCharacters(snapshot.characters);
      setPersonas(snapshot.personas);
      setLorebooks(snapshot.lorebooks);
      setProviderConnections(snapshot.providerConnections);
      setClassicThreads(snapshot.classicThreads);
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
    setClassicThreads,
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
  // defer the write to an idle frame so the main thread stays responsive. The
  // saveRequestId guard below still ensures only the latest batch's result is
  // applied if multiple writes overlap.
  useEffect(() => {
    if (!storageReady) return;

    let idleHandle: IdleHandle | undefined;

    const timer = setTimeout(() => {
      const requestId = saveRequestId.current + 1;
      saveRequestId.current = requestId;

      idleHandle = requestIdle(() => {
        saveAppStorageSnapshot(
          {
            appSettings,
            characters,
            personas,
            lorebooks,
            providerConnections,
            classicThreads,
            messengerThreads,
            rippleStates,
          },
          remoteRuntimeUrl,
        ).then((storageResult) => {
          if (saveRequestId.current !== requestId) return;
          setMessengerStorageMode(storageResult.mode);
          setMessengerStorageStatus(storageResult.status);
          setMessengerStorageMessage(storageResult.message);
        });
      });
    }, 150);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (idleHandle !== undefined) cancelIdle(idleHandle);
    };
  }, [
    appSettings,
    characters,
    classicThreads,
    lorebooks,
    messengerThreads,
    personas,
    providerConnections,
    remoteRuntimeUrl,
    rippleStates,
    setMessengerStorageMessage,
    setMessengerStorageMode,
    setMessengerStorageStatus,
    storageReady,
  ]);
}
