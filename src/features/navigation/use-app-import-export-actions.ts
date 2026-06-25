import { useCallback } from "react";
import type { MessengerThread } from "../../engine/messenger";
import type { SurfaceId } from "../../engine/surfaces";
import { MESSENGER } from "../../engine/surfaces";
import { createRecordId } from "../../shared/browser/record-id";
import {
  createDeKoiStorageBundle,
  type DeKoiLegacyImportData,
  type DeKoiStorageBundle,
} from "../runtime/storage-bundle-workflows";
import type { MessengerStorageStatus } from "../../runtime/messenger-storage";
import type { PondView } from "./nav-types";
import type { AppStorageRecords } from "../../runtime/app-storage-snapshot";
import type { StateSetter } from "./state-setter";

type UseAppImportExportActionsInput = AppStorageRecords & {
  providerConnections: AppStorageRecords["providerConnections"];
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
  setMessengerStorageStatus: StateSetter<MessengerStorageStatus>;
  setMessengerStorageMessage: StateSetter<string>;
  setSelectedSurface: StateSetter<SurfaceId>;
  setView: (view: PondView) => void;
};

export function useAppImportExportActions({
  appSettings,
  characters,
  personas,
  lorebooks,
  providerConnections,
  classicThreads,
  messengerThreads,
  rippleStates,
  setAppSettings,
  setCharacters,
  setPersonas,
  setLorebooks,
  setProviderConnections,
  setClassicThreads,
  setMessengerThreads,
  setRippleStates,
  setMessengerStorageStatus,
  setMessengerStorageMessage,
  setSelectedSurface,
  setView,
}: UseAppImportExportActionsInput) {
  const createStorageBundle = useCallback(
    () =>
      createDeKoiStorageBundle({
        appSettings,
        characters,
        classicThreads,
        lorebooks,
        messengerThreads,
        personas,
        providerConnections,
        rippleStates,
      }),
    [
      appSettings,
      characters,
      classicThreads,
      lorebooks,
      messengerThreads,
      personas,
      providerConnections,
      rippleStates,
    ],
  );

  const importStorageBundle = useCallback(
    (bundle: DeKoiStorageBundle) => {
      const importedConnections = bundle.data.providerConnections;
      const importedSettings = { ...bundle.data.appSettings };
      const hasActiveConnection = importedConnections.some(
        (connection) =>
          connection.id === importedSettings.activeMessengerConnectionId,
      );
      const fallbackConnection =
        importedConnections[0] ?? providerConnections[0];

      if (!hasActiveConnection && fallbackConnection) {
        importedSettings.activeMessengerConnectionId = fallbackConnection.id;
      }

      setCharacters(bundle.data.characters);
      setPersonas(bundle.data.personas);
      setLorebooks(bundle.data.lorebooks);
      setProviderConnections(importedConnections);
      setClassicThreads(bundle.data.classicThreads);
      setMessengerThreads(bundle.data.messengerThreads);
      setRippleStates(bundle.data.rippleStates);
      setAppSettings(importedSettings);
      setMessengerStorageStatus("saving");
      setMessengerStorageMessage("Imported DeKoi bundle. Saving...");
      setSelectedSurface(MESSENGER);
      setView({ kind: "pond" });
    },
    [
      providerConnections,
      setAppSettings,
      setCharacters,
      setClassicThreads,
      setLorebooks,
      setMessengerStorageMessage,
      setMessengerStorageStatus,
      setMessengerThreads,
      setPersonas,
      setProviderConnections,
      setRippleStates,
      setSelectedSurface,
      setView,
    ],
  );

  const importLegacyData = useCallback(
    (data: DeKoiLegacyImportData) => {
      const importedThreads = data.messengerThreads.map((thread) => {
        const id = createRecordId("messenger-thread");
        return {
          ...thread,
          id,
          messages: thread.messages.map((message) => ({
            ...message,
            threadId: id,
          })),
        };
      });
      const firstImportedThreadId = importedThreads[0]?.id ?? null;

      setMessengerThreads((currentThreads: MessengerThread[]) => [
        ...importedThreads,
        ...currentThreads,
      ]);

      setMessengerStorageStatus("saving");
      setMessengerStorageMessage("Imported legacy threads. Saving...");
      setSelectedSurface(MESSENGER);
      setView(
        firstImportedThreadId
          ? { kind: "messenger", threadId: firstImportedThreadId }
          : { kind: "pond" },
      );
    },
    [
      setMessengerStorageMessage,
      setMessengerStorageStatus,
      setMessengerThreads,
      setSelectedSurface,
      setView,
    ],
  );

  return {
    createStorageBundle,
    importStorageBundle,
    importLegacyData,
  };
}
