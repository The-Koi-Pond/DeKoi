import { useCallback } from "react";
import type { MessengerThread } from "../../../engine/messenger";
import type { SurfaceId } from "../../../engine/surfaces";
import { MESSENGER } from "../../../engine/surfaces";
import { createRecordId } from "../../../shared/browser/record-id";
import {
  type AppStorageRecords,
  type MessengerStorageStatus,
} from "../../runtime";
import {
  createDeKoiStorageBundle,
  type DeKoiLegacyImportData,
  type DeKoiStorageBundle,
} from "../../runtime";
import type { PondView } from "../../navigation";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseAppImportExportActionsInput = AppStorageRecords & {
  providerConnections: AppStorageRecords["providerConnections"];
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
  roleplayThreads,
  messengerThreads,
  rippleStates,
  setAppSettings,
  setCharacters,
  setPersonas,
  setLorebooks,
  setProviderConnections,
  setRoleplayThreads,
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
        roleplayThreads,
        lorebooks,
        messengerThreads,
        personas,
        providerConnections,
        rippleStates,
      }),
    [
      appSettings,
      characters,
      roleplayThreads,
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
      const fallbackConnection = importedConnections[0] ?? null;

      if (!hasActiveConnection && fallbackConnection) {
        importedSettings.activeMessengerConnectionId = fallbackConnection.id;
      } else if (!hasActiveConnection) {
        importedSettings.activeMessengerConnectionId = "";
      }

      setCharacters(bundle.data.characters);
      setPersonas(bundle.data.personas);
      setLorebooks(bundle.data.lorebooks);
      setProviderConnections(importedConnections);
      setRoleplayThreads(bundle.data.roleplayThreads);
      setMessengerThreads(bundle.data.messengerThreads);
      setRippleStates(bundle.data.rippleStates);
      setAppSettings(importedSettings);
      setMessengerStorageStatus("saving");
      setMessengerStorageMessage("Imported DeKoi bundle. Saving...");
      setSelectedSurface(MESSENGER);
      setView({ kind: "pond" });
    },
    [
      setAppSettings,
      setCharacters,
      setRoleplayThreads,
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
